/**
 * GovernanceAgent -- orchestrates the full funding pipeline.
 *
 * Coordinates Scout, Analyzer, and Treasury agents to discover proposals,
 * evaluate them, make funding decisions (via Claude API), and execute funding.
 * Falls back to a score-threshold heuristic when Claude API is unavailable.
 *
 * Satisfies: GOV-01 (pipeline coordination), GOV-02 (decision aggregation),
 * GOV-04 (decision summaries with reasoning).
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { BaseAgent } from './base-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from './types.js';
import type {
  Proposal,
  Evaluation,
  DecisionSummary,
  FundingAllocation,
} from '../types/proposals.js';
import type { AgentEventBus } from '../events/event-types.js';
import type { AgentMessenger } from './agent-messenger.js';
import type { AgentMemory } from '../memory/agent-memory.js';

/**
 * Zod schema for the structured decision output from Claude API.
 * Used to validate tool_use responses and derive the JSON Schema
 * passed to the Anthropic messages.create call.
 */
const FundingDecisionSchema = z.object({
  summary: z.string().describe('Overall summary of funding decisions'),
  allocations: z.array(
    z.object({
      proposalId: z.string(),
      proposalTitle: z.string(),
      action: z.enum(['fund', 'reject', 'defer']),
      amount: z.number().optional(),
      reasoning: z
        .string()
        .describe('Detailed explanation of why this decision was made'),
    }),
  ),
  totalAllocated: z.number(),
  remainingBudget: z.number(),
});

/** Triage schema for round 1 of multi-round deliberation. */
const TriageSchema = z.object({
  categorizations: z.array(z.object({
    proposalId: z.string(),
    proposalTitle: z.string(),
    category: z.enum(['clear_fund', 'clear_reject', 'needs_deep_dive']),
    reasoning: z.string(),
  })),
});

/** Request shape for executeFundingPipeline. */
export interface FundingRequest {
  query: string;
  budget: number;
}

export class GovernanceAgent extends BaseAgent {
  private readonly scout: IScoutAgent;
  private readonly analyzer: IAnalyzerAgent;
  private readonly treasury: ITreasuryAgent;
  private readonly client: Anthropic;
  private messenger: AgentMessenger | null = null;
  private memory: AgentMemory | null = null;

  /**
   * Cache of proposals discovered during pipeline execution.
   * Used by the fallback decision logic to determine requested amounts.
   * Public for test setup when calling makeDecision directly.
   */
  readonly proposalCache = new Map<string, Proposal>();

  constructor(
    bus: AgentEventBus,
    scout: IScoutAgent,
    analyzer: IAnalyzerAgent,
    treasury: ITreasuryAgent,
    client?: Anthropic,
  ) {
    super('governance', bus);
    this.scout = scout;
    this.analyzer = analyzer;
    this.treasury = treasury;
    this.client = client ?? new Anthropic();
  }

  /** Set the messenger for inter-agent communication. */
  setMessenger(messenger: AgentMessenger): void {
    this.messenger = messenger;
  }

  /** Set the memory store for historical awareness. */
  setMemory(memory: AgentMemory): void {
    this.memory = memory;
  }

