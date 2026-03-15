/**
 * SessionManager -- per-user isolated agent sessions.
 *
 * Each authenticated user gets their own VoiceCommandRouter instance
 * with separate chat history, proposal cache, and agent memory.
 * Agents (Scout, Analyzer, Treasury, Governance) are shared across users
 * but each user's session state is fully isolated.
 */

import { VoiceCommandRouter, type VoiceRouterDeps } from '../voice/voice-command-router.js';
import { AgentMemory } from '../memory/agent-memory.js';
import type { AgentMessenger } from '../agents/agent-messenger.js';
import path from 'path';

interface UserSession {
  router: VoiceCommandRouter;
  memory: AgentMemory;
  lastActive: number;
}

const SESSION_IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour

export class SessionManager {
  private sessions = new Map<string, UserSession>();
  private readonly baseDeps: Omit<VoiceRouterDeps, 'memory'>;
  private readonly messenger: AgentMessenger | null;

  constructor(baseDeps: Omit<VoiceRouterDeps, 'memory'>, messenger?: AgentMessenger) {
    this.baseDeps = baseDeps;
    this.messenger = messenger ?? null;

    // Cleanup idle sessions every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /** Get or create a user's session. */
  getRouter(userId: string): VoiceCommandRouter {
    let session = this.sessions.get(userId);

    if (!session) {
      // Create per-user memory with isolated file
      const memoryPath = path.join(process.cwd(), 'data', `memory-${userId}.json`);
      const memory = new AgentMemory(memoryPath);

      const router = new VoiceCommandRouter({
        ...this.baseDeps,
        memory,
        messenger: this.messenger ?? undefined,
      });

      session = { router, memory, lastActive: Date.now() };
      this.sessions.set(userId, session);
    }

    session.lastActive = Date.now();
    return session.router;
  }

  /** Get a user's memory stats. */
  getMemoryStats(userId: string): { totalEvaluations: number; totalDecisions: number; avgScore: number } {
    const session = this.sessions.get(userId);
    if (!session) {
      return { totalEvaluations: 0, totalDecisions: 0, avgScore: 0 };
    }
    return session.memory.getStats();
  }

  /** Clear a user's session (chat history, caches). */
  clearSession(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.router.clearHistory();
    }
  }

  /** Remove idle sessions. */
  private cleanup(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastActive > SESSION_IDLE_TIMEOUT) {
        this.sessions.delete(userId);
      }
    }
  }

  /** Get active session count. */
  getActiveCount(): number {
    return this.sessions.size;
  }
}
