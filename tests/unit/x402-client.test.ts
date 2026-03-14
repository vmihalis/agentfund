/**
 * Tests for wrapFetchWithPayment (PAY-04).
 *
 * Verifies that the x402 fetch wrapper:
 * - Passes through non-402 responses unchanged
 * - On 402 creates an SPL transfer, signs it, encodes as X-Payment header, and retries
 * - Throws when payment amount exceeds maxPaymentUsdc safety cap
 *
 * All Solana interactions are mocked -- no real devnet calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';

// --- Hoisted mock functions ---

const {
  mockGetAssociatedTokenAddressSync,
  mockCreateTransferInstruction,
} = vi.hoisted(() => ({
  mockGetAssociatedTokenAddressSync: vi.fn(),
  mockCreateTransferInstruction: vi.fn(),
}));

// --- Mock modules ---

vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddressSync: mockGetAssociatedTokenAddressSync,
  createTransferInstruction: mockCreateTransferInstruction,
}));

// --- Helper: Build mock 402 response ---

function make402Response(payment: {
  recipientWallet: string;
  tokenAccount: string;
  mint: string;
  amount: number;
  amountUSDC: number;
}): Response {
  const body = JSON.stringify({
    x402Version: 1,
    scheme: 'exact',
    network: 'solana-devnet',
    payment,
  });

  return new Response(body, {
    status: 402,
    headers: { 'Content-Type': 'application/json' },
  });
}

function make200Response(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Tests ---

describe('wrapFetchWithPayment (PAY-04)', () => {
  const payerKeypair = Keypair.generate();
  const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  const payerAta = Keypair.generate().publicKey;
  const destAta = Keypair.generate().publicKey;

  const mockConnection = {
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
      lastValidBlockHeight: 12345,
    }),
  } as any;

  let wrapFetchWithPayment: typeof import('../../src/lib/x402/client.js').wrapFetchWithPayment;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock ATA derivation
    mockGetAssociatedTokenAddressSync.mockReturnValue(payerAta);

    // Mock createTransferInstruction to return a minimal instruction
    // We need to return something that Transaction.add() will accept
    mockCreateTransferInstruction.mockReturnValue({
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      keys: [
        { pubkey: payerAta, isSigner: false, isWritable: true },
        { pubkey: destAta, isSigner: false, isWritable: true },
        { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.alloc(9), // Minimal transfer instruction data
    });

    // Dynamic import after mocks
    const mod = await import('../../src/lib/x402/client.js');
    wrapFetchWithPayment = mod.wrapFetchWithPayment;
  });

  it('passes through non-402 responses unchanged', async () => {
    const mockFetch = vi.fn().mockResolvedValue(make200Response({ data: 'hello' }));

    const wrappedFetch = wrapFetchWithPayment(mockFetch, {
      keypair: payerKeypair,
      connection: mockConnection,
      usdcMint,
    });

    const result = await wrappedFetch('https://example.com/api');

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.data).toBe('hello');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockConnection.getLatestBlockhash).not.toHaveBeenCalled();
  });

  it('on 402 response creates SPL transfer, signs it, encodes as X-Payment header, and retries', async () => {
    const recipientWallet = Keypair.generate().publicKey.toBase58();
    const destAtaStr = destAta.toBase58();

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        make402Response({
          recipientWallet,
          tokenAccount: destAtaStr,
          mint: usdcMint.toBase58(),
          amount: 1000,
          amountUSDC: 0.001,
        }),
      )
      .mockResolvedValueOnce(make200Response({ result: 'paid content' }));

    const wrappedFetch = wrapFetchWithPayment(mockFetch, {
      keypair: payerKeypair,
      connection: mockConnection,
      usdcMint,
    });

    const result = await wrappedFetch('https://example.com/gated');

    // Should have called fetch twice (original + retry)
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should include X-Payment header
    const retryCall = mockFetch.mock.calls[1];
    const retryInit = retryCall[1] as RequestInit;
    expect(retryInit.headers).toHaveProperty('X-Payment');

    // Verify the X-Payment header is valid base64-encoded PaymentProof JSON
    const xPaymentHeader = (retryInit.headers as Record<string, string>)['X-Payment'];
    const decoded = JSON.parse(Buffer.from(xPaymentHeader, 'base64').toString('utf-8'));
    expect(decoded.x402Version).toBe(1);
    expect(decoded.scheme).toBe('exact');
    expect(decoded.payload.serializedTransaction).toBeTruthy();

    // Verify createTransferInstruction was called correctly
    expect(mockCreateTransferInstruction).toHaveBeenCalledWith(
      payerAta,
      expect.any(PublicKey),
      payerKeypair.publicKey,
      1000,
    );

    // Verify blockhash was fetched
    expect(mockConnection.getLatestBlockhash).toHaveBeenCalledTimes(1);

    // Result should be the retry response (200)
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.result).toBe('paid content');
  });

  it('throws when payment amount exceeds maxPaymentUsdc safety cap', async () => {
    const recipientWallet = Keypair.generate().publicKey.toBase58();
    const destAtaStr = destAta.toBase58();

    const mockFetch = vi.fn().mockResolvedValue(
      make402Response({
        recipientWallet,
        tokenAccount: destAtaStr,
        mint: usdcMint.toBase58(),
        amount: 5000, // 0.005 USDC
        amountUSDC: 0.005,
      }),
    );

    const wrappedFetch = wrapFetchWithPayment(mockFetch, {
      keypair: payerKeypair,
      connection: mockConnection,
      usdcMint,
      maxPaymentUsdc: 2000, // Safety cap at 0.002 USDC
    });

    await expect(wrappedFetch('https://example.com/expensive'))
      .rejects.toThrow('Payment 5000 exceeds max 2000');

    // Should only have called fetch once (the initial 402)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Should NOT have built a transaction
    expect(mockConnection.getLatestBlockhash).not.toHaveBeenCalled();
    expect(mockCreateTransferInstruction).not.toHaveBeenCalled();
  });

  it('passes through existing headers on retry request', async () => {
    const recipientWallet = Keypair.generate().publicKey.toBase58();
    const destAtaStr = destAta.toBase58();

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        make402Response({
          recipientWallet,
          tokenAccount: destAtaStr,
          mint: usdcMint.toBase58(),
          amount: 1000,
          amountUSDC: 0.001,
        }),
      )
      .mockResolvedValueOnce(make200Response({ result: 'ok' }));

    const wrappedFetch = wrapFetchWithPayment(mockFetch, {
      keypair: payerKeypair,
      connection: mockConnection,
      usdcMint,
    });

    await wrappedFetch('https://example.com/gated', {
      headers: { 'Authorization': 'Bearer token123' },
    });

    const retryCall = mockFetch.mock.calls[1];
    const retryHeaders = (retryCall[1] as RequestInit).headers as Record<string, string>;
    expect(retryHeaders['Authorization']).toBe('Bearer token123');
    expect(retryHeaders['X-Payment']).toBeTruthy();
  });
});
