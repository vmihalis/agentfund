/**
 * Voice command Express server.
 *
 * Provides REST endpoints for text-based voice command fallback
 * and ElevenLabs signed URL proxy.
 *
 * Endpoints:
 * - POST /api/voice/command -- parse text and route through VoiceCommandRouter
 * - GET /api/voice/signed-url -- proxy to ElevenLabs convai signed URL API
 * - GET /api/voice/health -- health check
 *
 * Follows the server factory pattern from Phase 6 (createScoutServer).
 *
 * @module voice/voice-server
 */

import express from 'express';
import type { Server } from 'http';
import type { VoiceCommandRouter } from './voice-command-router.js';
import { parseTextCommand } from './text-parser.js';

/** Options for creating the voice server. */
export interface VoiceServerOptions {
  port?: number;
  router: VoiceCommandRouter;
}

/**
 * Create a Voice HTTP server with text command and signed URL endpoints.
 *
 * @param options - Configuration with VoiceCommandRouter and optional port
 * @returns Object with Express app and start function
 */
export function createVoiceServer(options: VoiceServerOptions) {
  const port = options.port ?? (Number(process.env.VOICE_PORT) || 4003);
  const router = options.router;

  const app = express();
  app.use(express.json());

  /**
   * POST /api/voice/command
   *
   * Accepts { text: string }, parses it into a VoiceCommand via parseTextCommand,
   * then routes it through VoiceCommandRouter.execute.
   * Returns the VoiceResult JSON.
   */
  app.post('/api/voice/command', async (req, res) => {
    try {
      const { text } = req.body ?? {};

      if (!text || typeof text !== 'string' || text.trim() === '') {
        res.status(400).json({ error: 'Missing required field: text' });
        return;
      }

      const command = parseTextCommand(text);
      const result = await router.execute(command);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });

  /**
   * GET /api/voice/signed-url
   *
   * Proxies a signed URL request to ElevenLabs convai API.
   * Requires ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID env vars.
   */
  app.get('/api/voice/signed-url', async (_req, res) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const agentId = process.env.ELEVENLABS_AGENT_ID;

      if (!apiKey || !agentId) {
        res
          .status(500)
          .json({ error: 'ElevenLabs credentials not configured' });
        return;
      }

      const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`;
      const response = await fetch(url, {
        headers: { 'xi-api-key': apiKey },
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.status(500).json({
          error: `ElevenLabs API error: ${response.status} ${errorText}`,
        });
        return;
      }

      const data = (await response.json()) as { signed_url?: string };
      res.json({ signedUrl: data.signed_url });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to get signed URL',
      });
    }
  });

  /**
   * GET /api/voice/health
   *
   * Simple health check endpoint.
   */
  app.get('/api/voice/health', (_req, res) => {
    res.json({ status: 'ok', agent: 'voice', port });
  });

  async function start(): Promise<Server> {
    return new Promise<Server>((resolve) => {
      const server = app.listen(port, () => {
        resolve(server);
      });
    });
  }

  return { app, start };
}
