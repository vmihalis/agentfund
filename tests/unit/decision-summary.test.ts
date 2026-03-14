/**
 * Tests for DecisionSummary format and reasoning (GOV-04).
 *
 * Verifies that decision summaries contain human-readable reasoning
 * for each funding action, correct totals, and valid timestamps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { TypedEventBus } from '../../src/events/event-bus.js';
import type { AgentEvents } from '../../src/events/event-types.js';
import { GovernanceAgent } from '../../src/agents/governance-agent.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../../src/agents/types.js';
import type { Evaluation } from '../../src/types/proposals.js';

// Mock the keys module
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

const mockEvaluations: Evaluation[] = [
  {
    proposalId: 'prop-001',
    proposalTitle: 'DeFi Dashboard',
    scores: { teamQuality: 8, technicalFeasibility: 9, impactPotential: 7, budgetReasonableness: 8 },
    overallScore: 8,
    reasoning: 'Strong team',
    recommendation: 'fund',
  },
  {
    proposalId: 'prop-002',
    proposalTitle: 'Bridge Monitor',
    scores: { teamQuality: 5, technicalFeasibility: 6, impactPotential: 4, budgetReasonableness: 5 },
    overallScore: 5,
    reasoning: 'Weak team',
    recommendation: 'reject',
  },
];

describe('DecisionSummary Format and Reasoning (GOV-04)', () => {
  let bus: TypedEventBus<AgentEvents>;
  let agent: GovernanceAgent;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();

    const mockScout: IScoutAgent = { discoverProposals: vi.fn().mockResolvedValue([]) };
    const mockAnalyzer: IAnalyzerAgent = { evaluateProposal: vi.fn().mockResolvedValue({}) };
    const mockTreasury: ITreasuryAgent = {
      executeFunding: vi.fn().mockResolvedValue({ success: true }),
      getBalance: vi.fn().mockResolvedValue({ solBalance: 10, usdcBalance: 50000, totalValueUsd: 51500 }),
    };

    // Mock Anthropic client that returns a well-formed decision
    const mockAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              id: 'test-call',
              name: 'submit_decision',
              input: {
                summary: 'Funded 1 of 2 proposals: DeFi Dashboard approved for strong technical merit',
                allocations: [
                  {
                    proposalId: 'prop-001',
                    proposalTitle: 'DeFi Dashboard',
                    action: 'fund',
                    amount: 5000,
                    reasoning: 'Strong team with proven Solana experience and solid technical approach',
                  },
                  {
                    proposalId: 'prop-002',
                    proposalTitle: 'Bridge Monitor',
                    action: 'reject',
                    reasoning: 'Team lacks sufficient blockchain security experience for this scope',
                  },
                ],
                totalAllocated: 5000,
                remainingBudget: 15000,
              },
            },
          ],
        }),
      },
    };

    agent = new GovernanceAgent(bus, mockScout, mockAnalyzer, mockTreasury, mockAnthropicClient as any);
  });

  it('summary is a non-empty string describing the overall decision', async () => {
    const result = await agent.makeDecision(mockEvaluations, 20000);

    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('each allocation has a non-empty reasoning string', async () => {
    const result = await agent.makeDecision(mockEvaluations, 20000);

    for (const allocation of result.allocations) {
      expect(typeof allocation.reasoning).toBe('string');
      expect(allocation.reasoning.length).toBeGreaterThan(0);
    }
  });

  it('totalAllocated equals sum of funded allocation amounts', async () => {
    const result = await agent.makeDecision(mockEvaluations, 20000);

    const sumFunded = result.allocations
      .filter((a) => a.action === 'fund')
      .reduce((sum, a) => sum + (a.amount ?? 0), 0);

    expect(result.totalAllocated).toBe(sumFunded);
  });

  it('remainingBudget equals initial budget minus totalAllocated', async () => {
    const budget = 20000;
    const result = await agent.makeDecision(mockEvaluations, budget);

    expect(result.remainingBudget).toBe(budget - result.totalAllocated);
  });

  it('timestamp is a valid epoch millisecond', async () => {
    const before = Date.now();
    const result = await agent.makeDecision(mockEvaluations, 20000);
    const after = Date.now();

    expect(typeof result.timestamp).toBe('number');
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });

  describe('fallback decision summary', () => {
    let fallbackAgent: GovernanceAgent;

    beforeEach(() => {
      const failingClient = {
        messages: {
          create: vi.fn().mockRejectedValue(new Error('API unavailable')),
        },
      };

      fallbackAgent = new GovernanceAgent(
        bus,
        { discoverProposals: vi.fn().mockResolvedValue([]) },
        { evaluateProposal: vi.fn().mockResolvedValue({}) },
        {
          executeFunding: vi.fn().mockResolvedValue({ success: true }),
          getBalance: vi.fn().mockResolvedValue({ solBalance: 10, usdcBalance: 50000, totalValueUsd: 51500 }),
        },
        failingClient as any,
      );
    });

    it('fallback summary describes the overall automated decision', async () => {
      const result = await fallbackAgent.makeDecision(mockEvaluations, 20000);

      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.summary).toContain('Automated decision');
    });

    it('fallback allocations have non-empty reasoning', async () => {
      const result = await fallbackAgent.makeDecision(mockEvaluations, 20000);

      for (const allocation of result.allocations) {
        expect(allocation.reasoning.length).toBeGreaterThan(0);
      }
    });

    it('fallback totalAllocated matches sum of funded amounts', async () => {
      const result = await fallbackAgent.makeDecision(mockEvaluations, 20000);

      const sumFunded = result.allocations
        .filter((a) => a.action === 'fund')
        .reduce((sum, a) => sum + (a.amount ?? 0), 0);

      expect(result.totalAllocated).toBe(sumFunded);
    });

    it('fallback remainingBudget equals budget minus totalAllocated', async () => {
      const budget = 20000;
      const result = await fallbackAgent.makeDecision(mockEvaluations, budget);

      expect(result.remainingBudget).toBe(budget - result.totalAllocated);
    });

    it('fallback timestamp is a valid epoch millisecond', async () => {
      const before = Date.now();
      const result = await fallbackAgent.makeDecision(mockEvaluations, 20000);
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
