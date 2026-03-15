/**
 * Command server — Express HTTP server for text commands.
 *
 * Endpoints:
 * - POST /api/auth/signup -- create account
 * - POST /api/auth/login -- login and get token
 * - GET /api/auth/me -- get current user
 * - POST /api/auth/logout -- invalidate token
 * - POST /api/voice/command -- parse text and route (auth required)
 * - POST /api/voice/clear -- clear conversation history (auth required)
 * - GET /api/voice/health -- health check (public)
 * - GET /api/memory/stats -- memory stats (auth required)
 * - GET /api/activity/stream -- SSE stream (public)
 *
 * @module voice/voice-server
 */

import express from 'express';
import type { Server } from 'http';
import type { VoiceCommandRouter } from './voice-command-router.js';
import { parseTextCommand } from './text-parser.js';

import type { AgentEventBus } from '../events/event-types.js';
import type { AgentMemory } from '../memory/agent-memory.js';
import { UserStore } from '../auth/user-store.js';
import { SessionManager } from '../auth/session-manager.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import type { VoiceRouterDeps } from './voice-command-router.js';
import type { AgentMessenger } from '../agents/agent-messenger.js';

/** Options for creating the command server. */
export interface VoiceServerOptions {
  port?: number;
  router: VoiceCommandRouter;
  bus?: AgentEventBus;
  memory?: AgentMemory;
  /** Base deps for creating per-user routers. If provided, enables auth. */
  routerDeps?: Omit<VoiceRouterDeps, 'memory'>;
  messenger?: AgentMessenger;
}

/**
 * Create a command HTTP server with text command endpoints.
 *
 * @param options - Configuration with VoiceCommandRouter and optional port
 * @returns Object with Express app and start function
 */
