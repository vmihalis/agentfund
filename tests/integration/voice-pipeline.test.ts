/**
 * Integration tests for the voice command pipeline (VOICE-01, VOICE-03).
 *
 * Proves the full pipeline: voice command -> VoiceCommandRouter -> agent method -> result.
 * Uses real StubScoutAgent, StubAnalyzerAgent, StubTreasuryAgent, and GovernanceAgent
 * with fallback decision logic (no ANTHROPIC_API_KEY needed).
 *
 * Test groups:
 * 1. VoiceCommandRouter full pipeline - all 4 intents with stub agents
 * 2. Client tools interface - createClientTools returns callable functions returning strings
 * 3. Text fallback equivalence - POST /api/voice/command matches direct router.execute
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { Keypair } from '@solana/web3.js';

// Mock getWeb3Keypair and getConnection before any agent imports
vi.mock('../../src/lib/keys.js', () => ({
  getWeb3Keypair: () => Keypair.generate(),
  getUmiSigner: vi.fn(),
  getAllWeb3Keypairs: vi.fn(),
}));

vi.mock('../../src/lib/solana/index.js', () => ({
  getConnection: () => ({}),
}));

vi.mock('../../src/lib/solana/connection.js', () => ({
  getConnection: () => ({}),
}));

import { TypedEventBus } from '../../src/events/event-bus.js';
import type { AgentEvents } from '../../src/events/event-types.js';
import { StubScoutAgent } from '../../src/agents/stubs/stub-scout.js';
import { StubAnalyzerAgent } from '../../src/agents/stubs/stub-analyzer.js';
import { StubTreasuryAgent } from '../../src/agents/stubs/stub-treasury.js';
import { GovernanceAgent } from '../../src/agents/governance-agent.js';
import { VoiceCommandRouter } from '../../src/voice/voice-command-router.js';
import { createClientTools } from '../../src/voice/voice-tools.js';
import { createVoiceServer } from '../../src/voice/voice-server.js';
import type { VoiceResult } from '../../src/voice/voice-types.js';

// --- Shared setup ---

let bus: TypedEventBus<AgentEvents>;
let scout: StubScoutAgent;
let analyzer: StubAnalyzerAgent;
let treasury: StubTreasuryAgent;
let governance: GovernanceAgent;
let router: VoiceCommandRouter;

beforeAll(() => {
  bus = new TypedEventBus<AgentEvents>();
  scout = new StubScoutAgent(bus);
  analyzer = new StubAnalyzerAgent(bus);
  treasury = new StubTreasuryAgent(bus);
  governance = new GovernanceAgent(bus, scout, analyzer, treasury);
  router = new VoiceCommandRouter({ governance, scout, analyzer, treasury });
});

// --- Test Group 1: VoiceCommandRouter full pipeline ---

describe('VoiceCommandRouter full pipeline', () => {
  it('findProposals: returns proposals via governance pipeline', async () => {
    const result = await router.execute({
      intent: 'findProposals',
      params: { query: 'solana defi grants' },
    });

    expect(result.success).toBe(true);
    expect(result.intent).toBe('findProposals');
    expect(result.message).toBeTruthy();
    expect(result.data).toBeDefined();

    // Data should be a DecisionSummary with allocations
    const decision = result.data as any;
    expect(decision.allocations).toBeDefined();
    expect(Array.isArray(decision.allocations)).toBe(true);
    expect(decision.allocations.length).toBeGreaterThan(0);
    expect(decision.summary).toBeDefined();
  });

  it('checkTreasury: returns balance data with SOL and USDC', async () => {
    const result = await router.execute({
      intent: 'checkTreasury',
      params: {},
    });

    expect(result.success).toBe(true);
    expect(result.intent).toBe('checkTreasury');
    expect(result.message).toBeTruthy();

    // Data should be a TreasuryBalance
    const balance = result.data as any;
    expect(balance.solBalance).toBeDefined();
    expect(balance.usdcBalance).toBeDefined();
    expect(typeof balance.solBalance).toBe('number');
    expect(typeof balance.usdcBalance).toBe('number');
  });

  it('fundProject: triggers governance pipeline and returns allocations', async () => {
    const result = await router.execute({
      intent: 'fundProject',
      params: { proposalId: 'prop-001', amount: '5000' },
    });

    expect(result.success).toBe(true);
    expect(result.intent).toBe('fundProject');
    expect(result.message).toBeTruthy();

    // Data should be a DecisionSummary
    const decision = result.data as any;
    expect(decision.allocations).toBeDefined();
    expect(Array.isArray(decision.allocations)).toBe(true);
  });

  it('analyzeProposal: evaluates proposal and returns scores', async () => {
    const result = await router.execute({
      intent: 'analyzeProposal',
      params: { proposalId: 'prop-001' },
    });

    expect(result.success).toBe(true);
    expect(result.intent).toBe('analyzeProposal');
    expect(result.message).toBeTruthy();

    // Data should be an Evaluation with scores
    const evaluation = result.data as any;
    expect(evaluation.scores).toBeDefined();
    expect(evaluation.overallScore).toBeDefined();
    expect(typeof evaluation.overallScore).toBe('number');
    expect(evaluation.proposalTitle).toBeDefined();
  });
});

// --- Test Group 2: Client tools interface ---

describe('Client tools interface', () => {
  it('createClientTools returns object with all 4 tool functions', () => {
    const { clientTools } = createClientTools(router);

    expect(typeof clientTools.findProposals).toBe('function');
    expect(typeof clientTools.analyzeProposal).toBe('function');
    expect(typeof clientTools.fundProject).toBe('function');
    expect(typeof clientTools.checkTreasury).toBe('function');
  });

  it('checkTreasury tool returns a string message', async () => {
    const { clientTools } = createClientTools(router);

    const message = await clientTools.checkTreasury({});
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('findProposals tool returns a string message', async () => {
    const { clientTools } = createClientTools(router);

    const message = await clientTools.findProposals({ query: 'test grants' });
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('analyzeProposal tool returns a string message', async () => {
    const { clientTools } = createClientTools(router);

    const message = await clientTools.analyzeProposal({
      proposalId: 'prop-001',
    });
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('fundProject tool returns a string message', async () => {
    const { clientTools } = createClientTools(router);

    const message = await clientTools.fundProject({
      proposalId: 'prop-001',
      amount: '5000',
    });
    expect(typeof message).toBe('string');
    expect(message.length).toBeGreaterThan(0);
  });

  it('onUnhandledClientToolCall is a function', () => {
    const { onUnhandledClientToolCall } = createClientTools(router);
    expect(typeof onUnhandledClientToolCall).toBe('function');
  });
});

// --- Test Group 3: Text fallback equivalence ---

describe('Text fallback equivalence', () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const voiceServer = createVoiceServer({ port: 0, router });
    server = await voiceServer.start();
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/voice/command "check treasury balance" returns checkTreasury intent', async () => {
    const res = await fetch(`http://localhost:${port}/api/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'check treasury balance' }),
    });

    expect(res.status).toBe(200);
    const body: VoiceResult = await res.json();
    expect(body.success).toBe(true);
    expect(body.intent).toBe('checkTreasury');
    expect(body.message).toBeTruthy();
  });

  it('POST /api/voice/command "find grant proposals" returns findProposals intent', async () => {
    const res = await fetch(`http://localhost:${port}/api/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'find grant proposals' }),
    });

    expect(res.status).toBe(200);
    const body: VoiceResult = await res.json();
    expect(body.success).toBe(true);
    expect(body.intent).toBe('findProposals');
  });

  it('text fallback response shape matches direct router.execute', async () => {
    // Direct router call
    const directResult = await router.execute({
      intent: 'checkTreasury',
      params: {},
    });

    // Text fallback via server
    const res = await fetch(`http://localhost:${port}/api/voice/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'check treasury balance' }),
    });

    const serverResult: VoiceResult = await res.json();

    // Both should have the same shape and intent
    expect(serverResult.success).toBe(directResult.success);
    expect(serverResult.intent).toBe(directResult.intent);
    // Messages should be similar (both come from same router)
    expect(typeof serverResult.message).toBe(typeof directResult.message);
    expect(serverResult.message.length).toBeGreaterThan(0);
  });
});
