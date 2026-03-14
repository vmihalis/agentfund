/**
 * Tests for BaseAgent, agent interfaces, and stub implementations.
 *
 * Creates a concrete TestAgent extending BaseAgent for testing.
 * Verifies keypair loading, role, publicKey, emitStatus behavior,
 * and that stub agents satisfy their interfaces.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { TypedEventBus } from '../../src/events/event-bus.js';
import type { AgentEvents } from '../../src/events/event-types.js';
import { BaseAgent } from '../../src/agents/base-agent.js';
import { StubScoutAgent } from '../../src/agents/stubs/stub-scout.js';
import { StubAnalyzerAgent } from '../../src/agents/stubs/stub-analyzer.js';
import { StubTreasuryAgent } from '../../src/agents/stubs/stub-treasury.js';
import type { IScoutAgent, IAnalyzerAgent, ITreasuryAgent } from '../../src/agents/types.js';

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

/** Concrete test subclass of BaseAgent */
class TestAgent extends BaseAgent {
  async initialize(): Promise<void> {
    this.emitStatus('initialized', 'TestAgent ready');
  }
  async shutdown(): Promise<void> {
    this.emitStatus('shutdown', 'TestAgent stopped');
  }

  /** Expose protected emitStatus for testing */
  public testEmitStatus(status: string, detail?: string): void {
    this.emitStatus(status, detail);
  }
}

describe('BaseAgent', () => {
  let bus: TypedEventBus<AgentEvents>;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();
  });

  it('can be instantiated with a role and bus', () => {
    const agent = new TestAgent('scout', bus);
    expect(agent).toBeInstanceOf(BaseAgent);
  });

  it('role returns the role string', () => {
    const agent = new TestAgent('governance', bus);
    expect(agent.role).toBe('governance');
  });

  it('publicKey returns the correct public key for the given role', () => {
    const agent = new TestAgent('analyzer', bus);
    // publicKey should be a valid PublicKey instance
    expect(agent.publicKey).toBeDefined();
    expect(agent.publicKey.toBase58()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it('emitStatus emits an agent:status event on the bus with correct payload shape', () => {
    const agent = new TestAgent('treasury', bus);
    const listener = vi.fn();
    bus.on('agent:status', listener);

    agent.testEmitStatus('running', 'doing work');

    expect(listener).toHaveBeenCalledOnce();
    const payload = listener.mock.calls[0][0];
    expect(payload).toMatchObject({
      agent: 'treasury',
      status: 'running',
      detail: 'doing work',
    });
    expect(typeof payload.timestamp).toBe('number');
    expect(payload.timestamp).toBeGreaterThan(0);
  });

  it('initialize and shutdown are callable lifecycle methods', async () => {
    const agent = new TestAgent('scout', bus);
    const listener = vi.fn();
    bus.on('agent:status', listener);

    await agent.initialize();
    await agent.shutdown();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0].status).toBe('initialized');
    expect(listener.mock.calls[1][0].status).toBe('shutdown');
  });
});

describe('StubScoutAgent', () => {
  let bus: TypedEventBus<AgentEvents>;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();
  });

  it('implements IScoutAgent interface', () => {
    const scout: IScoutAgent = new StubScoutAgent(bus);
    expect(scout.discoverProposals).toBeDefined();
  });

  it('discoverProposals returns an array of Proposal objects', async () => {
    const scout = new StubScoutAgent(bus);
    const proposals = await scout.discoverProposals('solana grants');

    expect(Array.isArray(proposals)).toBe(true);
    expect(proposals.length).toBeGreaterThanOrEqual(2);

    for (const p of proposals) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('title');
      expect(p).toHaveProperty('description');
      expect(p).toHaveProperty('requestedAmount');
      expect(p).toHaveProperty('teamInfo');
      expect(typeof p.id).toBe('string');
      expect(typeof p.title).toBe('string');
      expect(typeof p.requestedAmount).toBe('number');
    }
  });
});

describe('StubAnalyzerAgent', () => {
  let bus: TypedEventBus<AgentEvents>;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();
  });

  it('implements IAnalyzerAgent interface', () => {
    const analyzer: IAnalyzerAgent = new StubAnalyzerAgent(bus);
    expect(analyzer.evaluateProposal).toBeDefined();
  });

  it('evaluateProposal returns an Evaluation object with scores', async () => {
    const analyzer = new StubAnalyzerAgent(bus);
    const evaluation = await analyzer.evaluateProposal({
      id: 'test-001',
      title: 'Test Proposal',
      description: 'A test proposal',
      requestedAmount: 5000,
      teamInfo: '3 developers',
    });

    expect(evaluation).toHaveProperty('proposalId', 'test-001');
    expect(evaluation).toHaveProperty('proposalTitle', 'Test Proposal');
    expect(evaluation).toHaveProperty('scores');
    expect(evaluation.scores).toHaveProperty('teamQuality');
    expect(evaluation.scores).toHaveProperty('technicalFeasibility');
    expect(evaluation.scores).toHaveProperty('impactPotential');
    expect(evaluation.scores).toHaveProperty('budgetReasonableness');
    expect(typeof evaluation.overallScore).toBe('number');
    expect(typeof evaluation.reasoning).toBe('string');
    expect(['fund', 'reject', 'defer']).toContain(evaluation.recommendation);
  });
});

describe('StubTreasuryAgent', () => {
  let bus: TypedEventBus<AgentEvents>;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();
  });

  it('implements ITreasuryAgent interface', () => {
    const treasury: ITreasuryAgent = new StubTreasuryAgent(bus);
    expect(treasury.executeFunding).toBeDefined();
    expect(treasury.getBalance).toBeDefined();
  });

  it('executeFunding returns a TransactionResult', async () => {
    const treasury = new StubTreasuryAgent(bus);
    const result = await treasury.executeFunding({
      proposalId: 'test-001',
      proposalTitle: 'Test Proposal',
      action: 'fund',
      amount: 5000,
      reasoning: 'Good project',
    });

    expect(result).toHaveProperty('success', true);
    expect(typeof result.signature).toBe('string');
    expect(result.signature).toMatch(/^stub-tx-/);
  });

  it('getBalance returns a TreasuryBalance', async () => {
    const treasury = new StubTreasuryAgent(bus);
    const balance = await treasury.getBalance();

    expect(typeof balance.solBalance).toBe('number');
    expect(typeof balance.usdcBalance).toBe('number');
    expect(typeof balance.totalValueUsd).toBe('number');
    expect(balance.solBalance).toBeGreaterThan(0);
    expect(balance.usdcBalance).toBeGreaterThan(0);
  });
});
