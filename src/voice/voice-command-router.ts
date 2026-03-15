/**
 * VoiceCommandRouter -- routes intents to agent actions.
 *
 * Each intent triggers ONLY the agents it needs and emits status events
 * so the dashboard activity feed shows all agents working:
 * - checkTreasury -> Treasury agent only
 * - findProposals -> Scout + Analyzer (discover + evaluate, cached)
 * - fundProject -> Governance + Treasury (decide + transfer, uses cache)
 * - analyzeProposal -> Scout + Analyzer
 * - chat -> Claude conversational response
 *
 * @module voice/voice-command-router
 */

import Anthropic from '@anthropic-ai/sdk';
import type { VoiceCommand, VoiceResult } from './voice-types.js';
import type { GovernanceAgent } from '../agents/governance-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../agents/types.js';
import type { Evaluation, Proposal, TreasuryBalance } from '../types/proposals.js';
import type { AgentEventBus } from '../events/event-types.js';
import type { AgentMemory } from '../memory/agent-memory.js';
import type { AgentMessenger } from '../agents/agent-messenger.js';

/** Dependencies injected into VoiceCommandRouter. */
export interface VoiceRouterDeps {
  governance: GovernanceAgent;
  scout: IScoutAgent;
  analyzer: IAnalyzerAgent;
  treasury: ITreasuryAgent;
  bus: AgentEventBus;
  memory?: AgentMemory;
  messenger?: AgentMessenger;
}

export class VoiceCommandRouter {
  private readonly governance: GovernanceAgent;
  private readonly scout: IScoutAgent;
  private readonly analyzer: IAnalyzerAgent;
  private readonly treasury: ITreasuryAgent;
  private readonly bus: AgentEventBus;
  private readonly anthropic: Anthropic;
  private readonly memory: AgentMemory | null;
  private readonly messenger: AgentMessenger | null;

  /** Cached proposals from the last find command. */
  private cachedProposals: Proposal[] = [];
  /** Cached evaluations from the last find command. */
  private cachedEvaluations: Evaluation[] = [];
  /** Conversation history for chat continuity. */
  private chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  constructor(deps: VoiceRouterDeps) {
    this.governance = deps.governance;
    this.scout = deps.scout;
    this.analyzer = deps.analyzer;
    this.treasury = deps.treasury;
    this.bus = deps.bus;
    this.anthropic = new Anthropic();
    this.memory = deps.memory ?? null;
    this.messenger = deps.messenger ?? null;
  }

  /** Clear conversation history and cached proposals. */
  clearHistory(): void {
    this.chatHistory = [];
    this.cachedProposals = [];
    this.cachedEvaluations = [];
  }

  /** Emit a status event for an agent. */
  private emit(agent: 'scout' | 'analyzer' | 'treasury' | 'governance', status: string, detail?: string) {
    this.bus.emit('agent:status', { agent, status, detail, timestamp: Date.now() });
  }

  /** Emit a thinking event on the shared bus. */
  private emitThinking(agent: 'scout' | 'analyzer' | 'treasury' | 'governance', phase: 'considering' | 'weighing' | 'concluding', thought: string) {
    this.bus.emit('agent:thinking', { agent, phase, thought, timestamp: Date.now() });
  }

  /** Emit a confidence event on the shared bus. */
  private emitConfidence(agent: 'scout' | 'analyzer' | 'treasury' | 'governance', subject: string, confidence: number, reasoning: string) {
    this.bus.emit('agent:confidence', { agent, subject, confidence, reasoning, timestamp: Date.now() });
  }

