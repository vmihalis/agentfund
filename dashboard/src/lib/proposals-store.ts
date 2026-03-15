/**
 * Shared in-memory proposals store.
 *
 * Single source of truth for pipeline proposals.
 * Both /api/proposals (this plan) and /api/proposals/submit (Plan 08-03)
 * import from here so that submissions are visible in the pipeline.
 */

import type { PipelineProposal, PipelineStage } from './types';
import { mapPipelineStage } from './pipeline';

/** Mutable array holding all proposals -- seeded with demo data. */
export const proposals: PipelineProposal[] = [
  {
    id: 'demo-001',
    title: 'AI Code Review Tool',
    stage: 'evaluating',
    updatedAt: Date.now() - 60_000,
    evaluation: {
      overallScore: 7.5,
      recommendation: 'fund',
      reasoning: 'Strong technical approach with clear market fit',
    },
  },
  {
    id: 'demo-002',
    title: 'DeFi Yield Optimizer',
    stage: 'submitted',
    updatedAt: Date.now() - 120_000,
  },
  {
    id: 'demo-003',
    title: 'Cross-chain Bridge Monitor',
    stage: 'approved',
    updatedAt: Date.now() - 30_000,
    evaluation: {
      overallScore: 8.2,
      recommendation: 'fund',
      reasoning: 'Critical infrastructure need with solid team',
    },
  },
];

/** Add a new proposal to the store. */
export function addProposal(proposal: PipelineProposal): void {
  proposals.push(proposal);
}

/** Get all proposals. */
export function getProposals(): PipelineProposal[] {
  return proposals;
}

/**
 * Update an existing proposal's stage and optionally its evaluation.
 *
 * No-op if the proposal ID is not found (does not throw).
 * Always updates the updatedAt timestamp when a match is found.
 */
export function updateProposalStage(
  id: string,
  stage: PipelineStage,
  evaluation?: PipelineProposal['evaluation'],
): void {
  const proposal = proposals.find((p) => p.id === id);
  if (proposal) {
    proposal.stage = stage;
    proposal.updatedAt = Date.now();
    if (evaluation) proposal.evaluation = evaluation;
  }
}

/** Re-export mapPipelineStage for convenience -- wires pipeline.ts into store consumers. */
export { mapPipelineStage } from './pipeline';
