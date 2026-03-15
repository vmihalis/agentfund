/**
 * Scout Agent HTTP Server with x402 Payment Gating
 *
 * Wraps the existing ScoutAgent in an Express HTTP server.
 * GET /discover is gated by x402 middleware -- callers must pay
 * 0.001 USDC (1000 base units) to receive proposal data.
 *
 * Does NOT modify ScoutAgent or any existing agent files.
 *
 * @module servers/scout-server
 */

import express from 'express';
import type { Server } from 'http';
import { ScoutAgent } from '../agents/scout-agent.js';
import { TypedEventBus } from '../events/event-bus.js';
import { x402Middleware } from '../lib/x402/middleware.js';
import { getWeb3Keypair } from '../lib/keys.js';
import { getConnection } from '../lib/solana/connection.js';
import { getActiveUsdcMint } from '../lib/solana/token-accounts.js';

/** Options for creating the scout server. */
export interface ScoutServerOptions {
  port?: number;
}

/**
 * Create a Scout HTTP server with x402-gated /discover endpoint.
 *
 * @param options - Optional configuration (port defaults to SCOUT_PORT env or 4001)
 * @returns Object with Express app and start function
 */
export function createScoutServer(options?: ScoutServerOptions) {
  const port = options?.port ?? (Number(process.env.SCOUT_PORT) || 4001);

  const app = express();
  app.use(express.json());

  // Initialize agent
  const bus = new TypedEventBus();
  const scout = new ScoutAgent(bus);

  // Load scout keypair and configure x402
  const scoutKeypair = getWeb3Keypair('scout');
  const connection = getConnection();

  const usdcMint = getActiveUsdcMint();
  const paymentMiddleware = x402Middleware({
    recipientWallet: scoutKeypair.publicKey,
    usdcMint,
    priceUsdc: 1000, // 0.001 USDC
    connection,
    cluster: 'devnet',
  });

  // x402-gated discovery endpoint
  app.get('/discover', paymentMiddleware, async (req, res) => {
    try {
      const query = (req.query.q as string) || 'solana grants';
      const proposals = await scout.discoverProposals(query);
      res.json({
        proposals,
        txSignature: (req as any).x402Signature,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });

  // Health check (no payment required)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', agent: 'scout', port });
  });

  async function start(): Promise<Server> {
    await scout.initialize();
    return new Promise<Server>((resolve) => {
      const server = app.listen(port, () => {
        resolve(server);
      });
    });
  }

  return { app, start };
}
