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
  addLivePayment,
  getAllPayments,
} from '../../dashboard/src/lib/payments.js';
import type { PaymentRecord } from '../../dashboard/src/lib/types.js';

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

  describe('addLivePayment', () => {
    it('adds a payment record that appears in getAllPayments', () => {
      const demoCount = getDemoPayments().length;
      const livePayment: PaymentRecord = {
        timestamp: '2026-03-15T12:00:00Z',
        from: 'governance',
        to: 'scout',
        amount: 0.001,
        service: 'Live Discovery',
        txSignature: 'live-tx-001',
        txUrl: buildTxUrl('live-tx-001'),
      };
      addLivePayment(livePayment);
      expect(getAllPayments().length).toBe(demoCount + 1);
    });

    it('accumulates multiple live payments', () => {
      const beforeCount = getAllPayments().length;
      const secondPayment: PaymentRecord = {
        timestamp: '2026-03-15T12:01:00Z',
        from: 'governance',
        to: 'analyzer',
        amount: 0.002,
        service: 'Live Analysis',
        txSignature: 'live-tx-002',
        txUrl: buildTxUrl('live-tx-002'),
      };
      addLivePayment(secondPayment);
      expect(getAllPayments().length).toBe(beforeCount + 1);
    });
  });

  describe('getAllPayments', () => {
    it('returns demo payments when accessed (always includes demos)', () => {
      const all = getAllPayments();
      const demos = getDemoPayments();
      // All demo payments should be at the start of the returned array
      for (let i = 0; i < demos.length; i++) {
        expect(all[i].txSignature).toBe(demos[i].txSignature);
      }
    });

    it('includes live payments after demo payments', () => {
      const all = getAllPayments();
      const demoCount = getDemoPayments().length;
      // We added 2 live payments in the addLivePayment tests above
      expect(all.length).toBeGreaterThan(demoCount);
      // Live payments should appear after demo entries
      const liveEntries = all.slice(demoCount);
      expect(liveEntries.some((p) => p.txSignature === 'live-tx-001')).toBe(true);
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
