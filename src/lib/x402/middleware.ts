/**
 * x402 Express Middleware
 *
 * Intercepts requests without a valid X-Payment header and returns
 * HTTP 402 with payment requirements. For requests with X-Payment,
 * verifies and settles the payment transaction, then calls next().
 */

import type { Request, Response, NextFunction } from 'express';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import type { X402Config, PaymentRequirements, PaymentProof } from './types.js';
import { verifyAndSettlePayment } from './verify.js';

/**
 * Create Express middleware that gates an endpoint behind x402 payment.
 *
 * Compute the recipient ATA once at middleware creation time.
 * On each request:
 *  - If no X-Payment header: return 402 with PaymentRequirements JSON
 *  - If X-Payment header: decode, verify, settle, then call next()
 *
 * On successful payment verification, attaches the transaction signature
 * to `(req as any).x402Signature` for downstream handlers.
 *
 * @param config - x402 server configuration
 * @returns Express middleware function
 */
export function x402Middleware(config: X402Config) {
  const recipientAta = getAssociatedTokenAddressSync(
    config.usdcMint,
    config.recipientWallet,
  );

  const paymentRequirements: PaymentRequirements = {
    x402Version: 1,
    scheme: 'exact',
    network: `solana-${config.cluster}`,
    payment: {
      recipientWallet: config.recipientWallet.toBase58(),
      tokenAccount: recipientAta.toBase58(),
      mint: config.usdcMint.toBase58(),
      amount: config.priceUsdc,
      amountUSDC: config.priceUsdc / 1_000_000,
    },
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const xPayment = req.header('X-Payment');

    if (!xPayment) {
      return res.status(402).json(paymentRequirements);
    }

    try {
      // Decode base64 X-Payment header to JSON PaymentProof
      const decoded = Buffer.from(xPayment, 'base64').toString('utf-8');
      const proof: PaymentProof = JSON.parse(decoded);

      const result = await verifyAndSettlePayment(
        config.connection,
        proof.payload.serializedTransaction,
        recipientAta.toBase58(),
        config.priceUsdc,
      );

      if (!result.valid) {
        return res.status(402).json({
          error: result.error ?? 'Payment verification failed',
          ...paymentRequirements,
        });
      }

      // Attach signature to request for downstream handlers
      (req as any).x402Signature = result.signature;
      next();
    } catch (err) {
      return res.status(402).json({
        error: err instanceof Error ? err.message : 'Payment processing error',
        ...paymentRequirements,
      });
    }
  };
}
