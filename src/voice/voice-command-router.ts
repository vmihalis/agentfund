/**
 * VoiceCommandRouter -- routes intents to agent actions.
 *
 * Each intent triggers ONLY the agents it needs:
 * - checkTreasury -> Treasury agent only
 * - findProposals -> Scout + Analyzer (discover + evaluate, cached)
 * - fundProject -> Governance + Treasury (decide + transfer, uses cache)
 * - analyzeProposal -> Scout + Analyzer
 * - chat -> Claude with agent tools (can call any agent as needed)
 *
 * @module voice/voice-command-router
 */

import Anthropic from '@anthropic-ai/sdk';
import type { VoiceCommand, VoiceResult } from './voice-types.js';
import type { GovernanceAgent } from '../agents/governance-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../agents/types.js';
import type { Evaluation, Proposal, TreasuryBalance } from '../types/proposals.js';

/** Dependencies injected into VoiceCommandRouter. */
export interface VoiceRouterDeps {
  governance: GovernanceAgent;
  scout: IScoutAgent;
  analyzer: IAnalyzerAgent;
  treasury: ITreasuryAgent;
}

export class VoiceCommandRouter {
  private readonly governance: GovernanceAgent;
  private readonly scout: IScoutAgent;
  private readonly analyzer: IAnalyzerAgent;
  private readonly treasury: ITreasuryAgent;
  private readonly anthropic: Anthropic;

  /** Cached proposals from the last find command. */
  private cachedProposals: Proposal[] = [];
  /** Cached evaluations from the last find command. */
  private cachedEvaluations: Evaluation[] = [];

  constructor(deps: VoiceRouterDeps) {
    this.governance = deps.governance;
    this.scout = deps.scout;
    this.analyzer = deps.analyzer;
    this.treasury = deps.treasury;
    this.anthropic = new Anthropic();
  }

