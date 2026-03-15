/**
 * Dashboard-specific types.
 *
 * These replicate backend shapes but are independent of the root src/
 * module resolution. Next.js has its own tsconfig and module system.
 */

export interface AgentInfo {
  role: string;
  name: string;
  description: string;
  publicKey: string;
  solscanUrl: string;
}

export interface LPPositionData {
  poolAddress: string;
  positionAddress: string;
  tokenX: string;
  tokenY: string;
  liquidityShare: number;
  unclaimedFees: number;
}

export interface TreasuryData {
  solBalance: number;
  usdcBalance: number;
  totalValueUsd: number;
  lpPositions: LPPositionData[];
}

export interface PaymentRecord {
  timestamp: string;
  from: string;
  to: string;
  amount: number;
  service: string;
  txSignature: string;
  txUrl: string;
}
