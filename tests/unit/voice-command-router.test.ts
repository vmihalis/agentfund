/**
 * Tests for VoiceCommandRouter intent routing (VOICE-02).
 *
 * Verifies that:
 * - findProposals intent calls governance.executeFundingPipeline and returns decision data
 * - analyzeProposal intent calls scout.discoverProposals + analyzer.evaluateProposal
 * - fundProject intent calls governance.executeFundingPipeline with amount
 * - checkTreasury intent calls treasury.getBalance and returns formatted balance
 * - Unknown intent returns success: false
 * - Agent errors are caught and returned as success: false
 *
 * All agent dependencies are mocked with vi.fn() stubs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoiceCommandRouter } from '../../src/voice/voice-command-router.js';
import type { VoiceRouterDeps } from '../../src/voice/voice-command-router.js';
import type { VoiceCommand, VoiceResult } from '../../src/voice/voice-types.js';
import type { GovernanceAgent } from '../../src/agents/governance-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../../src/agents/types.js';
import type { DecisionSummary, Proposal, Evaluation, TreasuryBalance } from '../../src/types/proposals.js';

// --- Test Data ---

const mockDecisionSummary: DecisionSummary = {
  timestamp: Date.now(),
  summary: 'Funded 1 of 2 proposals',
  allocations: [
    {
      proposalId: 'prop-001',
      proposalTitle: 'DeFi Dashboard',
      action: 'fund',
      amount: 5000,
      reasoning: 'Strong team',
    },
  ],
  totalAllocated: 5000,
  remainingBudget: 5000,
};

const mockProposal: Proposal = {
  id: 'prop-001',
  title: 'DeFi Dashboard',
  description: 'Analytics dashboard',
  requestedAmount: 5000,
  teamInfo: '3 devs',
};

const mockEvaluation: Evaluation = {
  proposalId: 'prop-001',
  proposalTitle: 'DeFi Dashboard',
  scores: {
    teamQuality: 8,
    technicalFeasibility: 7,
    impactPotential: 9,
    budgetReasonableness: 8,
  },
  overallScore: 8,
  reasoning: 'Solid project',
  recommendation: 'fund',
};

const mockBalance: TreasuryBalance = {
  solBalance: 10.5,
  usdcBalance: 50000,
  totalValueUsd: 51575,
  lpPositions: [
    {
      poolAddress: 'pool-1',
      positionAddress: 'pos-1',
      tokenX: 'SOL',
      tokenY: 'USDC',
      liquidityShare: 0.05,
      unclaimedFees: 12.5,
    },
  ],
};

describe('VoiceCommandRouter', () => {
  let mockGovernance: GovernanceAgent;
  let mockScout: IScoutAgent;
  let mockAnalyzer: IAnalyzerAgent;
  let mockTreasury: ITreasuryAgent;
  let deps: VoiceRouterDeps;
  let router: VoiceCommandRouter;

  beforeEach(() => {
    mockGovernance = {
      executeFundingPipeline: vi.fn().mockResolvedValue(mockDecisionSummary),
    } as unknown as GovernanceAgent;

    mockScout = {
      discoverProposals: vi.fn().mockResolvedValue([mockProposal]),
    };

    mockAnalyzer = {
      evaluateProposal: vi.fn().mockResolvedValue(mockEvaluation),
    };

    mockTreasury = {
      executeFunding: vi.fn().mockResolvedValue({ success: true, signature: 'tx-abc' }),
      getBalance: vi.fn().mockResolvedValue(mockBalance),
    };

    deps = { governance: mockGovernance, scout: mockScout, analyzer: mockAnalyzer, treasury: mockTreasury };
    router = new VoiceCommandRouter(deps);
  });

  // --- findProposals intent ---

  it('findProposals: calls governance.executeFundingPipeline with query', async () => {
    const command: VoiceCommand = { intent: 'findProposals', params: { query: 'grants' } };
    const result = await router.execute(command);

    expect(result.success).toBe(true);
    expect(result.intent).toBe('findProposals');
    expect(mockGovernance.executeFundingPipeline).toHaveBeenCalledWith({
      query: 'grants',
      budget: 10000,
    });
    expect(result.data).toBe(mockDecisionSummary);
    expect(result.message).toContain('1'); // "Found 1 proposals" or similar
  });

  it('findProposals: uses default query when params.query is empty', async () => {
    const command: VoiceCommand = { intent: 'findProposals', params: {} };
    await router.execute(command);

    expect(mockGovernance.executeFundingPipeline).toHaveBeenCalledWith({
      query: 'new grant proposals',
      budget: 10000,
    });
  });

  // --- analyzeProposal intent ---

  it('analyzeProposal: discovers then evaluates matching proposal', async () => {
    const command: VoiceCommand = { intent: 'analyzeProposal', params: { proposalId: 'prop-001' } };
    const result = await router.execute(command);

    expect(result.success).toBe(true);
    expect(result.intent).toBe('analyzeProposal');
    expect(mockScout.discoverProposals).toHaveBeenCalled();
    expect(mockAnalyzer.evaluateProposal).toHaveBeenCalledWith(mockProposal);
    expect(result.data).toBe(mockEvaluation);
    expect(result.message).toContain('8'); // score reference
  });

  it('analyzeProposal: takes first proposal when no match found', async () => {
    const command: VoiceCommand = { intent: 'analyzeProposal', params: { proposalId: 'nonexistent' } };
    const result = await router.execute(command);

    // Should still succeed by taking the first proposal
    expect(result.success).toBe(true);
    expect(mockAnalyzer.evaluateProposal).toHaveBeenCalledWith(mockProposal);
  });

  // --- fundProject intent ---

  it('fundProject: calls governance.executeFundingPipeline with proposal and amount', async () => {
    const command: VoiceCommand = { intent: 'fundProject', params: { proposalId: 'prop-001', amount: '5000' } };
    const result = await router.execute(command);

    expect(result.success).toBe(true);
    expect(result.intent).toBe('fundProject');
    expect(mockGovernance.executeFundingPipeline).toHaveBeenCalledWith({
      query: 'prop-001',
      budget: 5000,
    });
    expect(result.data).toBe(mockDecisionSummary);
  });

  it('fundProject: uses default budget when amount not provided', async () => {
    const command: VoiceCommand = { intent: 'fundProject', params: { proposalId: 'my-project' } };
    await router.execute(command);

    expect(mockGovernance.executeFundingPipeline).toHaveBeenCalledWith({
      query: 'my-project',
      budget: 10000,
    });
  });

  // --- checkTreasury intent ---

  it('checkTreasury: calls treasury.getBalance and returns formatted message', async () => {
    const command: VoiceCommand = { intent: 'checkTreasury', params: {} };
    const result = await router.execute(command);

    expect(result.success).toBe(true);
    expect(result.intent).toBe('checkTreasury');
    expect(mockTreasury.getBalance).toHaveBeenCalled();
    expect(result.data).toBe(mockBalance);
    expect(result.message).toContain('10.5'); // SOL balance
    expect(result.message).toContain('50000'); // USDC balance
    expect(result.message).toContain('51575'); // total USD
    expect(result.message).toContain('1'); // LP positions count
  });

  // --- Unknown intent ---

  it('unknown intent: returns success false with error message', async () => {
    const command = { intent: 'unknownIntent' as any, params: {} };
    const result = await router.execute(command);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown command');
  });

  // --- Error handling ---

  it('catches agent errors and returns success: false', async () => {
    (mockGovernance.executeFundingPipeline as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Agent unavailable'));

    const command: VoiceCommand = { intent: 'findProposals', params: { query: 'grants' } };
    const result = await router.execute(command);

    expect(result.success).toBe(false);
    expect(result.intent).toBe('findProposals');
    expect(result.message).toContain('Agent unavailable');
  });

  it('catches treasury errors and returns success: false', async () => {
    (mockTreasury.getBalance as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Connection timeout'));

    const command: VoiceCommand = { intent: 'checkTreasury', params: {} };
    const result = await router.execute(command);

    expect(result.success).toBe(false);
    expect(result.intent).toBe('checkTreasury');
    expect(result.message).toContain('Connection timeout');
  });

  it('handles analyzeProposal error when no proposals found', async () => {
    (mockScout.discoverProposals as ReturnType<typeof vi.fn>)
      .mockResolvedValue([]);

    const command: VoiceCommand = { intent: 'analyzeProposal', params: { proposalId: 'prop-001' } };
    const result = await router.execute(command);

    expect(result.success).toBe(false);
    expect(result.message).toContain('No proposals');
  });
});
