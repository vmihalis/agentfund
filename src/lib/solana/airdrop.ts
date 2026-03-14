/**
 * Airdrop SOL helpers for devnet wallet funding.
 *
 * Wraps connection.requestAirdrop() with retry logic and
 * balance checking. Uses web3.js types exclusively.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Airdrop SOL to a wallet with retry logic.
 *
 * Retries up to 3 times with exponential backoff (2s, 4s, 8s).
 * Confirms transaction after successful airdrop.
 *
 * @param connection - Solana Connection
 * @param publicKey - Target wallet public key
 * @param amountSol - Amount of SOL to airdrop
 * @returns true if airdrop succeeded, false otherwise
 */
export async function airdropSol(
  connection: Connection,
  publicKey: PublicKey,
  amountSol: number,
): Promise<boolean> {
  const lamports = amountSol * LAMPORTS_PER_SOL;
  const maxRetries = 3;
  let delay = 2000; // Start with 2s

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `  Airdrop attempt ${attempt}/${maxRetries}: ${amountSol} SOL to ${publicKey.toBase58()}`,
      );

      const signature = await connection.requestAirdrop(publicKey, lamports);

      // Wait for confirmation
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      console.log(`  Airdrop confirmed: ${signature}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`  Airdrop attempt ${attempt} failed: ${message}`);

      if (attempt < maxRetries) {
        console.log(`  Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }

  console.error(
    `  Airdrop failed after ${maxRetries} attempts for ${publicKey.toBase58()}`,
  );
  return false;
}

/**
 * Ensure a wallet has at least the minimum SOL balance.
 *
 * Checks current balance and airdrops if below minimum.
 * Logs current balance regardless.
 *
 * @param connection - Solana Connection
 * @param publicKey - Target wallet public key
 * @param minSol - Minimum SOL balance required
 * @returns Current balance in SOL after any airdrop attempt
 */
export async function ensureMinBalance(
  connection: Connection,
  publicKey: PublicKey,
  minSol: number,
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;

  console.log(
    `  Balance for ${publicKey.toBase58()}: ${balanceSol.toFixed(4)} SOL`,
  );

  if (balanceSol < minSol) {
    console.log(`  Below minimum (${minSol} SOL), requesting airdrop...`);
    const success = await airdropSol(connection, publicKey, 2);
    if (success) {
      const newBalance = await connection.getBalance(publicKey);
      const newBalanceSol = newBalance / LAMPORTS_PER_SOL;
      console.log(`  New balance: ${newBalanceSol.toFixed(4)} SOL`);
      return newBalanceSol;
    }
  }

  return balanceSol;
}
