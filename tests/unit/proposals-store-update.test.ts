/**
 * Unit tests for proposals-store updateProposalStage and mapPipelineStage wiring.
 *
 * Validates that updateProposalStage modifies existing proposals correctly
 * and that mapPipelineStage is properly re-exported for convenience.
 */

import { describe, it, expect } from 'vitest';
import {
  proposals,
  updateProposalStage,
  mapPipelineStage,
} from '../../dashboard/src/lib/proposals-store.js';

describe('Proposals Store - updateProposalStage', () => {
  it('changes stage of existing proposal', () => {
    const before = proposals.find((p) => p.id === 'demo-001');
    expect(before).toBeDefined();
    expect(before!.stage).toBe('evaluating');

    updateProposalStage('demo-001', 'funded');
    const after = proposals.find((p) => p.id === 'demo-001');
    expect(after!.stage).toBe('funded');
  });

  it('updates the updatedAt timestamp', () => {
    const before = proposals.find((p) => p.id === 'demo-002');
    const oldTimestamp = before!.updatedAt;

    updateProposalStage('demo-002', 'evaluating');
    const after = proposals.find((p) => p.id === 'demo-002');
    expect(after!.updatedAt).toBeGreaterThanOrEqual(oldTimestamp);
    expect(after!.stage).toBe('evaluating');
  });

  it('updates evaluation when provided', () => {
    const evaluation = {
      overallScore: 9.0,
      recommendation: 'fund',
      reasoning: 'Excellent proposal with strong fundamentals',
    };

    updateProposalStage('demo-003', 'funded', evaluation);
    const after = proposals.find((p) => p.id === 'demo-003');
    expect(after!.stage).toBe('funded');
    expect(after!.evaluation).toEqual(evaluation);
  });

  it('does nothing for non-existent id (no throw)', () => {
    const countBefore = proposals.length;
    expect(() => updateProposalStage('nonexistent-999', 'funded')).not.toThrow();
    expect(proposals.length).toBe(countBefore);
  });
});

describe('Proposals Store - mapPipelineStage re-export', () => {
  it('mapPipelineStage(discover, started) returns submitted', () => {
    expect(mapPipelineStage('discover', 'started')).toBe('submitted');
  });

  it('mapPipelineStage(evaluate, started) returns evaluating', () => {
    expect(mapPipelineStage('evaluate', 'started')).toBe('evaluating');
  });

  it('mapPipelineStage(evaluate, completed, fund) returns approved', () => {
    expect(mapPipelineStage('evaluate', 'completed', 'fund')).toBe('approved');
  });

  it('mapPipelineStage(fund, completed) returns funded', () => {
    expect(mapPipelineStage('fund', 'completed')).toBe('funded');
  });
});
