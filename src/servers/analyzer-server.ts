/**
 * Analyzer Agent HTTP Server with x402 Payment Gating
 *
 * Wraps the existing AnalyzerAgent in an Express HTTP server.
 * POST /evaluate is gated by x402 middleware -- callers must pay
 * 0.002 USDC (2000 base units) to receive evaluation data.
 *
 * Does NOT modify AnalyzerAgent or any existing agent files.
 *
 * @module servers/analyzer-server
 */

import express from 'express';
import type { Server } from 'http';
import { AnalyzerAgent } from '../agents/analyzer-agent.js';
import { TypedEventBus } from '../events/event-bus.js';
import { x402Middleware } from '../lib/x402/middleware.js';
import { getWeb3Keypair } from '../lib/keys.js';
import { getConnection } from '../lib/solana/connection.js';
import { getActiveUsdcMint } from '../lib/solana/token-accounts.js';

/** Options for creating the analyzer server. */
export interface AnalyzerServerOptions {
  port?: number;
}

/**
 * Create an Analyzer HTTP server with x402-gated /evaluate endpoint.
 *
 * @param options - Optional configuration (port defaults to ANALYZER_PORT env or 4002)
 * @returns Object with Express app and start function
 */
export function createAnalyzerServer(options?: AnalyzerServerOptions) {
  const port = options?.port ?? (Number(process.env.ANALYZER_PORT) || 4002);

  const app = express();
  app.use(express.json());

  // Initialize agent
  const bus = new TypedEventBus();
  const analyzer = new AnalyzerAgent(bus);

  // Load analyzer keypair and configure x402
  const analyzerKeypair = getWeb3Keypair('analyzer');
  const connection = getConnection();

  const usdcMint = getActiveUsdcMint();
  const paymentMiddleware = x402Middleware({
    recipientWallet: analyzerKeypair.publicKey,
    usdcMint,
    priceUsdc: 2000, // 0.002 USDC
    connection,
    cluster: 'devnet',
  });

  // x402-gated evaluation endpoint
  app.post('/evaluate', paymentMiddleware, async (req, res) => {
    try {
      const { proposal } = req.body;

      if (!proposal) {
        return res.status(400).json({ error: 'Missing required field: proposal' });
      }

      const evaluation = await analyzer.evaluateProposal(proposal);
      res.json({
        evaluation,
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
    res.json({ status: 'ok', agent: 'analyzer', port });
  });

  async function start(): Promise<Server> {
    await analyzer.initialize();
    return new Promise<Server>((resolve) => {
      const server = app.listen(port, () => {
        resolve(server);
      });
    });
  }

  return { app, start };
}