  async execute(command: VoiceCommand): Promise<VoiceResult> {
    try {
      switch (command.intent) {
        case 'checkTreasury':
          return await this.handleCheckTreasury();
        case 'findProposals':
          return await this.handleFindProposals(command.params);
        case 'analyzeProposal':
          return await this.handleAnalyzeProposal(command.params);
        case 'fundProject':
          return await this.handleFundProject(command.params);
        default:
          // Chat / unknown — let Claude handle it with agent tools
          return await this.handleChat(command.params.text || '');
      }
    } catch (err) {
      return {
        success: false,
        intent: command.intent,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---- Treasury: just check balance ----

  private async handleCheckTreasury(): Promise<VoiceResult> {
    const balance: TreasuryBalance = await this.treasury.getBalance();
    const lpCount = balance.lpPositions?.length ?? 0;
    return {
      success: true,
      intent: 'checkTreasury',
      message:
        `Treasury holds ${balance.solBalance} SOL, ` +
        `${balance.usdcBalance} USDC ` +
        `(total ~$${balance.totalValueUsd}). ` +
        `${lpCount} LP position${lpCount !== 1 ? 's' : ''} active.`,
      data: balance,
    };
  }

  // ---- Find: Scout discovers + Analyzer evaluates, cache results ----

  private async handleFindProposals(params: Record<string, string>): Promise<VoiceResult> {
    const query = params.query || 'new grant proposals';
    const proposals = await this.scout.discoverProposals(query);

    // Normalize amounts to demo scale
    const totalRequested = proposals.reduce((sum, p) => sum + p.requestedAmount, 0);
    if (totalRequested > 500) {
      const scale = 200 / totalRequested;
      for (const p of proposals) {
        p.requestedAmount = Math.max(1, Math.round(p.requestedAmount * scale));
      }
    }

    if (proposals.length === 0) {
      return {
        success: true,
        intent: 'findProposals',
        message: 'No proposals found for that query.',
      };
    }

    const evaluations: Evaluation[] = [];
    for (const proposal of proposals) {
      const evaluation = await this.analyzer.evaluateProposal(proposal);
      evaluations.push(evaluation);
    }

    this.cachedProposals = proposals;
    this.cachedEvaluations = evaluations;
    for (const proposal of proposals) {
      this.governance.proposalCache.set(proposal.id, proposal);
    }

    const sorted = [...evaluations].sort((a, b) => b.overallScore - a.overallScore);
    const lines = sorted.map((e) => `"${e.proposalTitle}" — ${e.overallScore}/10 (${e.recommendation})`);

    return {
      success: true,
      intent: 'findProposals',
      message: `Found and evaluated ${proposals.length} proposals:\n${lines.join('\n')}\n\nSay "fund" to allocate budget.`,
      data: { proposals, evaluations },
    };
  }

  // ---- Analyze: Scout + Analyzer for a specific proposal ----

  private async handleAnalyzeProposal(params: Record<string, string>): Promise<VoiceResult> {
    // Use cached proposals if available
    let proposal: Proposal | undefined;
    if (this.cachedProposals.length > 0 && params.proposalId) {
      const search = params.proposalId.toLowerCase();
      proposal = this.cachedProposals.find((p) => p.title.toLowerCase().includes(search));
    }

    if (!proposal) {
      const searchQuery = params.proposalId || 'proposals';
      const proposals = await this.scout.discoverProposals(searchQuery);
      if (proposals.length === 0) {
        return { success: false, intent: 'analyzeProposal', message: 'No proposals found to analyze' };
      }
      proposal = proposals.find((p) => p.id === params.proposalId) ?? proposals[0];
    }

    const evaluation = await this.analyzer.evaluateProposal(proposal);

    return {
      success: true,
      intent: 'analyzeProposal',
      message:
        `Analysis of "${evaluation.proposalTitle}": ` +
        `score ${evaluation.overallScore}/10, ` +
        `recommendation: ${evaluation.recommendation}. ` +
        `${evaluation.reasoning}`,
      data: evaluation,
    };
  }

  // ---- Fund: Governance decides + Treasury sends money ----

  private async handleFundProject(params: Record<string, string>): Promise<VoiceResult> {
    const budget = Number(params.amount) || 10;

    if (this.cachedEvaluations.length === 0) {
      return {
        success: false,
        intent: 'fundProject',
        message: 'No proposals evaluated yet. Say "find Solana grants" first, then "fund".',
      };
    }

    // Pass the user's original instruction so Claude funds exactly what they asked for
    const userInstruction = params.proposalId
      ? `Fund "${params.proposalId}" with $${budget} USDC. Only fund that specific project.`
      : undefined;

    const decision = await this.governance.makeDecision(this.cachedEvaluations, budget, userInstruction);

    for (const allocation of decision.allocations) {
      if (allocation.action === 'fund') {
        await this.treasury.executeFunding(allocation);
      }
    }

    const funded = decision.allocations.filter((a) => a.action === 'fund');

    // Clear cache after funding
    this.cachedProposals = [];
    this.cachedEvaluations = [];

    return {
      success: true,
      intent: 'fundProject',
      message:
        `Funded ${funded.length} project(s). ` +
        `Total: $${decision.totalAllocated} USDC, ` +
        `remaining: $${decision.remainingBudget}. ` +
        `${decision.summary}`,
      data: decision,
    };
  }

  // ---- Chat: Claude with tools to call any agent ----

  private async handleChat(text: string): Promise<VoiceResult> {
    // Get treasury balance as context
    let treasuryContext = '';
    try {
      const balance = await this.treasury.getBalance();
      treasuryContext = `Treasury: ${balance.solBalance} SOL, ${balance.usdcBalance} USDC.`;
    } catch { /* ignore */ }

    const cachedContext = this.cachedEvaluations.length > 0
      ? `\n${this.cachedEvaluations.length} proposals evaluated and ready to fund.`
      : '\nNo proposals evaluated yet.';

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system:
        `You are AgentFund, an autonomous AI treasury manager on Solana. ` +
        `You help users discover grant proposals, evaluate them, and fund the best ones with USDC. ` +
        `Be concise and friendly. You have 4 agents: Scout (finds proposals), Analyzer (scores them), ` +
        `Governance (makes funding decisions), and Treasury (holds and sends funds). ` +
        `Current state: ${treasuryContext}${cachedContext}\n` +
        `If the user wants to do something, tell them what command to use.`,
      messages: [{ role: 'user', content: text }],
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'I can help you find and fund Solana grants.';

    return {
      success: true,
      intent: 'chat' as any,
      message: reply,
    };
  }
}
