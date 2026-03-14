/**
 * x402 Payment Protocol Types
 *
 * Defines interfaces for the x402 HTTP payment protocol:
 * server configuration, payment requirements (402 response body),
 * payment proof (X-Payment header), verification results,
 * and client wrapper options.
 */

import type { Connection, Keypair, PublicKey } from '@solana/web3.js';

/** Server-side x402 middleware configuration. */
export interface X402Config {
  /** Wallet public key of the service provider (payment recipient). */
  recipientWallet: PublicKey;
  /** USDC SPL token mint address. */
  usdcMint: PublicKey;
  /** Price in base units (1 USDC = 1_000_000). */
  priceUsdc: number;
  /** Solana RPC connection. */
  connection: Connection;
  /** Solana cluster identifier. */
  cluster: 'devnet' | 'mainnet-beta';
}

/** 402 response body describing payment requirements. */
export interface PaymentRequirements {
  x402Version: 1;
  scheme: 'exact';
  network: string;
  payment: {
    recipientWallet: string;
    tokenAccount: string;
    mint: string;
    amount: number;
    amountUSDC: number;
  };
}

/** Decoded X-Payment header containing the signed transaction. */
export interface PaymentProof {
  x402Version: 1;
  scheme: 'exact';
  network: string;
  payload: {
    serializedTransaction: string;
  };
}

/** Result of server-side payment verification and settlement. */
export interface VerifyResult {
  valid: boolean;
  signature?: string;
  error?: string;
}

/** Options for the client-side wrapFetch payment wrapper. */
export interface WrapFetchOptions {
  /** Agent keypair used to sign payment transactions. */
  keypair: Keypair;
  /** Solana RPC connection for blockhash and submission. */
  connection: Connection;
  /** USDC SPL token mint address. */
  usdcMint: PublicKey;
  /** Maximum payment in base units. Throws if exceeded. */
  maxPaymentUsdc?: number;
}
