/**
 * Treasury data utilities.
 *
 * Extracted as pure functions for testability.
 */

import type { TreasuryData } from './types';

/** Demo fallback data when voice server is not running. */
export const TREASURY_FALLBACK: TreasuryData = {
  solBalance: 1.5,
  usdcBalance: 100,
  totalValueUsd: 325,
  lpPositions: [],
};

/**
 * Parse voice server response into TreasuryData shape.
 *
 * The voice server returns a VoiceResult with a `data` field
 * that may contain treasury balance information.
 */
export function parseTreasuryResponse(voiceResult: unknown): TreasuryData {
  if (!voiceResult || typeof voiceResult !== 'object') {
    return TREASURY_FALLBACK;
  }

  const result = voiceResult as Record<string, unknown>;
  const data = result.data as Record<string, unknown> | undefined;

  if (!data) {
    return TREASURY_FALLBACK;
  }

  return {
    solBalance: typeof data.solBalance === 'number' ? data.solBalance : TREASURY_FALLBACK.solBalance,
    usdcBalance: typeof data.usdcBalance === 'number' ? data.usdcBalance : TREASURY_FALLBACK.usdcBalance,
    totalValueUsd: typeof data.totalValueUsd === 'number' ? data.totalValueUsd : TREASURY_FALLBACK.totalValueUsd,
    lpPositions: Array.isArray(data.lpPositions) ? data.lpPositions : [],
  };
}
