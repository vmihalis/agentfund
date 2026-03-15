/**
 * Dashboard-specific types.
 *
 * These replicate backend shapes but are independent of the root src/
 * module resolution. Next.js has its own tsconfig and module system.
 */

export interface MetaplexIdentity {
  assetAddress: string;
  pdaAddress: string;
  verified: boolean;
  assetUrl: string;
  pdaUrl: string;
  collectionAddress: string;
}

export interface AgentInfo {
  role: string;
  name: string;
  description: string;
  publicKey: string;
  solscanUrl: string;
  metaplex?: MetaplexIdentity;
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

/** Pipeline stage a proposal can be in. */
export type PipelineStage = 'submitted' | 'evaluating' | 'approved' | 'funded';

/** A proposal moving through the funding pipeline. */
export interface PipelineProposal {
  id: string;
  title: string;
  stage: PipelineStage;
  updatedAt: number;
  evaluation?: {
    overallScore: number;
    recommendation: string;
    reasoning: string;
  };
}

/** Result from a voice/text command. */
export interface VoiceResult {
  success: boolean;
  intent: string;
  message: string;
  data?: unknown;
}

/** Data submitted when creating a new funding proposal. */
export interface ProposalSubmission {
  title: string;
  description: string;
  requestedAmount: number;
  teamInfo: string;
}
