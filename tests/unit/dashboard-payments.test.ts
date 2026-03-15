/**
 * Unit tests for dashboard payment history data.
 *
 * Tests the pure functions in dashboard/src/lib/payments.ts
 * without needing the Next.js runtime.
 */

import { describe, it, expect } from 'vitest';
import {
  getDemoPayments,
  buildTxUrl,
  isValidPaymentRecord,
} from '../../dashboard/src/lib/payments.js';

describe('Dashboard Payments API', () => {
  describe('getDemoPayments', () => {
    it('returns an array of payment records', () => {
      const payments = getDemoPayments();
      expect(Array.isArray(payments)).toBe(true);
      expect(payments.length).toBeGreaterThanOrEqual(3);
    });

    it('each record has all required fields', () => {
      const payments = getDemoPayments();
      for (const p of payments) {
        expect(typeof p.timestamp).toBe('string');
        expect(typeof p.from).toBe('string');
        expect(typeof p.to).toBe('string');
        expect(typeof p.amount).toBe('number');
        expect(typeof p.service).toBe('string');
        expect(typeof p.txSignature).toBe('string');
        expect(typeof p.txUrl).toBe('string');
      }
    });

    it('txUrl contains solscan.io/tx/', () => {
      const payments = getDemoPayments();
      for (const p of payments) {
        expect(p.txUrl).toContain('solscan.io/tx/');
      }
    });

    it('amounts match x402 pricing (0.001 or 0.002)', () => {
      const payments = getDemoPayments();
      for (const p of payments) {
        expect([0.001, 0.002]).toContain(p.amount);
      }
    });

    it('uses devnet cluster in tx URLs', () => {
      const payments = getDemoPayments();
      for (const p of payments) {
        expect(p.txUrl).toContain('?cluster=devnet');
      }
    });
  });

  describe('buildTxUrl', () => {
    it('constructs correct Solscan devnet tx URL', () => {
      const url = buildTxUrl('abc123');
      expect(url).toBe('https://solscan.io/tx/abc123?cluster=devnet');
    });
  });

  describe('isValidPaymentRecord', () => {
    it('returns true for valid record', () => {
      const record = {
        timestamp: '2026-03-14T10:30:00Z',
        from: 'governance',
        to: 'scout',
        amount: 0.001,
        service: 'Discovery',
        txSignature: 'abc',
        txUrl: 'https://solscan.io/tx/abc?cluster=devnet',
      };
      expect(isValidPaymentRecord(record)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isValidPaymentRecord(null)).toBe(false);
    });

    it('returns false for missing fields', () => {
      expect(isValidPaymentRecord({ from: 'scout' })).toBe(false);
    });
  });
});
