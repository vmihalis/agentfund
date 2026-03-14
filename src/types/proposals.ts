/**
 * Domain types for the funding pipeline.
 *
 * Proposal, Evaluation, FundingAllocation, DecisionSummary,
 * TransactionResult, and TreasuryBalance types used by all agents.
 */

export interface Proposal {
  id: string;
  title: string;
  description: string;
  requestedAmount: number;
  teamInfo: string;
  sourceUrl?: string;
}

export interface EvaluationScores {
  teamQuality: number; // 1-10
  technicalFeasibility: number; // 1-10
  impactPotential: number; // 1-10
  budgetReasonableness: number; // 1-10
}

export interface Evaluation {
  proposalId: string;
  proposalTitle: string;
  scores: EvaluationScores;
  overallScore: number; // Weighted average
  reasoning: string; // Human-readable explanation
  recommendation: 'fund' | 'reject' | 'defer';
}

export interface FundingAllocation {
  proposalId: string;
  proposalTitle: string;
  action: 'fund' | 'reject' | 'defer';
  amount?: number; // In USDC (6 decimals)
  reasoning: string;
}

export interface DecisionSummary {
  timestamp: number;
  summary: string; // Overall narrative
  allocations: FundingAllocation[];
  totalAllocated: number;
  remainingBudget: number;
}

export interface TransactionResult {
  success: boolean;
  signature?: string; // Solana tx signature
  error?: string;
}

export interface LPPosition {
  poolAddress: string;
  positionAddress: string;
  tokenX: string;
  tokenY: string;
  liquidityShare: number;
  unclaimedFees: number;
}

export interface TreasuryBalance {
  solBalance: number;
  usdcBalance: number;
  totalValueUsd: number;
  lpPositions?: LPPosition[];
}
