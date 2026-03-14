/**
 * Tests for GovernanceAgent pipeline orchestration (GOV-01).
 *
 * Verifies that executeFundingPipeline calls scout, analyzer, and treasury
 * agents in the correct order, emits pipeline events at each step,
 * and handles empty proposal lists gracefully.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { TypedEventBus } from '../../src/events/event-bus.js';
import type { AgentEvents, PipelineStepEvent } from '../../src/events/event-types.js';
import { GovernanceAgent } from '../../src/agents/governance-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../../src/agents/types.js';
import type { Proposal, Evaluation, FundingAllocation, TransactionResult } from '../../src/types/proposals.js';

// Mock the keys module to avoid needing real key files on disk
vi.mock('../../src/lib/keys.js', () => {
  const mockKeypairs: Record<string, Keypair> = {
    scout: Keypair.generate(),
    analyzer: Keypair.generate(),
    treasury: Keypair.generate(),
    governance: Keypair.generate(),
  };
  return {
    getWeb3Keypair: (role: string) => mockKeypairs[role],
  };
});

// Mock the solana connection module
vi.mock('../../src/lib/solana/index.js', () => ({
  getConnection: () => ({ rpcEndpoint: 'https://mock.devnet.solana.com' }),
}));

// --- Test Data ---

const mockProposals: Proposal[] = [
  {
    id: 'prop-001',
    title: 'DeFi Dashboard',
    description: 'A real-time analytics dashboard',
    requestedAmount: 5000,
    teamInfo: '3 developers',
  },
  {
    id: 'prop-002',
    title: 'Bridge Monitor',
    description: 'Cross-chain bridge monitor',
    requestedAmount: 8000,
    teamInfo: '5 developers',
  },
];

function makeEvaluation(proposal: Proposal, score: number): Evaluation {
  return {
    proposalId: proposal.id,
    proposalTitle: proposal.title,
    scores: {
      teamQuality: score,
      technicalFeasibility: score,
      impactPotential: score,
      budgetReasonableness: score,
    },
    overallScore: score,
    reasoning: `Score: ${score}/10`,
    recommendation: score >= 7 ? 'fund' : 'reject',
  };
}

// --- Mock Anthropic Client ---

function createMockAnthropicClient(allocations?: FundingAllocation[]) {
  const defaultAllocations: FundingAllocation[] = [
    {
      proposalId: 'prop-001',
      proposalTitle: 'DeFi Dashboard',
      action: 'fund',
      amount: 5000,
      reasoning: 'Strong team and feasible plan',
    },
    {
      proposalId: 'prop-002',
      proposalTitle: 'Bridge Monitor',
      action: 'reject',
      reasoning: 'Budget too high for scope',
    },
  ];

  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'test-tool-call',
            name: 'submit_decision',
            input: {
              summary: 'Funded 1 of 2 proposals based on evaluation scores',
              allocations: allocations ?? defaultAllocations,
              totalAllocated: 5000,
              remainingBudget: 15000,
            },
          },
        ],
      }),
    },
  };
}

describe('GovernanceAgent Pipeline Orchestration (GOV-01)', () => {
  let bus: TypedEventBus<AgentEvents>;
  let mockScout: IScoutAgent;
  let mockAnalyzer: IAnalyzerAgent;
  let mockTreasury: ITreasuryAgent;
  let mockAnthropicClient: ReturnType<typeof createMockAnthropicClient>;
  let agent: GovernanceAgent;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();

    mockScout = {
      discoverProposals: vi.fn<(query: string) => Promise<Proposal[]>>().mockResolvedValue(mockProposals),
    };

    mockAnalyzer = {
      evaluateProposal: vi.fn<(proposal: Proposal) => Promise<Evaluation>>()
        .mockImplementation((p: Proposal) => Promise.resolve(makeEvaluation(p, 8))),
    };

    mockTreasury = {
      executeFunding: vi.fn<(allocation: FundingAllocation) => Promise<TransactionResult>>()
        .mockResolvedValue({ success: true, signature: 'stub-tx-abc123' }),
      getBalance: vi.fn().mockResolvedValue({
        solBalance: 10,
        usdcBalance: 50000,
        totalValueUsd: 51500,
      }),
    };

    mockAnthropicClient = createMockAnthropicClient();

    agent = new GovernanceAgent(bus, mockScout, mockAnalyzer, mockTreasury, mockAnthropicClient as any);
  });

  it('calls scout.discoverProposals with the query', async () => {
    await agent.executeFundingPipeline({ query: 'solana grants', budget: 20000 });
    expect(mockScout.discoverProposals).toHaveBeenCalledWith('solana grants');
  });

  it('calls analyzer.evaluateProposal for each discovered proposal', async () => {
    await agent.executeFundingPipeline({ query: 'solana grants', budget: 20000 });
    expect(mockAnalyzer.evaluateProposal).toHaveBeenCalledTimes(2);
    expect(mockAnalyzer.evaluateProposal).toHaveBeenCalledWith(mockProposals[0]);
    expect(mockAnalyzer.evaluateProposal).toHaveBeenCalledWith(mockProposals[1]);
  });

  it('calls treasury.executeFunding for funded allocations', async () => {
    await agent.executeFundingPipeline({ query: 'solana grants', budget: 20000 });
    // Only the 'fund' allocation should trigger treasury
    expect(mockTreasury.executeFunding).toHaveBeenCalledTimes(1);
    const call = (mockTreasury.executeFunding as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.action).toBe('fund');
    expect(call.proposalTitle).toBe('DeFi Dashboard');
  });

  it('pipeline calls agents in correct order: discover -> evaluate -> decide -> fund', async () => {
    const callOrder: string[] = [];

    (mockScout.discoverProposals as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('discover');
      return mockProposals;
    });

    (mockAnalyzer.evaluateProposal as ReturnType<typeof vi.fn>).mockImplementation(async (p: Proposal) => {
      callOrder.push(`evaluate:${p.id}`);
      return makeEvaluation(p, 8);
    });

    mockAnthropicClient.messages.create.mockImplementation(async () => {
      callOrder.push('decide');
      return {
        content: [{
          type: 'tool_use',
          id: 'test',
          name: 'submit_decision',
          input: {
            summary: 'Test decision',
            allocations: [{
              proposalId: 'prop-001',
              proposalTitle: 'DeFi Dashboard',
              action: 'fund',
              amount: 5000,
              reasoning: 'Approved',
            }],
            totalAllocated: 5000,
            remainingBudget: 15000,
          },
        }],
      };
    });

    (mockTreasury.executeFunding as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('fund');
      return { success: true, signature: 'tx-123' };
    });

    await agent.executeFundingPipeline({ query: 'solana grants', budget: 20000 });

    expect(callOrder).toEqual([
      'discover',
      'evaluate:prop-001',
      'evaluate:prop-002',
      'decide',
      'fund',
    ]);
  });

  it('emits pipeline:step events at each stage', async () => {
    const stepEvents: PipelineStepEvent[] = [];
    bus.on('pipeline:step', (event) => stepEvents.push(event));

    await agent.executeFundingPipeline({ query: 'solana grants', budget: 20000 });

    // discover started, discover completed, evaluate started x2, evaluate completed x2, decide, fund
    const steps = stepEvents.map((e) => `${e.step}:${e.status}`);

    expect(steps).toContain('discover:started');
    expect(steps).toContain('discover:completed');
    expect(steps).toContain('evaluate:started');
    expect(steps).toContain('evaluate:completed');
  });

  it('returns a DecisionSummary with allocations array', async () => {
    const result = await agent.executeFundingPipeline({ query: 'solana grants', budget: 20000 });

    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('allocations');
    expect(result).toHaveProperty('totalAllocated');
    expect(result).toHaveProperty('remainingBudget');
    expect(Array.isArray(result.allocations)).toBe(true);
  });

  it('handles empty proposals gracefully with empty allocations', async () => {
    (mockScout.discoverProposals as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await agent.executeFundingPipeline({ query: 'no results', budget: 20000 });

    expect(result.allocations).toEqual([]);
    expect(result.totalAllocated).toBe(0);
    expect(result.remainingBudget).toBe(20000);
    expect(mockAnalyzer.evaluateProposal).not.toHaveBeenCalled();
    expect(mockTreasury.executeFunding).not.toHaveBeenCalled();
  });
});
