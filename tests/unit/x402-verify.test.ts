/**
 * Tests for verifyAndSettlePayment (PAY-01, PAY-03).
 *
 * Verifies that the x402 transaction verification module:
 * - Rejects transactions with no SPL transfer to the expected recipient
 * - Rejects transactions where transfer amount is below the expected minimum
 * - Accepts and settles valid transactions with correct destination and amount
 *
 * All Solana interactions are mocked -- no real devnet calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// --- Hoisted mock functions (available before vi.mock factories) ---

const {
  mockSimulateTransaction,
  mockSendRawTransaction,
  mockConfirmTransaction,
} = vi.hoisted(() => ({
  mockSimulateTransaction: vi.fn(),
  mockSendRawTransaction: vi.fn(),
  mockConfirmTransaction: vi.fn(),
}));

// --- Helper: Build a mock serialized transaction with SPL transfer instruction ---

function buildMockTransferTx(
  destination: PublicKey,
  amount: bigint,
  feePayer: Keypair,
): string {
  // Build a real Transaction with a minimal SPL Token Transfer instruction
  // Transfer opcode = 3, followed by u64 LE amount
  const data = Buffer.alloc(9);
  data[0] = 3; // Transfer opcode
  data.writeBigUInt64LE(amount, 1);

  const sourcePubkey = Keypair.generate().publicKey;

  const tx = new Transaction();
  tx.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi';
  tx.feePayer = feePayer.publicKey;
  tx.add({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: sourcePubkey, isSigner: false, isWritable: true },      // source ATA
      { pubkey: destination, isSigner: false, isWritable: true },        // dest ATA
      { pubkey: feePayer.publicKey, isSigner: true, isWritable: false }, // authority
    ],
    data,
  });

  tx.sign(feePayer);

  return tx.serialize().toString('base64');
}

function buildMockNonTransferTx(feePayer: Keypair): string {
  // Build a transaction with a non-transfer instruction (opcode != 3)
  const data = Buffer.alloc(9);
  data[0] = 7; // Not a Transfer opcode

  const tx = new Transaction();
  tx.recentBlockhash = 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi';
  tx.feePayer = feePayer.publicKey;
  tx.add({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
      { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
      { pubkey: feePayer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  });

  tx.sign(feePayer);

  return tx.serialize().toString('base64');
}

// --- Tests ---

describe('verifyAndSettlePayment (PAY-01, PAY-03)', () => {
  const feePayer = Keypair.generate();
  const recipientAta = Keypair.generate().publicKey;
  const expectedRecipientAta = recipientAta.toBase58();
  const expectedMinAmount = 1000; // 0.001 USDC

  let verifyAndSettlePayment: typeof import('../../src/lib/x402/verify.js').verifyAndSettlePayment;

  const mockConnection = {
    simulateTransaction: mockSimulateTransaction,
    sendRawTransaction: mockSendRawTransaction,
    confirmTransaction: mockConfirmTransaction,
  } as any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default happy-path mocks
    mockSimulateTransaction.mockResolvedValue({ value: { err: null } });
    mockSendRawTransaction.mockResolvedValue('mock-tx-signature-123');
    mockConfirmTransaction.mockResolvedValue({ value: { err: null } });

    // Dynamic import after mocks
    const mod = await import('../../src/lib/x402/verify.js');
    verifyAndSettlePayment = mod.verifyAndSettlePayment;
  });

  it('returns invalid when transaction has no SPL transfer instruction to expected recipient', async () => {
    const wrongRecipient = Keypair.generate().publicKey;
    const serializedTx = buildMockTransferTx(wrongRecipient, BigInt(5000), feePayer);

    const result = await verifyAndSettlePayment(
      mockConnection,
      serializedTx,
      expectedRecipientAta,
      expectedMinAmount,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid transfer instruction');
    // Should not have attempted simulation or submission
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
    expect(mockSendRawTransaction).not.toHaveBeenCalled();
  });

  it('returns invalid when transfer amount is less than expected minimum', async () => {
    const serializedTx = buildMockTransferTx(recipientAta, BigInt(500), feePayer);

    const result = await verifyAndSettlePayment(
      mockConnection,
      serializedTx,
      expectedRecipientAta,
      expectedMinAmount,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid transfer instruction');
    expect(mockSimulateTransaction).not.toHaveBeenCalled();
  });

  it('returns invalid when transaction has non-transfer instruction only', async () => {
    const serializedTx = buildMockNonTransferTx(feePayer);

    const result = await verifyAndSettlePayment(
      mockConnection,
      serializedTx,
      expectedRecipientAta,
      expectedMinAmount,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid transfer instruction');
  });

  it('extracts correct destination and amount from valid transfer and settles on-chain', async () => {
    const serializedTx = buildMockTransferTx(recipientAta, BigInt(5000), feePayer);

    const result = await verifyAndSettlePayment(
      mockConnection,
      serializedTx,
      expectedRecipientAta,
      expectedMinAmount,
    );

    expect(result.valid).toBe(true);
    expect(result.signature).toBe('mock-tx-signature-123');
    expect(mockSimulateTransaction).toHaveBeenCalledTimes(1);
    expect(mockSendRawTransaction).toHaveBeenCalledTimes(1);
    expect(mockConfirmTransaction).toHaveBeenCalledWith('mock-tx-signature-123', 'confirmed');
  });

  it('returns invalid when simulation fails', async () => {
    mockSimulateTransaction.mockResolvedValue({
      value: { err: { InstructionError: [0, 'InsufficientFunds'] } },
    });

    const serializedTx = buildMockTransferTx(recipientAta, BigInt(5000), feePayer);

    const result = await verifyAndSettlePayment(
      mockConnection,
      serializedTx,
      expectedRecipientAta,
      expectedMinAmount,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Simulation failed');
    expect(mockSendRawTransaction).not.toHaveBeenCalled();
  });

  it('returns invalid when on-chain confirmation fails', async () => {
    mockConfirmTransaction.mockResolvedValue({
      value: { err: 'TransactionFailed' },
    });

    const serializedTx = buildMockTransferTx(recipientAta, BigInt(5000), feePayer);

    const result = await verifyAndSettlePayment(
      mockConnection,
      serializedTx,
      expectedRecipientAta,
      expectedMinAmount,
    );

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Transaction failed on-chain');
  });
});
