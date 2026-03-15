/**
 * VoiceCommandRouter -- maps voice/text intents to agent actions.
 *
 * Routes VoiceCommand intents to the appropriate agent methods:
 * - findProposals -> GovernanceAgent.executeFundingPipeline
 * - analyzeProposal -> ScoutAgent.discoverProposals + AnalyzerAgent.evaluateProposal
 * - fundProject -> GovernanceAgent.executeFundingPipeline (with specific budget)
 * - checkTreasury -> ITreasuryAgent.getBalance
 *
 * All handlers wrap agent calls in try/catch, returning { success: false } on error.
 * This is the framework-agnostic core that both ElevenLabs tools and the text
 * fallback REST API route through.
 *
 * @module voice/voice-command-router
 */

import type { VoiceCommand, VoiceIntent, VoiceResult } from './voice-types.js';
import type { GovernanceAgent } from '../agents/governance-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../agents/types.js';
import type { DecisionSummary, TreasuryBalance } from '../types/proposals.js';

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

  constructor(deps: VoiceRouterDeps) {
    this.governance = deps.governance;
    this.scout = deps.scout;
    this.analyzer = deps.analyzer;
    this.treasury = deps.treasury;
  }

  /**
   * Route a voice/text command to the appropriate agent action.
   *
   * @param command - Parsed command with intent and params
   * @returns VoiceResult with success status, message, and optional data
   */
  async execute(command: VoiceCommand): Promise<VoiceResult> {
    try {
      switch (command.intent) {
        case 'findProposals':
          return await this.handleFindProposals(command.params);
        case 'analyzeProposal':
          return await this.handleAnalyzeProposal(command.params);
        case 'fundProject':
          return await this.handleFundProject(command.params);
        case 'checkTreasury':
          return await this.handleCheckTreasury();
        default:
          return {
            success: false,
            intent: command.intent,
            message: 'Unknown command',
          };
      }
    } catch (err) {
      return {
        success: false,
        intent: command.intent,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Find proposals via governance pipeline.
   * Calls governance.executeFundingPipeline with the query and a default budget.
   */
  private async handleFindProposals(
    params: Record<string, string>,
  ): Promise<VoiceResult> {
    const query = params.query || 'new grant proposals';
    const decision: DecisionSummary =
      await this.governance.executeFundingPipeline({ query, budget: 10000 });

    const count = decision.allocations.length;
    const message = `Found ${count} proposals. ${decision.summary}`;

    return {
      success: true,
      intent: 'findProposals',
      message,
      data: decision,
    };
  }

  /**
   * Analyze a specific proposal.
   * Discovers proposals via scout, finds the matching one (or takes first),
   * then evaluates it with the analyzer agent.
   */
  private async handleAnalyzeProposal(
    params: Record<string, string>,
  ): Promise<VoiceResult> {
    const searchQuery = params.proposalId || 'proposals';
    const proposals = await this.scout.discoverProposals(searchQuery);

    if (proposals.length === 0) {
      return {
        success: false,
        intent: 'analyzeProposal',
        message: 'No proposals found to analyze',
      };
    }

    // Find matching proposal by ID, or take the first one
    const proposal =
      proposals.find((p) => p.id === params.proposalId) ?? proposals[0];

    const evaluation = await this.analyzer.evaluateProposal(proposal);

    const message =
      `Analysis of "${evaluation.proposalTitle}": ` +
      `score ${evaluation.overallScore}/10, ` +
      `recommendation: ${evaluation.recommendation}. ` +
      `${evaluation.reasoning}`;

    return {
      success: true,
      intent: 'analyzeProposal',
      message,
      data: evaluation,
    };
  }

  /**
   * Fund a project via governance pipeline.
   * Calls governance.executeFundingPipeline with the proposal query and budget.
   */
  private async handleFundProject(
    params: Record<string, string>,
  ): Promise<VoiceResult> {
    const query = params.proposalId || 'fund project';
    const budget = Number(params.amount) || 10000;

    const decision: DecisionSummary =
      await this.governance.executeFundingPipeline({ query, budget });

    const funded = decision.allocations.filter((a) => a.action === 'fund');
    const message =
      `Funding pipeline complete. ${funded.length} project(s) funded. ` +
      `Total allocated: $${decision.totalAllocated}, ` +
      `remaining: $${decision.remainingBudget}. ${decision.summary}`;

    return {
      success: true,
      intent: 'fundProject',
      message,
      data: decision,
    };
  }

  /**
   * Check treasury balance.
   * Calls treasury.getBalance and formats the result as a human-readable message.
   */
  private async handleCheckTreasury(): Promise<VoiceResult> {
    const balance: TreasuryBalance = await this.treasury.getBalance();

    const lpCount = balance.lpPositions?.length ?? 0;
    const message =
      `Treasury holds ${balance.solBalance} SOL, ` +
      `${balance.usdcBalance} USDC ` +
      `(total ~$${balance.totalValueUsd}). ` +
      `${lpCount} LP position${lpCount !== 1 ? 's' : ''} active.`;

    return {
      success: true,
      intent: 'checkTreasury',
      message,
      data: balance,
    };
  }
}
