/**
 * ATA creation and balance checking.
 *
 * Provides helpers for creating Associated Token Accounts and
 * checking token balances. Uses web3.js and SPL token library only.
 * No Umi types are imported here.
 */

import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
  createMint,
  mintTo,
  type Account as TokenAccount,
} from '@solana/spl-token';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

/** Devnet USDC mint address (Circle-controlled, cannot mint from it) */
export const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

/**
 * Load the active USDC mint from addresses.json (DEMO_USDC or official).
 *
 * Falls back to DEVNET_USDC_MINT if addresses.json doesn't exist or
 * has no usdcMint set. This ensures the server and client use the
 * same mint that fund-wallets.ts provisioned.
 */
export function getActiveUsdcMint(): PublicKey {
  const addressesPath = path.join(process.cwd(), 'keys', 'addresses.json');
  if (fs.existsSync(addressesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));
      if (data.usdcMint) {
        return new PublicKey(data.usdcMint);
      }
    } catch {
      // Fall through to default
    }
  }
  return DEVNET_USDC_MINT;
}

/**
 * Create or retrieve an Associated Token Account for an agent.
 *
 * @param connection - Solana Connection
 * @param payer - Fee payer Keypair
 * @param agentPubkey - The agent wallet's public key (ATA owner)
 * @param mint - Token mint (defaults to devnet USDC)
 * @returns The ATA account info
 */
export async function createAgentTokenAccount(
  connection: Connection,
  payer: Keypair,
  agentPubkey: PublicKey,
  mint: PublicKey = DEVNET_USDC_MINT,
): Promise<TokenAccount> {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    agentPubkey,
  );

  console.log(`ATA: ${ata.address.toBase58()} | Owner: ${agentPubkey.toBase58()}`);
  return ata;
}

/**
 * Get the token balance for an Associated Token Account.
 *
 * @param connection - Solana Connection
 * @param ataAddress - The ATA public key
 * @returns Token balance as a number (with decimal adjustment for 6-decimal tokens)
 */
export async function getTokenBalance(
  connection: Connection,
  ataAddress: PublicKey,
): Promise<number> {
  const account = await getAccount(connection, ataAddress);
  // Assume 6 decimals (USDC standard)
  return Number(account.amount) / 1_000_000;
}

/**
 * Create a custom DEMO_USDC SPL token mint.
 *
 * Fallback when devnet USDC mint is not distributable.
 * Creates a token with 6 decimals and deployer as mint authority.
 *
 * @param connection - Solana Connection
 * @param deployer - Deployer Keypair (becomes mint authority)
 * @returns The mint public key
 */
export async function createDemoUSDCMint(
  connection: Connection,
  deployer: Keypair,
): Promise<PublicKey> {
  const mint = await createMint(
    connection,
    deployer,
    deployer.publicKey, // mint authority
    null, // freeze authority
    6, // decimals (USDC standard)
  );

  console.log(`DEMO_USDC mint created: ${mint.toBase58()}`);
  return mint;
}

/**
 * Mint DEMO_USDC tokens to an Associated Token Account.
 *
 * @param connection - Solana Connection
 * @param deployer - Deployer Keypair (must be mint authority)
 * @param mint - The token mint public key
 * @param destinationAta - The destination ATA address
 * @param amount - Amount in token units (e.g., 1000 = 1000 USDC)
 */
export async function mintDemoUSDC(
  connection: Connection,
  deployer: Keypair,
  mint: PublicKey,
  destinationAta: PublicKey,
  amount: number,
): Promise<void> {
  const amountWithDecimals = amount * 1_000_000; // 6 decimals

  await mintTo(
    connection,
    deployer,
    mint,
    destinationAta,
    deployer, // mint authority
    amountWithDecimals,
  );

  console.log(`Minted ${amount} DEMO_USDC to ${destinationAta.toBase58()}`);
}