export function createVoiceServer(options: VoiceServerOptions) {
  const port = options.port ?? (Number(process.env.VOICE_PORT) || 4003);
  const fallbackRouter = options.router;

  const app = express();
  app.use(express.json());

  // Auth infrastructure
  const userStore = new UserStore();
  const authMiddleware = createAuthMiddleware(userStore);

  // Session manager for per-user isolated routers
  let sessionManager: SessionManager | null = null;
  if (options.routerDeps) {
    sessionManager = new SessionManager(options.routerDeps, options.messenger);
  }

  /** Get the router for the current request — per-user if auth'd, fallback otherwise. */
  function getRouter(req: express.Request): VoiceCommandRouter {
    if (sessionManager && req.user) {
      return sessionManager.getRouter(req.user.id);
    }
    return fallbackRouter;
  }

  // ==================== AUTH ENDPOINTS (public) ====================

  /**
   * POST /api/auth/signup
   * Body: { email, password }
   * Returns: { user, token }
   */
  app.post('/api/auth/signup', (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      const result = userStore.signup(email, password);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Signup failed' });
    }
  });

  /**
   * POST /api/auth/login
   * Body: { email, password }
   * Returns: { user, token }
   */
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      const result = userStore.login(email, password);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed' });
    }
  });

  /**
   * GET /api/auth/me
   * Returns current user info if authenticated, 401 if not.
   */
  app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });

  /**
   * POST /api/auth/logout
   * Invalidates the current session token.
   */
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      userStore.logout(authHeader.slice(7));
    }
    res.json({ success: true });
  });

  // ==================== PROTECTED ENDPOINTS ====================

  /**
   * POST /api/voice/command
   *
   * Accepts { text: string }, parses it into a VoiceCommand via parseTextCommand,
   * then routes it through the user's VoiceCommandRouter.
   * Returns the VoiceResult JSON.
   *
   * Auth required — each user gets isolated session state.
   */
  app.post('/api/voice/command', authMiddleware, async (req, res) => {
    try {
      const { text } = req.body ?? {};

      if (!text || typeof text !== 'string' || text.trim() === '') {
        res.status(400).json({ error: 'Missing required field: text' });
        return;
      }

      const router = getRouter(req);
      const command = await parseTextCommand(text);
      const result = await router.execute(command);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });

  /**
   * POST /api/voice/clear
   *
   * Clears the user's conversation history and cached proposals/evaluations.
   * Auth required.
   */
  app.post('/api/voice/clear', authMiddleware, (req, res) => {
    const router = getRouter(req);
    router.clearHistory();
    res.json({ success: true });
  });

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * GET /api/voice/health
   *
   * Simple health check endpoint.
   */
  app.get('/api/voice/health', (_req, res) => {
    res.json({
      status: 'ok',
      agent: 'voice',
      port,
      users: userStore.getUserCount(),
      activeSessions: sessionManager?.getActiveCount() ?? 0,
    });
  });

  /**
   * GET /api/memory/stats
   *
   * Returns memory statistics for the authenticated user.
   */
  app.get('/api/memory/stats', authMiddleware, (req, res) => {
    if (sessionManager && req.user) {
      res.json(sessionManager.getMemoryStats(req.user.id));
    } else if (options.memory) {
      res.json(options.memory.getStats());
    } else {
      res.json({ totalEvaluations: 0, totalDecisions: 0, avgScore: 0 });
    }
  });

  /**
   * GET /api/activity/stream
   *
   * SSE endpoint that pushes activity events in real-time.
   * Public — events are global (all agents share one bus).
   */
  if (options.bus) {
    const bus = options.bus;
    app.get('/api/activity/stream', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const keepalive = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 15000);

      const push = (entry: Record<string, unknown>) => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
      };

      let idCounter = 0;
      const nextId = () => `sse-${Date.now()}-${idCounter++}`;

      const onStatus = (event: any) => {
        push({ id: nextId(), timestamp: event.timestamp, type: 'status', agent: event.agent, message: event.detail ?? event.status });
      };
      const onError = (event: any) => {
        push({ id: nextId(), timestamp: event.timestamp, type: 'error', agent: event.agent, message: event.error });
      };
      const onThinking = (event: any) => {
        push({ id: nextId(), timestamp: event.timestamp, type: 'thinking', agent: event.agent, message: event.thought, phase: event.phase });
      };
      const onQuestion = (event: any) => {
        push({ id: nextId(), timestamp: event.timestamp, type: 'question', agent: event.from, targetAgent: event.to, message: event.question, correlationId: event.correlationId, detail: event.context });
      };
      const onAnswer = (event: any) => {
        push({ id: nextId(), timestamp: event.timestamp, type: 'answer', agent: event.from, targetAgent: event.to, message: event.answer, correlationId: event.correlationId });
      };
      const onConfidence = (event: any) => {
        push({ id: nextId(), timestamp: event.timestamp, type: 'confidence', agent: event.agent, message: `${event.subject}: ${event.reasoning}`, confidence: event.confidence });
      };
      const onStep = (event: any) => {
        push({ id: nextId(), timestamp: Date.now(), type: 'step', message: `${event.step}: ${event.status}`, detail: event.detail });
      };
      const onDecision = (event: any) => {
        push({ id: nextId(), timestamp: Date.now(), type: 'decision', message: event.summary });
      };
      const onFunded = (event: any) => {
        push({ id: nextId(), timestamp: Date.now(), type: 'funded', message: `Funded ${event.proposalTitle}`, txSignature: event.txSignature });
      };

      bus.on('agent:status', onStatus);
      bus.on('agent:error', onError);
      bus.on('agent:thinking', onThinking);
      bus.on('agent:question', onQuestion);
      bus.on('agent:answer', onAnswer);
      bus.on('agent:confidence', onConfidence);
      bus.on('pipeline:step', onStep);
      bus.on('pipeline:decision', onDecision);
      bus.on('pipeline:funded', onFunded);

      req.on('close', () => {
        clearInterval(keepalive);
        bus.off('agent:status', onStatus);
        bus.off('agent:error', onError);
        bus.off('agent:thinking', onThinking);
        bus.off('agent:question', onQuestion);
        bus.off('agent:answer', onAnswer);
        bus.off('agent:confidence', onConfidence);
        bus.off('pipeline:step', onStep);
        bus.off('pipeline:decision', onDecision);
        bus.off('pipeline:funded', onFunded);
      });
    });
  }

  async function start(): Promise<Server> {
    return new Promise<Server>((resolve) => {
      const server = app.listen(port, () => {
        resolve(server);
      });
    });
  }

  return { app, start };
}
