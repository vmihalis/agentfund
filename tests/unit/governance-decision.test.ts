/**
 * Tests for GovernanceAgent decision aggregation (GOV-02).
 *
 * Verifies that makeDecision calls Claude API with evaluations and budget,
 * returns typed FundingDecision, and falls back to score-threshold
 * decisions when Claude API fails.
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
    reasoning: 'Strong team and solid tech',
    recommendation: 'fund',
  },
  {
    proposalId: 'prop-002',
    proposalTitle: 'Bridge Monitor',
    scores: { teamQuality: 5, technicalFeasibility: 6, impactPotential: 4, budgetReasonableness: 5 },
    overallScore: 5,
    reasoning: 'Weak team and unclear scope',
    recommendation: 'reject',
  },
  {
    proposalId: 'prop-003',
    proposalTitle: 'Mobile Wallet SDK',
    scores: { teamQuality: 9, technicalFeasibility: 8, impactPotential: 9, budgetReasonableness: 7 },
    overallScore: 8.25,
    reasoning: 'Excellent team and high impact',
    recommendation: 'fund',
  },
];

describe('GovernanceAgent Decision Making (GOV-02)', () => {
  let bus: TypedEventBus<AgentEvents>;
  let mockScout: IScoutAgent;
  let mockAnalyzer: IAnalyzerAgent;
  let mockTreasury: ITreasuryAgent;
  let mockAnthropicClient: { messages: { create: ReturnType<typeof vi.fn> } };
  let agent: GovernanceAgent;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();

    mockScout = { discoverProposals: vi.fn().mockResolvedValue([]) };
    mockAnalyzer = { evaluateProposal: vi.fn().mockResolvedValue({}) };
    mockTreasury = {
      executeFunding: vi.fn().mockResolvedValue({ success: true }),
      getBalance: vi.fn().mockResolvedValue({ solBalance: 10, usdcBalance: 50000, totalValueUsd: 51500 }),
    };

    mockAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              id: 'test-call',
              name: 'submit_decision',
              input: {
                summary: 'Funded 2 of 3 proposals based on team quality and impact potential',
                allocations: [
                  {
                    proposalId: 'prop-001',
                    proposalTitle: 'DeFi Dashboard',
                    action: 'fund',
                    amount: 5000,
                    reasoning: 'Strong team with proven Solana experience',
                  },
                  {
                    proposalId: 'prop-002',
                    proposalTitle: 'Bridge Monitor',
                    action: 'reject',
                    reasoning: 'Team lacks sufficient experience for scope',
                  },
                  {
                    proposalId: 'prop-003',
                    proposalTitle: 'Mobile Wallet SDK',
                    action: 'fund',
                    amount: 12000,
                    reasoning: 'High-impact project with excellent team',
                  },
                ],
                totalAllocated: 17000,
                remainingBudget: 3000,
              },
            },
          ],
        }),
      },
    };

    agent = new GovernanceAgent(bus, mockScout, mockAnalyzer, mockTreasury, mockAnthropicClient as any);
  });

  it('makeDecision calls Claude API with evaluations and budget', async () => {
    await agent.makeDecision(mockEvaluations, 20000);

    expect(mockAnthropicClient.messages.create).toHaveBeenCalledOnce();
    const call = mockAnthropicClient.messages.create.mock.calls[0][0];

    // Should include tool_choice forcing submit_decision
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'submit_decision' });
    // Should include tools with submit_decision
    expect(call.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'submit_decision' }),
      ]),
    );
    // Messages should include the evaluations
    const userMessage = call.messages.find((m: any) => m.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage.content).toContain('DeFi Dashboard');
  });

  it('makeDecision returns a DecisionSummary with correct shape', async () => {
    const result = await agent.makeDecision(mockEvaluations, 20000);

    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('number');
    expect(result).toHaveProperty('summary');
    expect(typeof result.summary).toBe('string');
    expect(result).toHaveProperty('allocations');
    expect(Array.isArray(result.allocations)).toBe(true);
    expect(result).toHaveProperty('totalAllocated');
    expect(typeof result.totalAllocated).toBe('number');
    expect(result).toHaveProperty('remainingBudget');
    expect(typeof result.remainingBudget).toBe('number');
  });

  it('falls back to score-threshold decision when Claude API throws', async () => {
    mockAnthropicClient.messages.create.mockRejectedValue(new Error('API rate limit'));

    const result = await agent.makeDecision(mockEvaluations, 20000);

    // Fallback should still produce a valid DecisionSummary
    expect(result).toHaveProperty('summary');
    expect(result.summary).toContain('Claude API unavailable');
    expect(result.allocations.length).toBeGreaterThan(0);
  });

  it('fallback decision funds proposals with overallScore >= 7', async () => {
    mockAnthropicClient.messages.create.mockRejectedValue(new Error('Network error'));

    const result = await agent.makeDecision(mockEvaluations, 50000);

    // prop-001 (score 8) and prop-003 (score 8.25) should be funded
    // prop-002 (score 5) should be rejected
    const funded = result.allocations.filter((a) => a.action === 'fund');
    const rejected = result.allocations.filter((a) => a.action === 'reject');

    expect(funded.length).toBe(2);
    expect(rejected.length).toBe(1);
    expect(rejected[0].proposalTitle).toBe('Bridge Monitor');
  });

  it('fallback decision includes reasoning explaining auto-generation', async () => {
    mockAnthropicClient.messages.create.mockRejectedValue(new Error('API error'));

    const result = await agent.makeDecision(mockEvaluations, 50000);

    for (const allocation of result.allocations) {
      expect(allocation.reasoning).toContain('Claude API unavailable');
    }
  });

  it('fallback decision respects the available budget', async () => {
    mockAnthropicClient.messages.create.mockRejectedValue(new Error('API error'));

    // Budget of 6000 can only fund prop-001 (5000) but not prop-003 (12000)
    const result = await agent.makeDecision(mockEvaluations, 6000);

    const funded = result.allocations.filter((a) => a.action === 'fund');
    const totalFunded = funded.reduce((sum, a) => sum + (a.amount ?? 0), 0);

    expect(totalFunded).toBeLessThanOrEqual(6000);
    expect(result.totalAllocated).toBeLessThanOrEqual(6000);
    expect(result.remainingBudget).toBeGreaterThanOrEqual(0);
  });
});
