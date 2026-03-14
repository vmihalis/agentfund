/**
 * Tests for x402Middleware (PAY-01, PAY-03).
 *
 * Verifies that the Express middleware:
 * - Returns 402 JSON with PaymentRequirements when no X-Payment header
 * - Calls next() when X-Payment header is valid (mocked verification)
 * - Returns 402 when X-Payment header contains invalid payment
 * - Attaches txSignature to req.x402Signature after successful verification
 *
 * All Solana and verification interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';

// --- Hoisted mock functions ---

const {
  mockGetAssociatedTokenAddressSync,
  mockVerifyAndSettlePayment,
} = vi.hoisted(() => ({
  mockGetAssociatedTokenAddressSync: vi.fn(),
  mockVerifyAndSettlePayment: vi.fn(),
}));

// --- Mock modules ---

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddressSync: mockGetAssociatedTokenAddressSync,
}));

vi.mock('../../src/lib/x402/verify.js', () => ({
  verifyAndSettlePayment: mockVerifyAndSettlePayment,
}));

// --- Tests ---

describe('x402Middleware (PAY-01, PAY-03)', () => {
  const recipientKeypair = Keypair.generate();
  const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  const mockAtaAddress = Keypair.generate().publicKey;

  let x402Middleware: typeof import('../../src/lib/x402/middleware.js').x402Middleware;

  // Mock Express req/res/next
  function createMockReq(headers: Record<string, string> = {}): any {
    return {
      header: (name: string) => headers[name],
    };
  }

  function createMockRes(): any {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock ATA derivation to return a known address
    mockGetAssociatedTokenAddressSync.mockReturnValue(mockAtaAddress);

    // Dynamic import after mocks
    const mod = await import('../../src/lib/x402/middleware.js');
    x402Middleware = mod.x402Middleware;
  });

  it('returns 402 JSON with correct PaymentRequirements when request has no X-Payment header', async () => {
    const config = {
      recipientWallet: recipientKeypair.publicKey,
      usdcMint,
      priceUsdc: 1000,
      connection: {} as any,
      cluster: 'devnet' as const,
    };

    const middleware = x402Middleware(config);

    const req = createMockReq(); // no X-Payment header
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payment: {
        recipientWallet: recipientKeypair.publicKey.toBase58(),
        tokenAccount: mockAtaAddress.toBase58(),
        mint: usdcMint.toBase58(),
        amount: 1000,
        amountUSDC: 0.001,
      },
    });
    expect(next).not.toHaveBeenCalled();
    expect(mockVerifyAndSettlePayment).not.toHaveBeenCalled();
  });

  it('calls next() when request has a valid X-Payment header', async () => {
    mockVerifyAndSettlePayment.mockResolvedValue({
      valid: true,
      signature: 'test-tx-sig-abc',
    });

    const config = {
      recipientWallet: recipientKeypair.publicKey,
      usdcMint,
      priceUsdc: 1000,
      connection: {} as any,
      cluster: 'devnet' as const,
    };

    const middleware = x402Middleware(config);

    // Create a valid X-Payment header (base64-encoded PaymentProof JSON)
    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: {
        serializedTransaction: 'base64EncodedTx==',
      },
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    const req = createMockReq({ 'X-Payment': xPaymentHeader });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(mockVerifyAndSettlePayment).toHaveBeenCalledWith(
      config.connection,
      'base64EncodedTx==',
      mockAtaAddress.toBase58(),
      1000,
    );
  });

  it('returns 402 when X-Payment header contains invalid/failing payment', async () => {
    mockVerifyAndSettlePayment.mockResolvedValue({
      valid: false,
      error: 'Invalid transfer instruction',
    });

    const config = {
      recipientWallet: recipientKeypair.publicKey,
      usdcMint,
      priceUsdc: 1000,
      connection: {} as any,
      cluster: 'devnet' as const,
    };

    const middleware = x402Middleware(config);

    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: {
        serializedTransaction: 'invalidTxData==',
      },
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    const req = createMockReq({ 'X-Payment': xPaymentHeader });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid transfer instruction',
        x402Version: 1,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches txSignature to req.x402Signature after successful verification', async () => {
    mockVerifyAndSettlePayment.mockResolvedValue({
      valid: true,
      signature: 'attached-sig-xyz',
    });

    const config = {
      recipientWallet: recipientKeypair.publicKey,
      usdcMint,
      priceUsdc: 1000,
      connection: {} as any,
      cluster: 'devnet' as const,
    };

    const middleware = x402Middleware(config);

    const paymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: 'solana-devnet',
      payload: {
        serializedTransaction: 'base64EncodedTx==',
      },
    };
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentProof)).toString('base64');

    const req = createMockReq({ 'X-Payment': xPaymentHeader });
    const res = createMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect((req as any).x402Signature).toBe('attached-sig-xyz');
    expect(next).toHaveBeenCalled();
  });
});
