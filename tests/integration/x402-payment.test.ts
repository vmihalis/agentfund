/**
 * Integration tests for the full x402 payment cycle (PAY-02).
 *
 * Tests the complete 402 -> pay -> content flow:
 * 1. Scout server returns 402 with payment requirements (needs keys only)
 * 2. wrapFetchWithPayment auto-handles 402 and makes payment (needs funded wallets)
 * 3. Payment produces a real on-chain USDC transfer on devnet (needs funded wallets)
 *
 * Requires:
 * - Agent keypairs in keys/ directory (for 402 shape test)
 * - Funded wallets with USDC ATAs (for payment cycle tests)
 * - Devnet connectivity
 *
 * Skips gracefully when prerequisites are missing.
 */

import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { Server } from 'http';
import { Connection, Keypair } from '@solana/web3.js';

// --- Skip conditions ---

const KEYS_DIR = path.join(process.cwd(), 'keys');
const GOVERNANCE_KEY_PATH = path.join(KEYS_DIR, 'governance.json');
const SCOUT_KEY_PATH = path.join(KEYS_DIR, 'scout.json');
const ADDRESSES_PATH = path.join(KEYS_DIR, 'addresses.json');
const SKIP_DEVNET = process.env.SKIP_DEVNET_TESTS === 'true';

const keysExist =
  fs.existsSync(GOVERNANCE_KEY_PATH) && fs.existsSync(SCOUT_KEY_PATH);

/** Check if wallets have USDC ATAs (funded via fund-wallets script). */
function walletsAreFunded(): boolean {
  if (!fs.existsSync(ADDRESSES_PATH)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf-8'));
    return (
      data.usdcMint !== null &&
      data.agents?.governance?.ata !== null &&
      data.agents?.scout?.ata !== null
    );
  } catch {
    return false;
  }
}

const shouldSkipAll = !keysExist || SKIP_DEVNET;
const shouldSkipPayment = shouldSkipAll || !walletsAreFunded();

// --- Test suite ---

describe.skipIf(shouldSkipAll)('x402 Payment Integration (PAY-02)', () => {
  let server: Server;
  let serverPort: number;
  let connection: Connection;
  let govKeypair: Keypair;

  // Dynamic imports to avoid loading Solana modules when skipping
  async function setup() {
    if (server) return; // Already set up

    const { createScoutServer } = await import(
      '../../src/servers/scout-server.js'
    );
    const { getWeb3Keypair } = await import('../../src/lib/keys.js');
    const { getConnection } = await import(
      '../../src/lib/solana/connection.js'
    );

    connection = getConnection();
    govKeypair = getWeb3Keypair('governance');

    // Start scout server on random port
    const scout = createScoutServer({ port: 0 });
    server = await scout.start();
    const addr = server.address();
    serverPort = typeof addr === 'object' && addr ? addr.port : 0;
  }

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('402 response contains valid payment requirements', async () => {
    await setup();

    const res = await fetch(`http://localhost:${serverPort}/discover`);
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.x402Version).toBe(1);
    expect(body.scheme).toBe('exact');
    expect(body.network).toBe('solana-devnet');
    expect(body.payment).toBeDefined();
    expect(body.payment.recipientWallet).toBeDefined();
    expect(body.payment.tokenAccount).toBeDefined();
    expect(body.payment.mint).toBeDefined();
    expect(body.payment.amount).toBe(1000);
  });

  describe.skipIf(shouldSkipPayment)('with funded wallets', () => {
    it('full x402 payment cycle with wrapFetch returns proposals', async () => {
      await setup();

      const { wrapFetchWithPayment } = await import(
        '../../src/lib/x402/client.js'
      );
      const { getActiveUsdcMint } = await import(
        '../../src/lib/solana/token-accounts.js'
      );

      const usdcMint = getActiveUsdcMint();
      const paidFetch = wrapFetchWithPayment(fetch, {
        keypair: govKeypair,
        connection,
        usdcMint,
        maxPaymentUsdc: 10000, // 0.01 USDC safety cap
      });

      const res = await paidFetch(`http://localhost:${serverPort}/discover`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.proposals).toBeDefined();
      expect(Array.isArray(body.proposals)).toBe(true);
      expect(body.proposals.length).toBeGreaterThan(0);
    });

    it('payment produces a valid on-chain transaction signature', async () => {
      await setup();

      const { wrapFetchWithPayment } = await import(
        '../../src/lib/x402/client.js'
      );
      const { getActiveUsdcMint } = await import(
        '../../src/lib/solana/token-accounts.js'
      );

      const usdcMint = getActiveUsdcMint();
      const paidFetch = wrapFetchWithPayment(fetch, {
        keypair: govKeypair,
        connection,
        usdcMint,
        maxPaymentUsdc: 10000,
      });

      const res = await paidFetch(`http://localhost:${serverPort}/discover`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.txSignature).toBeDefined();
      expect(typeof body.txSignature).toBe('string');
      expect(body.txSignature.length).toBeGreaterThan(0);

      // Verify the transaction exists on devnet
      const txInfo = await connection.getTransaction(body.txSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      expect(txInfo).not.toBeNull();
      expect(txInfo!.meta?.err).toBeNull();
    });
  });
});