  async initialize(): Promise<void> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn(
        '[GovernanceAgent] ANTHROPIC_API_KEY not set -- will use fallback decisions',
      );
    }
    this.emitStatus('initialized', 'GovernanceAgent ready');
  }

  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'GovernanceAgent stopped');
  }

  /**
   * Execute the full funding pipeline: discover -> evaluate -> decide -> fund.
   *
   * Emits pipeline:step events at each stage for observability.
   * Returns a DecisionSummary with allocations and reasoning.
   */
  async executeFundingPipeline(
    request: FundingRequest,
  ): Promise<DecisionSummary> {
    // Step 1: Discover proposals
    this.bus.emit('pipeline:step', {
      step: 'discover',
      status: 'started',
      detail: { query: request.query },
    });

    this.bus.emit('agent:status', {
      agent: 'scout',
      status: 'discovering',
      detail: `Scraping web data via Unbrowse + structuring with Claude AI`,
      timestamp: Date.now(),
    });

    const proposals = await this.scout.discoverProposals(request.query);

    this.bus.emit('agent:status', {
      agent: 'scout',
      status: 'discovered',
      detail: `Found ${proposals.length} proposals from live web data`,
      timestamp: Date.now(),
    });

    this.bus.emit('pipeline:step', {
      step: 'discover',
      status: 'completed',
      detail: { count: proposals.length },
    });

    // Cache proposals for fallback decision-making
    for (const proposal of proposals) {
      this.proposalCache.set(proposal.id, proposal);
    }

    // Handle empty proposals
    if (proposals.length === 0) {
      const emptySummary: DecisionSummary = {
        timestamp: Date.now(),
        summary: 'No proposals discovered for the given query',
        allocations: [],
        totalAllocated: 0,
        remainingBudget: request.budget,
      };
      this.bus.emit('pipeline:decision', {
        summary: emptySummary.summary,
        allocations: [],
      });
      return emptySummary;
    }

    // Step 2: Evaluate proposals in parallel (concurrency=3 for API rate limits)
    this.bus.emit('pipeline:step', {
      step: 'evaluate',
      status: 'started',
      detail: { count: proposals.length },
    });

    this.bus.emit('agent:status', {
      agent: 'analyzer',
      status: 'evaluating',
      detail: `Evaluating ${proposals.length} proposals in parallel`,
      timestamp: Date.now(),
    });

    const evaluations = await this.evaluateParallel(proposals, 3);

    this.bus.emit('pipeline:step', {
      step: 'evaluate',
      status: 'completed',
      detail: { count: evaluations.length },
    });

    // Step 3: Make funding decision (Claude API or fallback)
    this.bus.emit('agent:status', {
      agent: 'governance',
      status: 'deciding',
      detail: `Claude AI deciding funding allocations for ${evaluations.length} evaluated proposals`,
      timestamp: Date.now(),
    });

    const decision = await this.makeDecision(evaluations, request.budget);

    this.bus.emit('pipeline:decision', {
      summary: decision.summary,
      allocations: decision.allocations.map((a) => ({
        proposalTitle: a.proposalTitle,
        action: a.action,
        reasoning: a.reasoning,
      })),
    });

    // Step 4: Execute funding for approved allocations
    for (const allocation of decision.allocations) {
      if (allocation.action === 'fund') {
        this.bus.emit('pipeline:step', {
          step: 'fund',
          status: 'started',
          detail: { proposal: allocation.proposalTitle },
        });

        const txResult = await this.treasury.executeFunding(allocation);

        this.bus.emit('pipeline:funded', {
          proposalTitle: allocation.proposalTitle,
          amount: allocation.amount ?? 0,
          txSignature: txResult.signature ?? '',
        });

        this.bus.emit('pipeline:step', {
          step: 'fund',
          status: 'completed',
          detail: {
            proposal: allocation.proposalTitle,
            signature: txResult.signature,
          },
        });
      }
    }

    return decision;
  }

  /**
   * Make a funding decision using Claude API with tool_use for structured output.
   *
   * Falls back to a score-threshold heuristic if the Claude API call fails
   * for any reason (rate limit, network error, parsing failure).
   */
  /**
   * Evaluate proposals in parallel with a semaphore-based worker pool.
   */
  private async evaluateParallel(proposals: Proposal[], concurrency = 3): Promise<Evaluation[]> {
    const results: Evaluation[] = new Array(proposals.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, proposals.length) }, async () => {
      while (next < proposals.length) {
        const i = next++;
        const proposal = proposals[i];
        this.bus.emit('agent:status', {
          agent: 'analyzer',
          status: 'evaluating',
          detail: `Evaluating "${proposal.title}" (${i + 1}/${proposals.length})`,
          timestamp: Date.now(),
        });
        results[i] = await this.analyzer.evaluateProposal(proposal);
        this.bus.emit('agent:status', {
          agent: 'analyzer',
          status: 'evaluated',
          detail: `"${proposal.title}" scored ${results[i].overallScore}/10`,
          timestamp: Date.now(),
        });
      }
    });
    await Promise.all(workers);
    return results;
  }

  async makeDecision(
    evaluations: Evaluation[],
    budget: number,
    userInstruction?: string,
  ): Promise<DecisionSummary> {
    this.emitThinking('considering', `Reviewing ${evaluations.length} proposals with $${budget} USDC budget`);

    // Include historical context from memory
    if (this.memory) {
      const recentDecisions = this.memory.getRecentDecisions(10);
      if (recentDecisions.length > 0) {
        const stats = this.memory.getStats();
        this.emitThinking('considering',
          `Drawing on ${stats.totalDecisions} past decisions (avg score: ${stats.avgScore}/10). Last ${recentDecisions.length} decisions inform this round.`);
      }
    }

    try {
      const decision = await this.makeClaudeDecision(evaluations, budget, userInstruction);
      const funded = decision.allocations.filter(a => a.action === 'fund');
      const rejected = decision.allocations.filter(a => a.action === 'reject');
      this.emitThinking('concluding',
        `Funding ${funded.length} project(s) for $${decision.totalAllocated} USDC, rejecting ${rejected.length}. ${decision.summary}`);
      return decision;
    } catch {
      this.emitThinking('weighing', `Claude API unavailable — using score-threshold heuristic for $${budget} budget`);
      const decision = this.makeFallbackDecision(evaluations, budget);
      this.emitThinking('concluding', `Heuristic decision: funded ${decision.allocations.filter(a => a.action === 'fund').length} projects`);
      return decision;
    }
  }

  /**
   * Multi-round Claude deliberation:
   * Round 1 (Triage): Categorize proposals as clear_fund, clear_reject, needs_deep_dive
   * Round 2 (Deep-dive): For borderline proposals, ask Analyzer for additional analysis
   * Round 3 (Final): Make final decision with all gathered info
   */
  private async makeClaudeDecision(
    evaluations: Evaluation[],
    budget: number,
    userInstruction?: string,
  ): Promise<DecisionSummary> {
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';

    const evaluationSummary = evaluations
      .map(
        (e) =>
          `- ${e.proposalTitle} (ID: ${e.proposalId}): overall ${e.overallScore}/10, ` +
          `team ${e.scores.teamQuality}, tech ${e.scores.technicalFeasibility}, ` +
          `impact ${e.scores.impactPotential}, budget ${e.scores.budgetReasonableness}. ` +
          `Recommendation: ${e.recommendation}. Reasoning: ${e.reasoning}`,
      )
      .join('\n');

    const instruction = userInstruction || 'Fund the best proposals based on scores.';

    // === Round 1: Triage ===
    this.emitThinking('considering', `Round 1/3: Triaging ${evaluations.length} proposals into clear-fund, clear-reject, and needs-deep-dive`);

    let deepDiveContext = '';
    try {
      const triageJsonSchema = z.toJSONSchema(TriageSchema, { target: 'draft-07' });
      const triageResponse = await this.client.messages.create({
        model,
        max_tokens: 1024,
        system: 'You are a funding governance agent. Triage proposals into three categories: clear_fund (obviously good), clear_reject (obviously bad), needs_deep_dive (borderline, needs more analysis).',
        messages: [{ role: 'user', content: `Budget: $${budget} USDC\nInstruction: ${instruction}\n\nProposals:\n${evaluationSummary}` }],
        tools: [{ name: 'submit_triage', description: 'Submit triage categorizations', input_schema: triageJsonSchema as Anthropic.Tool.InputSchema }],
        tool_choice: { type: 'tool' as const, name: 'submit_triage' },
      });

      const triageBlock = triageResponse.content.find(b => b.type === 'tool_use');
      if (triageBlock && triageBlock.type === 'tool_use') {
        const triage = TriageSchema.parse(triageBlock.input);
        const deepDive = triage.categorizations.filter(c => c.category === 'needs_deep_dive');
        const clearFund = triage.categorizations.filter(c => c.category === 'clear_fund');
        const clearReject = triage.categorizations.filter(c => c.category === 'clear_reject');

        this.emitThinking('weighing',
          `Triage: ${clearFund.length} clear-fund, ${clearReject.length} clear-reject, ${deepDive.length} needs-deep-dive`);

        // === Round 2: Deep-dive ===
        if (deepDive.length > 0 && this.messenger) {
          this.emitThinking('weighing', `Round 2/3: Deep-diving ${deepDive.length} borderline proposals via inter-agent communication`);

          for (const item of deepDive) {
            try {
              const additionalAnalysis = await this.messenger.ask('governance', 'analyzer',
                `Provide additional analysis for "${item.proposalTitle}" — it scored borderline. What are the key risks and opportunities?`,
                { proposalId: item.proposalId, proposalTitle: item.proposalTitle });
              deepDiveContext += `\n\nDeep-dive for "${item.proposalTitle}":\n${additionalAnalysis}`;
            } catch {
              // Continue without deep-dive data
            }
          }
        } else if (deepDive.length > 0) {
          this.emitThinking('weighing', `Round 2/3: ${deepDive.length} proposals need deep-dive but no messenger available — proceeding with existing data`);
        }
      }
    } catch {
      // Triage failed — proceed directly to final decision
      this.emitThinking('weighing', 'Triage round skipped — proceeding directly to final decision');
    }

    // === Round 3: Final Decision ===
    this.emitThinking('weighing', `Round 3/3: Making final funding decision with all gathered information`);

    const jsonSchema = z.toJSONSchema(FundingDecisionSchema, { target: 'draft-07' });

    const response = await this.client.messages.create({
      model,
      max_tokens: 2048,
      system:
        'You are a funding governance agent managing a USDC treasury on Solana devnet. ' +
        'You execute the user\'s exact funding instructions.\n' +
        'CRITICAL RULES:\n' +
        '1. Do EXACTLY what the user says. If they name a specific project, fund ONLY that project.\n' +
        '2. The budget is the EXACT amount of USDC to spend. Do not exceed it.\n' +
        '3. If the user names a project, give it the full budget. Reject all others.\n' +
        '4. If the user says "best" or doesn\'t name a project, pick the highest-scored one.\n' +
        '5. Each amount field must be a number in USDC.\n' +
        '6. Do NOT split money across projects unless the user explicitly asks you to.',
      messages: [
        {
          role: 'user',
          content:
            `User instruction: ${instruction}\n\n` +
            `Budget: $${budget} USDC\n\n` +
            `Proposal evaluations:\n${evaluationSummary}\n\n` +
            (deepDiveContext ? `Additional deep-dive analysis:\n${deepDiveContext}\n\n` : '') +
            `Follow my instructions exactly. Total funded must be <= $${budget}.`,
        },
      ],
      tools: [
        {
          name: 'submit_decision',
          description:
            'Submit funding allocation decisions for the evaluated proposals',
          input_schema: jsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool' as const, name: 'submit_decision' },
    });

    // Extract tool_use block
    const toolUseBlock = response.content.find(
      (block) => block.type === 'tool_use',
    );
    if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
      throw new Error('No tool_use block in Claude response');
    }

    // Validate response with Zod
    const parsed = FundingDecisionSchema.parse(toolUseBlock.input);

    // Map to DecisionSummary, enforcing budget constraint
    const timestamp = Date.now();
    let remaining = budget;
    const allocations: FundingAllocation[] = parsed.allocations.map((a) => {
      if (a.action === 'fund' && a.amount !== undefined) {
        if (a.amount <= remaining) {
          remaining -= a.amount;
          return {
            proposalId: a.proposalId,
            proposalTitle: a.proposalTitle,
            action: a.action as 'fund',
            amount: a.amount,
            reasoning: a.reasoning,
          };
        }
        // Over budget -- reject instead
        return {
          proposalId: a.proposalId,
          proposalTitle: a.proposalTitle,
          action: 'reject' as const,
          reasoning: `${a.reasoning} (rejected: exceeded remaining budget)`,
        };
      }
      return {
        proposalId: a.proposalId,
        proposalTitle: a.proposalTitle,
        action: a.action as 'fund' | 'reject' | 'defer',
        amount: a.amount,
        reasoning: a.reasoning,
      };
    });

    const totalAllocated = budget - remaining;

    return {
      timestamp,
      summary: parsed.summary,
      allocations,
      totalAllocated,
      remainingBudget: remaining,
    };
  }

  /**
   * Fallback decision-making when Claude API is unavailable.
   *
   * Uses a simple score-threshold heuristic: fund proposals with
   * overallScore >= 7, sorted by score descending, until budget runs out.
   */
  private makeFallbackDecision(
    evaluations: Evaluation[],
    budget: number,
  ): DecisionSummary {
    const timestamp = Date.now();
    const sorted = [...evaluations].sort(
      (a, b) => b.overallScore - a.overallScore,
    );

    // Fund proposals scoring >= 7, distribute budget proportionally by score
    const fundable = sorted.filter((e) => e.overallScore >= 7);
    const rejected = sorted.filter((e) => e.overallScore < 7);

    const allocations: FundingAllocation[] = [];

    if (fundable.length > 0) {
      const totalScore = fundable.reduce((sum, e) => sum + e.overallScore, 0);
      let remaining = budget;

      for (let i = 0; i < fundable.length; i++) {
        const evaluation = fundable[i];
        // Last one gets whatever remains to avoid rounding issues
        const amount = i === fundable.length - 1
          ? Math.round(remaining * 100) / 100
          : Math.round((budget * evaluation.overallScore / totalScore) * 100) / 100;
        remaining -= amount;

        allocations.push({
          proposalId: evaluation.proposalId,
          proposalTitle: evaluation.proposalTitle,
          action: 'fund',
          amount,
          reasoning: `Auto-approved: score ${evaluation.overallScore}/10, allocated $${amount} USDC`,
        });
      }
    }

    for (const evaluation of rejected) {
      allocations.push({
        proposalId: evaluation.proposalId,
        proposalTitle: evaluation.proposalTitle,
        action: 'reject',
        reasoning: `Auto-rejected: score ${evaluation.overallScore}/10 below threshold`,
      });
    }

    const totalAllocated = allocations
      .filter((a) => a.action === 'fund')
      .reduce((sum, a) => sum + (a.amount ?? 0), 0);

    return {
      timestamp,
      summary: `Funded ${fundable.length} of ${evaluations.length} proposals, distributed $${totalAllocated} USDC by score`,
      allocations,
      totalAllocated,
      remainingBudget: budget - totalAllocated,
    };
  }
}
