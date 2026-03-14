/**
 * Tests for AnalyzerAgent (ANLZ-01, ANLZ-02, ANLZ-03).
 *
 * Verifies that evaluateProposal calls Claude API with proposal data,
 * returns structured Evaluation with four score dimensions, human-readable
 * reasoning, and recommendation. Falls back to heuristic scoring when
 * Claude API is unavailable. Emits agent:status events during evaluation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { TypedEventBus } from '../../src/events/event-bus.js';
import type { AgentEvents } from '../../src/events/event-types.js';
import { AnalyzerAgent } from '../../src/agents/analyzer-agent.js';
import type { IAnalyzerAgent } from '../../src/agents/types.js';
import type { Proposal } from '../../src/types/proposals.js';

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

const testProposal: Proposal = {
  id: 'test-prop-1',
  title: 'Solana DEX Aggregator',
  description:
    'A decentralized exchange aggregator for optimal swap routing on Solana',
  requestedAmount: 25000,
  teamInfo:
    '3 experienced Solana developers with prior DeFi shipping history',
};

const mockClaudeResponse = {
  scores: {
    teamQuality: 8,
    technicalFeasibility: 7,
    impactPotential: 9,
    budgetReasonableness: 6,
  },
  reasoning:
    'Strong team with proven Solana track record. High ecosystem impact. Moderate budget concerns.',
  recommendation: 'fund' as const,
};

describe('AnalyzerAgent (ANLZ-01, ANLZ-02, ANLZ-03)', () => {
  let bus: TypedEventBus<AgentEvents>;
  let mockAnthropicClient: { messages: { create: ReturnType<typeof vi.fn> } };
  let agent: AnalyzerAgent;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();

    mockAnthropicClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              id: 'test-call',
              name: 'submit_evaluation',
              input: mockClaudeResponse,
            },
          ],
        }),
      },
    };

    agent = new AnalyzerAgent(bus, mockAnthropicClient as any);
  });

  it('implements IAnalyzerAgent interface', () => {
    // AnalyzerAgent should satisfy the IAnalyzerAgent contract
    const analyzerInterface: IAnalyzerAgent = agent;
    expect(analyzerInterface).toBeDefined();
    expect(typeof agent.evaluateProposal).toBe('function');
  });

  it('calls Claude API with proposal data and forced tool_choice', async () => {
    await agent.evaluateProposal(testProposal);

    expect(mockAnthropicClient.messages.create).toHaveBeenCalledOnce();
    const call = mockAnthropicClient.messages.create.mock.calls[0][0];

    // Should include tool_choice forcing submit_evaluation
    expect(call.tool_choice).toEqual({
      type: 'tool',
      name: 'submit_evaluation',
    });
    // Should include tools with submit_evaluation
    expect(call.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'submit_evaluation' }),
      ]),
    );
    // Messages should include the proposal content
    const userMessage = call.messages.find((m: any) => m.role === 'user');
    expect(userMessage).toBeDefined();
    expect(userMessage.content).toContain('Solana DEX Aggregator');
    expect(userMessage.content).toContain('25000');
  });

  it('returns Evaluation with all four score dimensions in 1-10 range', async () => {
    const evaluation = await agent.evaluateProposal(testProposal);

    expect(evaluation.scores.teamQuality).toBeGreaterThanOrEqual(1);
    expect(evaluation.scores.teamQuality).toBeLessThanOrEqual(10);
    expect(evaluation.scores.technicalFeasibility).toBeGreaterThanOrEqual(1);
    expect(evaluation.scores.technicalFeasibility).toBeLessThanOrEqual(10);
    expect(evaluation.scores.impactPotential).toBeGreaterThanOrEqual(1);
    expect(evaluation.scores.impactPotential).toBeLessThanOrEqual(10);
    expect(evaluation.scores.budgetReasonableness).toBeGreaterThanOrEqual(1);
    expect(evaluation.scores.budgetReasonableness).toBeLessThanOrEqual(10);
  });

  it('includes human-readable reasoning in evaluation (ANLZ-02)', async () => {
    const evaluation = await agent.evaluateProposal(testProposal);

    expect(typeof evaluation.reasoning).toBe('string');
    expect(evaluation.reasoning.length).toBeGreaterThan(0);
    expect(evaluation.reasoning).toContain('Solana');
  });

  it('includes recommendation (fund/reject/defer)', async () => {
    const evaluation = await agent.evaluateProposal(testProposal);

    expect(['fund', 'reject', 'defer']).toContain(evaluation.recommendation);
  });

  it('calculates overallScore as average of four dimensions', async () => {
    const evaluation = await agent.evaluateProposal(testProposal);

    const expected =
      (mockClaudeResponse.scores.teamQuality +
        mockClaudeResponse.scores.technicalFeasibility +
        mockClaudeResponse.scores.impactPotential +
        mockClaudeResponse.scores.budgetReasonableness) /
      4;
    expect(evaluation.overallScore).toBe(expected);
  });

  it('returns correct proposalId and proposalTitle', async () => {
    const evaluation = await agent.evaluateProposal(testProposal);

    expect(evaluation.proposalId).toBe('test-prop-1');
    expect(evaluation.proposalTitle).toBe('Solana DEX Aggregator');
  });

  it('falls back to heuristic scoring when Claude API throws', async () => {
    mockAnthropicClient.messages.create.mockRejectedValue(
      new Error('API rate limit'),
    );

    const evaluation = await agent.evaluateProposal(testProposal);

    // Fallback should still produce a valid Evaluation
    expect(evaluation.proposalId).toBe('test-prop-1');
    expect(evaluation.proposalTitle).toBe('Solana DEX Aggregator');
    expect(evaluation.scores.teamQuality).toBeGreaterThanOrEqual(1);
    expect(evaluation.scores.teamQuality).toBeLessThanOrEqual(10);
    expect(typeof evaluation.overallScore).toBe('number');
    expect(['fund', 'reject', 'defer']).toContain(evaluation.recommendation);
  });

  it('fallback reasoning mentions API unavailability', async () => {
    mockAnthropicClient.messages.create.mockRejectedValue(
      new Error('Network error'),
    );

    const evaluation = await agent.evaluateProposal(testProposal);

    expect(evaluation.reasoning).toContain('Claude API unavailable');
  });

  it('fallback produces deterministic scores based on proposal content', async () => {
    mockAnthropicClient.messages.create.mockRejectedValue(
      new Error('API error'),
    );

    const eval1 = await agent.evaluateProposal(testProposal);
    const eval2 = await agent.evaluateProposal(testProposal);

    // Same proposal should produce same fallback scores
    expect(eval1.scores).toEqual(eval2.scores);
    expect(eval1.overallScore).toBe(eval2.overallScore);
    expect(eval1.recommendation).toBe(eval2.recommendation);

    // Verify heuristics:
    // teamInfo length > 20 -> teamQuality = 7
    expect(eval1.scores.teamQuality).toBe(7);
    // description length > 100 -> technicalFeasibility = 7 (description is 69 chars, so 5)
    // Actually the description is: "A decentralized exchange aggregator for optimal swap routing on Solana" = ~70 chars
    // So technicalFeasibility = 5
    // impactPotential = 6
    // requestedAmount 25000 > 0 && < 50000 -> budgetReasonableness = 7
  });

  it('emits agent:status event during evaluation', async () => {
    const statusEvents: Array<{
      agent: string;
      status: string;
      detail?: string;
    }> = [];
    bus.on('agent:status', (event) => {
      statusEvents.push(event);
    });

    await agent.evaluateProposal(testProposal);

    const evaluatingEvent = statusEvents.find(
      (e) => e.status === 'evaluating',
    );
    expect(evaluatingEvent).toBeDefined();
    expect(evaluatingEvent!.agent).toBe('analyzer');
    expect(evaluatingEvent!.detail).toContain('Solana DEX Aggregator');
  });
});
