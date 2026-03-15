/**
 * Payment history data utilities.
 *
 * Provides demo payment data and validation for testability.
 */

import type { PaymentRecord } from './types';

/**
 * Build a Solscan devnet transaction URL.
 */
export function buildTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}

/**
 * Demo x402 payment history data.
 *
 * Static data representing example inter-agent payments.
 * In production these would come from on-chain indexing.
 */
export function getDemoPayments(): PaymentRecord[] {
  return [
    {
      timestamp: '2026-03-14T10:30:00Z',
      from: 'governance',
      to: 'scout',
      amount: 0.001,
      service: 'Proposal Discovery',
      txSignature: '4vJ9jDsQhcYQ2HFhqLGzTnWCbTPKkMpCkjhPxdY8SvNf',
      txUrl: buildTxUrl('4vJ9jDsQhcYQ2HFhqLGzTnWCbTPKkMpCkjhPxdY8SvNf'),
    },
    {
      timestamp: '2026-03-14T10:31:00Z',
      from: 'governance',
      to: 'analyzer',
      amount: 0.002,
      service: 'Proposal Analysis',
      txSignature: '3kR8nBxQwZYp7Hf2cMdW5N9tEvXrUaLjPqRmFy6G8hKe',
      txUrl: buildTxUrl('3kR8nBxQwZYp7Hf2cMdW5N9tEvXrUaLjPqRmFy6G8hKe'),
    },
    {
      timestamp: '2026-03-14T11:15:00Z',
      from: 'governance',
      to: 'scout',
      amount: 0.001,
      service: 'Proposal Discovery',
      txSignature: '5wK2mCxRvAYq8Jg3dNeX6P0uFwYsVbMkQsSnGz7H9iLf',
      txUrl: buildTxUrl('5wK2mCxRvAYq8Jg3dNeX6P0uFwYsVbMkQsSnGz7H9iLf'),
    },
    {
      timestamp: '2026-03-14T11:16:00Z',
      from: 'governance',
      to: 'analyzer',
      amount: 0.002,
      service: 'Proposal Analysis',
      txSignature: '2xL3nDySwBZr9Kh4eOgY7Q1vGxZtWcNlRtUoHz8I0jMg',
      txUrl: buildTxUrl('2xL3nDySwBZr9Kh4eOgY7Q1vGxZtWcNlRtUoHz8I0jMg'),
    },
  ];
}

/**
 * Validate that a PaymentRecord has the expected shape.
 */
export function isValidPaymentRecord(record: unknown): record is PaymentRecord {
  if (!record || typeof record !== 'object') return false;
  const r = record as Record<string, unknown>;
  return (
    typeof r.timestamp === 'string' &&
    typeof r.from === 'string' &&
    typeof r.to === 'string' &&
    typeof r.amount === 'number' &&
    typeof r.service === 'string' &&
    typeof r.txSignature === 'string' &&
    typeof r.txUrl === 'string'
  );
}
