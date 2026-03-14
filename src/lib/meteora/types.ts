/**
 * DLMM-specific type definitions for Meteora LP position management.
 *
 * Used by DlmmClient and TreasuryAgent for DLMM pool interactions.
 * Phase 5 Plan 2: TREAS-03, TREAS-04.
 */

export interface DlmmPosition {
  positionAddress: string;
  poolAddress: string;
  binIds: number[];
  liquidityShares: string[]; // BN string representations
}

export interface DlmmPoolInfo {
  poolAddress: string;
  tokenX: string;
  tokenY: string;
  activeBinId: number;
  binStep: number;
}

export interface DlmmResult<T = void> {
  success: boolean;
  data?: T;
  signatures?: string[];
  error?: string;
}
