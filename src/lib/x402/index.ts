/**
 * x402 Payment Protocol - Public API
 *
 * Barrel export for x402 types, verification, middleware, and client.
 */

export type {
  X402Config,
  PaymentRequirements,
  PaymentProof,
  VerifyResult,
  WrapFetchOptions,
} from './types.js';

export { verifyAndSettlePayment } from './verify.js';
