/**
 * Unit tests for dashboard proposal pipeline logic.
 *
 * Tests the pure mapPipelineStage function and validates
 * PipelineProposal shape from the shared proposals store.
 */

import { describe, it, expect } from 'vitest';
import { mapPipelineStage } from '../../dashboard/src/lib/pipeline.js';
import { getProposals } from '../../dashboard/src/lib/proposals-store.js';

describe('Dashboard Proposals', () => {
  describe('mapPipelineStage', () => {
    it('maps discover:started to submitted', () => {
      expect(mapPipelineStage('discover', 'started')).toBe('submitted');
    });

    it('maps evaluate:started to evaluating', () => {
      expect(mapPipelineStage('evaluate', 'started')).toBe('evaluating');
    });

    it('maps evaluate:completed with fund recommendation to approved', () => {
      expect(mapPipelineStage('evaluate', 'completed', 'fund')).toBe('approved');
    });

    it('maps fund:completed to funded', () => {
      expect(mapPipelineStage('fund', 'completed')).toBe('funded');
    });

    it('defaults unknown steps to submitted', () => {
      expect(mapPipelineStage('unknown', 'started')).toBe('submitted');
    });

    it('evaluate:completed without fund recommendation defaults to submitted', () => {
      expect(mapPipelineStage('evaluate', 'completed', 'reject')).toBe('submitted');
    });
  });

  describe('proposals store', () => {
    it('returns seeded demo proposals', () => {
      const proposals = getProposals();
      expect(Array.isArray(proposals)).toBe(true);
      expect(proposals.length).toBeGreaterThanOrEqual(3);
    });

    it('each proposal has required fields', () => {
      const proposals = getProposals();
      for (const p of proposals) {
        expect(typeof p.id).toBe('string');
        expect(typeof p.title).toBe('string');
        expect(['submitted', 'evaluating', 'approved', 'funded']).toContain(p.stage);
        expect(typeof p.updatedAt).toBe('number');
      }
    });

    it('proposals span different stages', () => {
      const proposals = getProposals();
      const stages = new Set(proposals.map((p) => p.stage));
      expect(stages.size).toBeGreaterThanOrEqual(2);
    });

    it('proposals with evaluation have score and recommendation', () => {
      const proposals = getProposals();
      const withEval = proposals.filter((p) => p.evaluation);
      expect(withEval.length).toBeGreaterThan(0);
      for (const p of withEval) {
        expect(typeof p.evaluation!.overallScore).toBe('number');
        expect(typeof p.evaluation!.recommendation).toBe('string');
        expect(typeof p.evaluation!.reasoning).toBe('string');
      }
    });
  });
});
