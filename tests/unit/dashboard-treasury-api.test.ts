/**
 * Unit tests for dashboard treasury data logic.
 *
 * Tests the pure functions in dashboard/src/lib/treasury.ts
 * without needing the Next.js runtime.
 */

import { describe, it, expect } from 'vitest';
import { parseTreasuryResponse, TREASURY_FALLBACK } from '../../dashboard/src/lib/treasury.js';

describe('Dashboard Treasury API', () => {
  describe('parseTreasuryResponse', () => {
    it('returns TreasuryData shape with valid voice response', () => {
      const voiceResult = {
        data: {
          solBalance: 2.5,
          usdcBalance: 200,
          totalValueUsd: 575,
          lpPositions: [],
        },
      };
      const result = parseTreasuryResponse(voiceResult);
      expect(result.solBalance).toBe(2.5);
      expect(result.usdcBalance).toBe(200);
      expect(result.totalValueUsd).toBe(575);
      expect(result.lpPositions).toEqual([]);
    });

    it('returns fallback on null input', () => {
      const result = parseTreasuryResponse(null);
      expect(result).toEqual(TREASURY_FALLBACK);
    });

    it('returns fallback on missing data field', () => {
      const result = parseTreasuryResponse({ message: 'no data' });
      expect(result).toEqual(TREASURY_FALLBACK);
    });

    it('returns fallback for non-object input', () => {
      const result = parseTreasuryResponse('string');
      expect(result).toEqual(TREASURY_FALLBACK);
    });

    it('uses fallback values for missing numeric fields', () => {
      const result = parseTreasuryResponse({ data: { solBalance: 3.0 } });
      expect(result.solBalance).toBe(3.0);
      expect(result.usdcBalance).toBe(TREASURY_FALLBACK.usdcBalance);
      expect(result.totalValueUsd).toBe(TREASURY_FALLBACK.totalValueUsd);
    });
  });

  describe('TREASURY_FALLBACK', () => {
    it('has correct shape with all required fields', () => {
      expect(typeof TREASURY_FALLBACK.solBalance).toBe('number');
      expect(typeof TREASURY_FALLBACK.usdcBalance).toBe('number');
      expect(typeof TREASURY_FALLBACK.totalValueUsd).toBe('number');
      expect(Array.isArray(TREASURY_FALLBACK.lpPositions)).toBe(true);
    });

    it('has demo values', () => {
      expect(TREASURY_FALLBACK.solBalance).toBe(1.5);
      expect(TREASURY_FALLBACK.usdcBalance).toBe(100);
      expect(TREASURY_FALLBACK.totalValueUsd).toBe(325);
    });
  });
});
