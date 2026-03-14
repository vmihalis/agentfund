/**
 * x402 Client - wrapFetch Payment Wrapper
 *
 * Wraps a standard fetch function to automatically handle HTTP 402
 * responses by creating an SPL token transfer, signing it, and
 * retrying the request with an X-Payment header.
 */

import { PublicKey, Transaction } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { PaymentRequirements, PaymentProof, WrapFetchOptions } from './types.js';

/**
 * Wrap a fetch function with automatic x402 payment handling.
 *
 * On non-402 responses, passes through unchanged.
 * On 402 responses:
 *  1. Parses PaymentRequirements from response JSON
 *  2. Checks amount against maxPaymentUsdc safety cap
 *  3. Creates an SPL transfer transaction
 *  4. Signs the transaction with the provided keypair
 *  5. Encodes as PaymentProof in X-Payment header
 *  6. Retries the original request with the payment header
 *
 * @param baseFetch - The underlying fetch function to wrap
 * @param options - Payment configuration (keypair, connection, mint, max cap)
 * @returns A new fetch function with x402 payment support
 */
export function wrapFetchWithPayment(
  baseFetch: typeof fetch,
  options: WrapFetchOptions,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await baseFetch(input, init);

    if (response.status !== 402) {
      return response;
    }

    // Parse payment requirements from 402 response
    const requirements: PaymentRequirements = await response.json();
    const { tokenAccount, amount } = requirements.payment;

    // Safety cap check
    if (options.maxPaymentUsdc !== undefined && amount > options.maxPaymentUsdc) {
      throw new Error(
        `Payment ${amount} exceeds max ${options.maxPaymentUsdc}`,
      );
    }

    // Build SPL transfer transaction
    const payerAta = getAssociatedTokenAddressSync(
      options.usdcMint,
      options.keypair.publicKey,
    );
    const destAta = new PublicKey(tokenAccount);

    const { blockhash, lastValidBlockHeight } =
      await options.connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: options.keypair.publicKey,
      blockhash,
      lastValidBlockHeight,
    });

    tx.add(
      createTransferInstruction(
        payerAta,
        destAta,
        options.keypair.publicKey,
        amount,
      ),
    );

    tx.sign(options.keypair);

    // Encode as X-Payment header
    const paymentProof: PaymentProof = {
      x402Version: 1,
      scheme: 'exact',
      network: requirements.network,
      payload: {
        serializedTransaction: tx.serialize().toString('base64'),
      },
    };

    const xPaymentHeader = Buffer.from(
      JSON.stringify(paymentProof),
    ).toString('base64');

    // Retry with payment
    return baseFetch(input, {
      ...init,
      headers: {
        ...((init?.headers as Record<string, string>) ?? {}),
        'X-Payment': xPaymentHeader,
      },
    });
  };
}
