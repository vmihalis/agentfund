/**
 * Stub Analyzer Agent returning mock evaluations.
 *
 * Implements IAnalyzerAgent with hardcoded scores and reasoning
 * for pipeline testing in Phase 2. Replaced by real AnalyzerAgent in Phase 4.
 */

import { BaseAgent } from '../base-agent.js';
import type { IAnalyzerAgent } from '../types.js';
import type { Proposal, Evaluation } from '../../types/proposals.js';
import type { AgentEventBus } from '../../events/event-types.js';

export class StubAnalyzerAgent extends BaseAgent implements IAnalyzerAgent {
  constructor(bus: AgentEventBus) {
    super('analyzer', bus);
  }

  async initialize(): Promise<void> {
    this.emitStatus('initialized', 'StubAnalyzerAgent ready');
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'StubAnalyzerAgent stopped');
  }

  async evaluateProposal(proposal: Proposal): Promise<Evaluation> {
    this.emitStatus('evaluating', `Analyzing: ${proposal.title}`);

    const scores = {
      teamQuality: 7,
      technicalFeasibility: 8,
      impactPotential: 6,
      budgetReasonableness: 7,
    };

    const overallScore =
      (scores.teamQuality +
        scores.technicalFeasibility +
        scores.impactPotential +
        scores.budgetReasonableness) /
      4;

    const recommendation = overallScore >= 6 ? 'fund' : 'reject';

    return {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      scores,
      overallScore,
      reasoning: `Proposal "${proposal.title}" demonstrates strong technical feasibility (${scores.technicalFeasibility}/10) and a capable team (${scores.teamQuality}/10). The impact potential is moderate (${scores.impactPotential}/10) with reasonable budget allocation (${scores.budgetReasonableness}/10). Overall score: ${overallScore.toFixed(1)}.`,
      recommendation: recommendation as 'fund' | 'reject' | 'defer',
    };
  }
}
