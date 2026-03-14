/**
 * Agent interfaces for the funding pipeline.
 *
 * Defines typed contracts for Scout, Analyzer, and Treasury agents.
 * Both stub (Phase 2) and real (Phases 3-5) implementations must
 * satisfy these interfaces.
 */

import type { Proposal, Evaluation, FundingAllocation, TransactionResult, TreasuryBalance } from '../types/proposals.js';

export interface IScoutAgent {
  discoverProposals(query: string): Promise<Proposal[]>;
}

export interface IAnalyzerAgent {
  evaluateProposal(proposal: Proposal): Promise<Evaluation>;
}

export interface ITreasuryAgent {
  executeFunding(allocation: FundingAllocation): Promise<TransactionResult>;
  getBalance(): Promise<TreasuryBalance>;
}
