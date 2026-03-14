/**
 * Tests for Analyzer Express server with x402 gating (ANLZ-04).
 *
 * Verifies that:
 * - POST /evaluate without X-Payment returns 402 with payment requirements
 * - POST /evaluate with valid X-Payment and proposal body returns 200 with evaluation
 * - POST /evaluate with missing proposal body returns 400
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
  mockEvaluateProposal,
  mockInitialize,
} = vi.hoisted(() => ({
  mockGetWeb3Keypair: vi.fn(),
  mockGetConnection: vi.fn(),
  mockGetAssociatedTokenAddressSync: vi.fn(),
  mockVerifyAndSettlePayment: vi.fn(),
  mockEvaluateProposal: vi.fn(),
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

vi.mock('../../src/agents/analyzer-agent.js', () => ({
  AnalyzerAgent: vi.fn().mockImplementation(function (this: any) {
    this.initialize = mockInitialize;
    this.evaluateProposal = mockEvaluateProposal;
    return this;
  }),
}));

vi.mock('../../src/events/event-bus.js', () => ({
  TypedEventBus: vi.fn().mockImplementation(function (this: any) { return this; }),
}));

// --- Tests ---

describe('Analyzer Server (ANLZ-04)', () => {
  const analyzerKeypair = Keypair.generate();
  const mockAtaAddress = Keypair.generate().publicKey;
  const mockConnection = {} as any;
  let server: Server;

  const sampleProposal = {
    id: 'p1',
    title: 'Test Proposal',
    description: 'A test proposal description',
    requestedAmount: 5000,
    teamInfo: 'Team Alpha with 3 engineers',
  };

  const sampleEvaluation = {
    proposalId: 'p1',
    proposalTitle: 'Test Proposal',
    scores: {
      teamQuality: 7,
      technicalFeasibility: 8,
      impactPotential: 6,
      budgetReasonableness: 7,
    },
    overallScore: 7,
    reasoning: 'Strong team with feasible approach',
    recommendation: 'fund' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWeb3Keypair.mockReturnValue(analyzerKeypair);
    mockGetConnection.mockReturnValue(mockConnection);
    mockGetAssociatedTokenAddressSync.mockReturnValue(mockAtaAddress);
    mockInitialize.mockResolvedValue(undefined);
    mockEvaluateProposal.mockResolvedValue(sampleEvaluation);
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    vi.resetModules();
  });

  async function startServer(): Promise<{ server: Server; port: number }> {
    const { createAnalyzerServer } = await import('../../src/servers/analyzer-server.js');
    const result = createAnalyzerServer({ port: 0 });
    server = await result.start();
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    return { server, port };
  }

  it('returns 402 with payment requirements when no X-Payment header', async () => {
    const { port } = await startServer();

    const res = await fetch(`http://localhost:${port}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal: sampleProposal }),
    });

    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.x402Version).toBe(1);
    expect(body.scheme).toBe('exact');
    expect(body.network).toBe('solana-devnet');
    expect(body.payment.recipientWallet).toBe(analyzerKeypair.publicKey.toBase58());
    expect(body.payment.tokenAccount).toBe(mockAtaAddress.toBase58());
    expect(body.payment.mint).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    expect(body.payment.amount).toBe(2000);
  });

  it('returns 200 with evaluation when X-Payment header is valid', async () => {
    mockVerifyAndSettlePayment.mockResolvedValue({
      valid: true,
      signature: 'test-sig-789',
    });

    const { port } = await startServer();

    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: { serializedTransaction: 'base64EncodedTx==' },
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    const res = await fetch(`http://localhost:${port}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': xPaymentHeader,
      },
      body: JSON.stringify({ proposal: sampleProposal }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.evaluation.proposalId).toBe('p1');
    expect(body.evaluation.recommendation).toBe('fund');
    expect(body.txSignature).toBe('test-sig-789');
  });

  it('returns 400 when proposal body is missing', async () => {
    mockVerifyAndSettlePayment.mockResolvedValue({
      valid: true,
      signature: 'test-sig-abc',
    });

    const { port } = await startServer();

    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: { serializedTransaction: 'base64EncodedTx==' },
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    const res = await fetch(`http://localhost:${port}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': xPaymentHeader,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 on GET /health', async () => {
    const { port } = await startServer();

    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.agent).toBe('analyzer');
  });
});