  async execute(command: VoiceCommand): Promise<VoiceResult> {
    // Record the user's message in chat history
    const userText = command.params.text || command.params.query || command.intent;
    this.chatHistory.push({ role: 'user', content: userText });

    try {
      let result: VoiceResult;
      switch (command.intent) {
        case 'checkTreasury':
          result = await this.handleCheckTreasury();
          break;
        case 'findProposals':
          result = await this.handleFindProposals(command.params);
          break;
        case 'analyzeProposal':
          result = await this.handleAnalyzeProposal(command.params);
          break;
        case 'fundProject':
          result = await this.handleFundProject(command.params);
          break;
        default:
          result = await this.handleChat(userText);
          break;
      }

      // Record the agent's response in chat history
      this.chatHistory.push({ role: 'assistant', content: result.message });

      // Keep history manageable (last 20 turns)
      if (this.chatHistory.length > 40) {
        this.chatHistory = this.chatHistory.slice(-40);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.chatHistory.push({ role: 'assistant', content: message });
      return {
        success: false,
        intent: command.intent,
        message,
      };
    }
  }

  /**
   * Generate a natural language response using Claude, given structured data.
   * Includes conversation history for continuity.
   */
  private async generateResponse(intent: string, context: string): Promise<string> {
    // Build messages: prior conversation + current result to summarize
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...this.chatHistory,
      { role: 'user', content: `Summarize this ${intent} result naturally:\n\n${context}` },
    ];

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system:
        `You are AgentFund, an autonomous AI treasury manager on Solana. ` +
        `Respond naturally and conversationally based on the conversation so far. ` +
        `Include the key facts and numbers from the data provided. ` +
        `Don't use bullet points or markdown. Speak like a knowledgeable colleague giving a quick update.`,
      messages,
    });
    return response.content[0].type === 'text' ? response.content[0].text : context;
  }

  // ---- Treasury: just check balance ----

  private async handleCheckTreasury(): Promise<VoiceResult> {
    this.emitThinking('treasury', 'considering', 'Querying Solana devnet for on-chain balance data');
    this.emit('treasury', 'checking', 'Querying on-chain balances');
    const balance: TreasuryBalance = await this.treasury.getBalance();
    const lpCount = balance.lpPositions?.length ?? 0;
    this.emit('treasury', 'ready', `${balance.usdcBalance} USDC, ${balance.solBalance} SOL`);
    this.emitThinking('treasury', 'concluding',
      `Balance check complete: ${balance.solBalance} SOL, ${balance.usdcBalance} USDC (~$${balance.totalValueUsd} total), ${lpCount} LP positions`);

    const message = await this.generateResponse('treasury check',
      `SOL balance: ${balance.solBalance}, USDC balance: ${balance.usdcBalance}, ` +
      `total USD value: ~$${balance.totalValueUsd}, LP positions active: ${lpCount}.`);

    return {
      success: true,
      intent: 'checkTreasury',
      message,
      data: balance,
    };
  }

  // ---- Find: Scout discovers + Analyzer evaluates, cache results ----

  private async handleFindProposals(params: Record<string, string>): Promise<VoiceResult> {
    const query = params.query || 'new grant proposals';

    // Scout discovers
    this.emitThinking('scout', 'considering', `Preparing to search grant platforms and GitHub for "${query}"`);
    this.emit('scout', 'discovering', `Searching: "${query}"`);

    const startTime = Date.now();
    const proposals = await this.scout.discoverProposals(query);
    const discoveryMs = Date.now() - startTime;

    this.emit('scout', 'discovered', `Found ${proposals.length} proposals`);
    this.emitThinking('scout', 'concluding',
      `Discovery complete: found ${proposals.length} proposals in ${(discoveryMs / 1000).toFixed(1)}s from web scraping + AI structuring`);
    this.emitConfidence('scout', 'discovered proposals',
      proposals.length >= 3 ? 0.85 : proposals.length > 0 ? 0.6 : 0.2,
      `Found ${proposals.length} proposals — ${proposals.length >= 3 ? 'good coverage across sources' : proposals.length > 0 ? 'limited results' : 'no results found'}`);

    // Normalize amounts to demo scale
    const totalRequested = proposals.reduce((sum, p) => sum + p.requestedAmount, 0);
    if (totalRequested > 500) {
      const scale = 200 / totalRequested;
      for (const p of proposals) {
        p.requestedAmount = Math.max(1, Math.round(p.requestedAmount * scale));
      }
    }

    if (proposals.length === 0) {
      return { success: true, intent: 'findProposals', message: 'No proposals found for that query.' };
    }

    // Memory calibration context
    if (this.memory) {
      const dist = this.memory.getScoreDistribution();
      if (dist.count > 0) {
        this.emitThinking('analyzer', 'considering',
          `Calibrating evaluations against ${dist.count} past scores (historical avg: ${dist.mean}/10, stddev: ${dist.stddev})`);
      }
    }

    // Analyzer evaluates proposals in parallel (concurrency=3 for API rate limits)
    this.emitThinking('analyzer', 'considering', `Beginning parallel evaluation of ${proposals.length} proposals (concurrency: ${Math.min(3, proposals.length)})`);
    this.emit('analyzer', 'evaluating', `Evaluating ${proposals.length} proposals in parallel`);

    const evalStartTime = Date.now();
    const evaluations = await this.evaluateParallel(proposals);
    const evalMs = Date.now() - evalStartTime;

    // Emit confidence for each evaluation
    for (const evaluation of evaluations) {
      this.emitConfidence('analyzer', evaluation.proposalTitle,
        evaluation.overallScore / 10,
        `Scored ${evaluation.overallScore}/10 — Team: ${evaluation.scores.teamQuality}, Tech: ${evaluation.scores.technicalFeasibility}, Impact: ${evaluation.scores.impactPotential}, Budget: ${evaluation.scores.budgetReasonableness}. ${evaluation.recommendation}`);
    }

    // Analyzer summary thinking
    const avgScore = evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length;
    const fundable = evaluations.filter(e => e.recommendation === 'fund').length;
    this.emitThinking('analyzer', 'concluding',
      `Evaluation complete in ${(evalMs / 1000).toFixed(1)}s. Average score: ${avgScore.toFixed(1)}/10. ${fundable} of ${evaluations.length} recommended for funding.`);

    // Inter-agent conversations: Analyzer asks Scout for more data on top proposal,
    // Governance asks Analyzer for funding readiness assessment
    if (this.messenger && evaluations.length > 0) {
      const topProposal = [...evaluations].sort((a, b) => b.overallScore - a.overallScore)[0];
      const borderline = evaluations.filter(e => e.overallScore >= 5 && e.overallScore <= 7);

      // Analyzer asks Scout for additional GitHub data on the top-scoring proposal
      try {
        await this.messenger.ask('analyzer', 'scout',
          `Find GitHub data for ${topProposal.proposalTitle} — need repository stats, contributor activity, and recent commits to validate team quality score of ${topProposal.scores.teamQuality}/10`,
          { projectName: topProposal.proposalTitle, currentScore: topProposal.overallScore });
      } catch { /* non-critical */ }

      // If there are borderline proposals, Governance asks Analyzer for clarification
      if (borderline.length > 0) {
        const borderlineNames = borderline.map(e => `"${e.proposalTitle}" (${e.overallScore}/10)`).join(', ');
        try {
          await this.messenger.ask('governance', 'analyzer',
            `${borderline.length} proposal(s) scored borderline (5-7/10): ${borderlineNames}. What are the key risks and should we request deep-dive analysis before funding?`,
            { borderlineCount: borderline.length, proposals: borderline.map(e => e.proposalTitle) });
        } catch { /* non-critical */ }
      }
    }

    this.cachedProposals = proposals;
    this.cachedEvaluations = evaluations;
    for (const proposal of proposals) {
      this.governance.proposalCache.set(proposal.id, proposal);
    }

    // Persist evaluations to memory
    if (this.memory) {
      for (const evaluation of evaluations) {
        this.memory.save({
          timestamp: Date.now(),
          type: 'evaluation',
          proposalId: evaluation.proposalId,
          proposalTitle: evaluation.proposalTitle,
          data: {
            overallScore: evaluation.overallScore,
            scores: evaluation.scores,
            recommendation: evaluation.recommendation,
            reasoning: evaluation.reasoning,
          },
        });
      }
    }

    const sorted = [...evaluations].sort((a, b) => b.overallScore - a.overallScore);
    const lines = sorted.map((e) => `"${e.proposalTitle}" — ${e.overallScore}/10 (${e.recommendation}): ${e.reasoning}`);

    this.emitThinking('governance', 'considering', `Received ${evaluations.length} evaluations. ${fundable} proposals recommended for funding. Awaiting budget allocation instruction.`);
    this.emit('governance', 'ready', `${evaluations.length} proposals evaluated, awaiting funding decision`);

    const message = await this.generateResponse('proposal discovery and evaluation',
      `Discovered and evaluated ${proposals.length} proposals. Results ranked by score:\n${lines.join('\n')}\n\n` +
      `The user can now say "fund" to allocate budget to these proposals.`);

    return {
      success: true,
      intent: 'findProposals',
      message,
      data: { proposals, evaluations },
    };
  }

  /**
   * Evaluate proposals in parallel with a semaphore-based worker pool.
   * Concurrency defaults to 3 to respect Claude API rate limits.
   */
  private async evaluateParallel(proposals: Proposal[], concurrency = 3): Promise<Evaluation[]> {
    const results: Evaluation[] = new Array(proposals.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, proposals.length) }, async () => {
      while (next < proposals.length) {
        const i = next++;
        const proposal = proposals[i];
        this.emitThinking('analyzer', 'weighing', `Evaluating "${proposal.title}" — assessing team, tech, impact, and budget dimensions`);
        this.emit('analyzer', 'evaluating', `Scoring "${proposal.title}" (${i + 1}/${proposals.length})`);
        results[i] = await this.analyzer.evaluateProposal(proposal);
        this.emit('analyzer', 'evaluated', `"${proposal.title}" → ${results[i].overallScore}/10`);
      }
    });
    await Promise.all(workers);
    return results;
  }

  // ---- Analyze: Scout + Analyzer for a specific proposal ----

  private async handleAnalyzeProposal(params: Record<string, string>): Promise<VoiceResult> {
    let proposal: Proposal | undefined;
    if (this.cachedProposals.length > 0 && params.proposalId) {
      const search = params.proposalId.toLowerCase();
      proposal = this.cachedProposals.find((p) => p.title.toLowerCase().includes(search));
    }

    if (!proposal) {
      this.emit('scout', 'discovering', `Searching for "${params.proposalId || 'proposals'}"`);
      const proposals = await this.scout.discoverProposals(params.proposalId || 'proposals');
      this.emit('scout', 'discovered', `Found ${proposals.length} proposals`);
      if (proposals.length === 0) {
        return { success: false, intent: 'analyzeProposal', message: 'No proposals found to analyze' };
      }
      proposal = proposals.find((p) => p.id === params.proposalId) ?? proposals[0];
    }

    this.emitThinking('analyzer', 'considering', `Deep-diving into "${proposal.title}" — checking team, technical feasibility, impact, and budget`);
    this.emit('analyzer', 'evaluating', `Deep analysis of "${proposal.title}"`);
    const evaluation = await this.analyzer.evaluateProposal(proposal);
    this.emit('analyzer', 'evaluated', `"${proposal.title}" → ${evaluation.overallScore}/10 (${evaluation.recommendation})`);
    this.emitConfidence('analyzer', evaluation.proposalTitle, evaluation.overallScore / 10,
      `Team: ${evaluation.scores.teamQuality}/10, Tech: ${evaluation.scores.technicalFeasibility}/10, Impact: ${evaluation.scores.impactPotential}/10, Budget: ${evaluation.scores.budgetReasonableness}/10`);

    const message = await this.generateResponse('proposal analysis',
      `Proposal: "${evaluation.proposalTitle}". Overall score: ${evaluation.overallScore}/10. ` +
      `Scores — Team: ${evaluation.scores.teamQuality}/10, Technical: ${evaluation.scores.technicalFeasibility}/10, ` +
      `Impact: ${evaluation.scores.impactPotential}/10, Budget: ${evaluation.scores.budgetReasonableness}/10. ` +
      `Recommendation: ${evaluation.recommendation}. Reasoning: ${evaluation.reasoning}`);

    return {
      success: true,
      intent: 'analyzeProposal',
      message,
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

    // Memory context
    if (this.memory) {
      const stats = this.memory.getStats();
      if (stats.totalDecisions > 0) {
        this.emitThinking('governance', 'considering',
          `Drawing on ${stats.totalDecisions} past funding decisions (avg score: ${stats.avgScore}/10) to inform allocation`);
      }
    }

    this.emitThinking('governance', 'considering',
      `Beginning multi-round deliberation: reviewing ${this.cachedEvaluations.length} proposals with $${budget} USDC budget`);
    this.emit('governance', 'deciding', `Allocating $${budget} USDC across ${this.cachedEvaluations.length} proposals`);
    const decision = await this.governance.makeDecision(this.cachedEvaluations, budget, userInstruction);

    const funded = decision.allocations.filter((a) => a.action === 'fund');
    const rejected = decision.allocations.filter((a) => a.action === 'reject');
    const deferred = decision.allocations.filter((a) => a.action === 'defer');

    this.emitThinking('governance', 'concluding',
      `Decision: funding ${funded.length} project(s) for $${decision.totalAllocated} USDC, rejecting ${rejected.length}, deferring ${deferred.length}. ${decision.summary}`);
    this.emit('governance', 'decided', `${funded.length} project(s) approved for funding`);

    for (const allocation of decision.allocations) {
      if (allocation.action === 'fund') {
        this.emitThinking('treasury', 'considering', `Preparing USDC transfer of $${allocation.amount} to "${allocation.proposalTitle}"`);
        this.emit('treasury', 'transferring', `Sending $${allocation.amount} USDC to "${allocation.proposalTitle}"`);
        await this.treasury.executeFunding(allocation);
        this.emit('treasury', 'transferred', `$${allocation.amount} USDC sent to "${allocation.proposalTitle}"`);
      }
    }

    // Persist decisions to memory
    if (this.memory) {
      for (const allocation of decision.allocations) {
        this.memory.save({
          timestamp: Date.now(),
          type: 'decision',
          proposalId: allocation.proposalId,
          proposalTitle: allocation.proposalTitle,
          data: {
            action: allocation.action,
            amount: allocation.amount,
            reasoning: allocation.reasoning,
          },
        });
      }
    }

    // Clear cache after funding
    this.cachedProposals = [];
    this.cachedEvaluations = [];

    // Get current treasury balance for context
    let treasuryContext = '';
    try {
      const balance = await this.treasury.getBalance();
      treasuryContext = ` The treasury now holds ${balance.solBalance} SOL and ${balance.usdcBalance} USDC (~$${balance.totalValueUsd} total).`;
    } catch { /* ignore */ }

    const fundedDetails = funded.map((a) => `"${a.proposalTitle}" — $${a.amount} USDC (${a.reasoning})`).join('\n');
    const notFunded = decision.allocations.filter((a) => a.action !== 'fund');
    const rejectedDetails = notFunded.map((a) => `"${a.proposalTitle}" — ${a.reasoning}`).join('\n');

    const message = await this.generateResponse('funding execution',
      `User budget for this command: $${budget} USDC. Allocated: $${decision.totalAllocated} USDC.\n` +
      `Funded projects:\n${fundedDetails || 'None'}\n` +
      `Rejected/deferred:\n${rejectedDetails || 'None'}\n` +
      `Governance summary: ${decision.summary}\n` +
      `${treasuryContext}`);

    return {
      success: true,
      intent: 'fundProject',
      message,
      data: decision,
    };
  }

  // ---- Chat: Claude conversational response ----

  private async handleChat(text: string): Promise<VoiceResult> {
    const cachedContext = this.cachedEvaluations.length > 0
      ? `${this.cachedEvaluations.length} proposals evaluated and ready to fund.`
      : 'No proposals evaluated yet.';

    // Use full conversation history so Claude has context of prior messages
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...this.chatHistory.slice(0, -1), // exclude the last user message (already added by execute())
      { role: 'user', content: text },
    ];

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system:
        `You are AgentFund, an autonomous AI treasury manager on Solana. ` +
        `You coordinate 4 AI agents — Scout (discovers projects via web scraping), Analyzer (scores them), ` +
        `Governance (makes funding decisions), and Treasury (holds and sends funds on-chain). ` +
        `All agents have verified on-chain identities via Metaplex and pay each other for services using the x402 protocol. ` +
        `Current state: ${cachedContext}\n` +
        `Respond naturally and conversationally. Be concise — no bullet points, no markdown, no emojis. ` +
        `Don't volunteer treasury balance or technical details unless the user asks. ` +
        `Users just talk to you in plain language (e.g. "find me some solana projects", "fund the best one with $10"). ` +
        `Never suggest slash commands or specific syntax — just tell them what you can do in normal words.`,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : 'I can help you find and fund Solana grants.';

    return {
      success: true,
      intent: 'chat' as any,
      message: reply,
    };
  }
}
