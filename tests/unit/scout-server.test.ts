/**
 * Tests for Scout Express server with x402 gating (SCOUT-04).
 *
 * Verifies that:
 * - GET /discover without X-Payment returns 402 with payment requirements
 * - GET /discover with valid X-Payment returns 200 with proposals
 * - GET /discover?q=... passes query parameter to ScoutAgent.discoverProposals
 * - GET /health returns 200 with status ok
 *
 * All Solana, key, and agent interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import type { Server } from 'http';

// --- Hoisted mock functions ---

const {
  mockGetWeb3Keypair,
  mockGetConnection,
  mockGetAssociatedTokenAddressSync,
  mockVerifyAndSettlePayment,
  mockDiscoverProposals,
  mockInitialize,
} = vi.hoisted(() => ({
  mockGetWeb3Keypair: vi.fn(),
  mockGetConnection: vi.fn(),
  mockGetAssociatedTokenAddressSync: vi.fn(),
  mockVerifyAndSettlePayment: vi.fn(),
  mockDiscoverProposals: vi.fn(),
  mockInitialize: vi.fn(),
}));

// --- Mock modules ---

vi.mock('../../src/lib/keys.js', () => ({
  getWeb3Keypair: mockGetWeb3Keypair,
}));

vi.mock('../../src/lib/solana/connection.js', () => ({
  getConnection: mockGetConnection,
}));

vi.mock('../../src/lib/solana/token-accounts.js', () => ({
  DEVNET_USDC_MINT: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
}));

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddressSync: mockGetAssociatedTokenAddressSync,
}));

vi.mock('../../src/lib/x402/verify.js', () => ({
  verifyAndSettlePayment: mockVerifyAndSettlePayment,
}));

vi.mock('../../src/agents/scout-agent.js', () => ({
  ScoutAgent: vi.fn().mockImplementation(function (this: any) {
    this.initialize = mockInitialize;
    this.discoverProposals = mockDiscoverProposals;
    return this;
  }),
}));

vi.mock('../../src/events/event-bus.js', () => ({
  TypedEventBus: vi.fn().mockImplementation(function (this: any) { return this; }),
}));

// --- Tests ---

describe('Scout Server (SCOUT-04)', () => {
  const scoutKeypair = Keypair.generate();
  const mockAtaAddress = Keypair.generate().publicKey;
  const mockConnection = {} as any;
  let server: Server;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWeb3Keypair.mockReturnValue(scoutKeypair);
    mockGetConnection.mockReturnValue(mockConnection);
    mockGetAssociatedTokenAddressSync.mockReturnValue(mockAtaAddress);
    mockInitialize.mockResolvedValue(undefined);
    mockDiscoverProposals.mockResolvedValue([
      { id: 'p1', title: 'Test Proposal', description: 'desc', requestedAmount: 1000, teamInfo: 'team' },
    ]);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Reset module cache to get fresh server each test
    vi.resetModules();
  });

  async function startServer(): Promise<{ server: Server; port: number }> {
    const { createScoutServer } = await import('../../src/servers/scout-server.js');
    const result = createScoutServer({ port: 0 });
    server = await result.start();
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    return { server, port };
  }

  it('returns 402 with payment requirements when no X-Payment header', async () => {
    const { port } = await startServer();

    const res = await fetch(`http://localhost:${port}/discover`);
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.x402Version).toBe(1);
    expect(body.scheme).toBe('exact');
    expect(body.network).toBe('solana-devnet');
    expect(body.payment.recipientWallet).toBe(scoutKeypair.publicKey.toBase58());
    expect(body.payment.tokenAccount).toBe(mockAtaAddress.toBase58());
    expect(body.payment.mint).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    expect(body.payment.amount).toBe(1000);
  });

  it('returns 200 with proposals when X-Payment header is valid', async () => {
    mockVerifyAndSettlePayment.mockResolvedValue({
      valid: true,
      signature: 'test-sig-123',
    });

    const { port } = await startServer();

    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: { serializedTransaction: 'base64EncodedTx==' },
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    const res = await fetch(`http://localhost:${port}/discover`, {
      headers: { 'X-Payment': xPaymentHeader },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0].title).toBe('Test Proposal');
    expect(body.txSignature).toBe('test-sig-123');
  });

  it('passes query parameter to ScoutAgent.discoverProposals', async () => {
    mockVerifyAndSettlePayment.mockResolvedValue({
      valid: true,
      signature: 'test-sig-456',
    });

    const { port } = await startServer();

    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: { serializedTransaction: 'base64EncodedTx==' },
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    await fetch(`http://localhost:${port}/discover?q=defi+grants`, {
      headers: { 'X-Payment': xPaymentHeader },
    });

    expect(mockDiscoverProposals).toHaveBeenCalledWith('defi grants');
  });

  it('returns 200 on GET /health', async () => {
    const { port } = await startServer();

    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.agent).toBe('scout');
  });
});
