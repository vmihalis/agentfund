/**
 * x402 Transaction Verification and Settlement
 *
 * Verifies that a serialized Solana transaction contains a valid
 * SPL token transfer to the expected recipient ATA for at least
 * the expected amount, then simulates, submits, and confirms
 * the transaction on-chain.
 *
 * Source: Adapted from solana.com/developers/guides/getstarted/intro-to-x402
 */

import { Connection, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { VerifyResult } from './types.js';

/**
 * Verify and settle an x402 payment transaction.
 *
 * 1. Deserializes the base64-encoded transaction
 * 2. Scans instructions for a TOKEN_PROGRAM_ID transfer (opcode 3)
 * 3. Checks destination matches expectedRecipientAta
 * 4. Checks amount >= expectedMinAmount
 * 5. Simulates the transaction
 * 6. Submits via sendRawTransaction
 * 7. Confirms with 'confirmed' commitment
 *
 * @param connection - Solana RPC connection
 * @param serializedTx - Base64-encoded signed transaction
 * @param expectedRecipientAta - Expected destination token account (base58)
 * @param expectedMinAmount - Minimum transfer amount in base units
 * @returns VerifyResult with valid flag and optional signature or error
 */
export async function verifyAndSettlePayment(
  connection: Connection,
  serializedTx: string,
  expectedRecipientAta: string,
  expectedMinAmount: number,
): Promise<VerifyResult> {
  const txBuffer = Buffer.from(serializedTx, 'base64');
  const tx = Transaction.from(txBuffer);

  // 1. Verify SPL token transfer instruction
  let validTransfer = false;
  for (const ix of tx.instructions) {
    if (
      ix.programId.equals(TOKEN_PROGRAM_ID) &&
      ix.data.length >= 9 &&
      ix.data[0] === 3 // Transfer opcode
    ) {
      const amount = Number(ix.data.readBigUInt64LE(1));
      const dest = ix.keys[1]?.pubkey.toBase58();

      if (dest === expectedRecipientAta && amount >= expectedMinAmount) {
        validTransfer = true;
        break;
      }
    }
  }

  if (!validTransfer) {
    return { valid: false, error: 'Invalid transfer instruction' };
  }

  // 2. Simulate
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) {
    return { valid: false, error: `Simulation failed: ${JSON.stringify(sim.value.err)}` };
  }

  // 3. Submit
  const signature = await connection.sendRawTransaction(txBuffer, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // 4. Confirm
  const conf = await connection.confirmTransaction(signature, 'confirmed');
  if (conf.value.err) {
    return { valid: false, error: 'Transaction failed on-chain' };
  }

  return { valid: true, signature };
}
