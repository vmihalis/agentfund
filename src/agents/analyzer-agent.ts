/**
 * AnalyzerAgent -- evaluates proposals using Claude API with structured scoring.
 *
 * Calls Claude with forced tool_use to produce structured evaluations with
 * four scored dimensions (teamQuality, technicalFeasibility, impactPotential,
 * budgetReasonableness), human-readable reasoning, and a recommendation.
 * Falls back to deterministic heuristic scoring when Claude API is unavailable.
 *
 * Satisfies: ANLZ-01 (structured evaluation), ANLZ-02 (reasoning),
 * ANLZ-03 (four score dimensions).
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { IAnalyzerAgent } from './types.js';
import type { Proposal, Evaluation } from '../types/proposals.js';
import type { AgentEventBus } from '../events/event-types.js';

/**
 * Zod schema for the structured evaluation output from Claude API.
 * Used to validate tool_use responses and derive the JSON Schema
 * passed to the Anthropic messages.create call.
 */
const EvaluationOutputSchema = z.object({
  scores: z.object({
    teamQuality: z.number().min(1).max(10),
    technicalFeasibility: z.number().min(1).max(10),
    impactPotential: z.number().min(1).max(10),
    budgetReasonableness: z.number().min(1).max(10),
  }),
  reasoning: z.string(),
  recommendation: z.enum(['fund', 'reject', 'defer']),
});

/** System prompt instructing Claude how to evaluate proposals. */
const EVALUATION_SYSTEM_PROMPT =
  'You are a proposal evaluation agent for a Solana ecosystem grant fund. ' +
  'Evaluate proposals rigorously on four dimensions, each scored 1-10 (integer):\n' +
  '- Team Quality: experience, track record, team size and composition\n' +
  '- Technical Feasibility: is the proposed technology realistic and achievable?\n' +
  '- Impact Potential: how much value does this create for the Solana ecosystem?\n' +
  '- Budget Reasonableness: is the requested amount justified for the scope?\n\n' +
  'Provide 2-4 sentences of specific reasoning referencing the proposal content. ' +
  'Be honest and critical -- not every proposal deserves funding.';

/**
 * Format a Proposal into a readable evaluation prompt for Claude.
 */
function formatProposalForEvaluation(proposal: Proposal): string {
  return (
    `Evaluate the following grant proposal:\n\n` +
    `Title: ${proposal.title}\n` +
    `Proposal ID: ${proposal.id}\n` +
    `Requested Amount: $${proposal.requestedAmount}\n` +
    `Team: ${proposal.teamInfo}\n` +
    `Description: ${proposal.description}\n` +
    (proposal.sourceUrl ? `Source: ${proposal.sourceUrl}\n` : '')
  );
}

export class AnalyzerAgent extends BaseAgent implements IAnalyzerAgent {
  private readonly client: Anthropic;

  constructor(bus: AgentEventBus, client?: Anthropic) {
    super('analyzer', bus);
    this.client = client ?? new Anthropic();
  }

  async initialize(): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn(
        '[AnalyzerAgent] ANTHROPIC_API_KEY not set -- will use fallback evaluation',
      );
    }
    this.emitStatus('initialized', 'AnalyzerAgent ready');
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'AnalyzerAgent stopped');
  }

  /**
   * Evaluate a proposal and return a structured Evaluation.
   *
   * Tries Claude API first; falls back to deterministic heuristic scoring
   * if the API call fails for any reason.
   */
  async evaluateProposal(proposal: Proposal): Promise<Evaluation> {
    this.emitStatus('evaluating', `Analyzing: ${proposal.title}`);

    try {
      return await this.evaluateWithClaude(proposal);
    } catch {
      return this.evaluateWithFallback(proposal);
    }
  }

  /**
   * Call Claude API with forced tool_use to produce a structured evaluation.
   */
  private async evaluateWithClaude(proposal: Proposal): Promise<Evaluation> {
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';

    // Convert Zod schema to JSON Schema using Zod v4 native method
    const jsonSchema = z.toJSONSchema(EvaluationOutputSchema, {
      target: 'draft-07',
    });

    const response = await this.client.messages.create({
      model,
      max_tokens: 2048,
      system: EVALUATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: formatProposalForEvaluation(proposal),
        },
      ],
      tools: [
        {
          name: 'submit_evaluation',
          description:
            'Submit structured evaluation scores, reasoning, and recommendation for a grant proposal',
          input_schema: jsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool' as const, name: 'submit_evaluation' },
    });

    // Extract tool_use block
    const toolUseBlock = response.content.find(
      (block) => block.type === 'tool_use',
    );
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new Error('No tool_use block in Claude response');
    }

    // Validate response with Zod
    const parsed = EvaluationOutputSchema.parse(toolUseBlock.input);

    // Calculate overall score as simple average
    const { teamQuality, technicalFeasibility, impactPotential, budgetReasonableness } =
      parsed.scores;
    const overallScore =
      (teamQuality + technicalFeasibility + impactPotential + budgetReasonableness) / 4;

    return {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      scores: parsed.scores,
      overallScore,
      reasoning: parsed.reasoning,
      recommendation: parsed.recommendation,
    };
  }

  /**
   * Deterministic heuristic fallback when Claude API is unavailable.
   *
   * Scores are based on proposal content characteristics:
   * - teamQuality: based on teamInfo length (more detail = higher score)
   * - technicalFeasibility: based on description length
   * - impactPotential: fixed baseline score
   * - budgetReasonableness: based on requested amount range
   */
  private evaluateWithFallback(proposal: Proposal): Evaluation {
    const teamQuality = proposal.teamInfo.length > 20 ? 7 : 5;
    const technicalFeasibility = proposal.description.length > 100 ? 7 : 5;
    const impactPotential = 6;
    const budgetReasonableness =
      proposal.requestedAmount > 0 && proposal.requestedAmount < 50000 ? 7 : 5;

    const scores = {
      teamQuality,
      technicalFeasibility,
      impactPotential,
      budgetReasonableness,
    };

    const overallScore =
      (teamQuality + technicalFeasibility + impactPotential + budgetReasonableness) / 4;

    const recommendation: 'fund' | 'reject' | 'defer' =
      overallScore >= 6 ? 'fund' : 'reject';

    const reasoning =
      `Auto-evaluated (Claude API unavailable): ` +
      `Team quality ${teamQuality}/10 (${proposal.teamInfo.length > 20 ? 'detailed team info' : 'limited team info'}). ` +
      `Technical feasibility ${technicalFeasibility}/10 (${proposal.description.length > 100 ? 'comprehensive description' : 'brief description'}). ` +
      `Impact potential ${impactPotential}/10 (baseline). ` +
      `Budget reasonableness ${budgetReasonableness}/10 ($${proposal.requestedAmount} requested).`;

    return {
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      scores,
      overallScore,
      reasoning,
      recommendation,
    };
  }
}
