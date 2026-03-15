/**
 * End-to-end integration tests for the full AgentFund demo pipeline.
 *
 * Proves: DEMO-01 (full pipeline via text command), DEMO-02 (tx signatures),
 * DEMO-03 (multi-agent coordination visible via activity log).
 *
 * Uses stub agents (no real Solana keys needed). Mocks getWeb3Keypair
 * and getConnection to avoid key file / devnet dependencies.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Keypair } from '@solana/web3.js';

// Mock key management and Solana connection before imports
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
import { createActivityLog } from '../../src/events/activity-log.js';
import { StubScoutAgent } from '../../src/agents/stubs/stub-scout.js';
import { StubAnalyzerAgent } from '../../src/agents/stubs/stub-analyzer.js';
import { StubTreasuryAgent } from '../../src/agents/stubs/stub-treasury.js';
import { GovernanceAgent } from '../../src/agents/governance-agent.js';
import { VoiceCommandRouter } from '../../src/voice/voice-command-router.js';
import { parseTextCommand } from '../../src/voice/text-parser.js';

// --- Shared setup ---

let bus: TypedEventBus<AgentEvents>;
let activityLog: ReturnType<typeof createActivityLog>;
let scout: StubScoutAgent;
let analyzer: StubAnalyzerAgent;
let treasury: StubTreasuryAgent;
let governance: GovernanceAgent;
let router: VoiceCommandRouter;

beforeAll(() => {
  bus = new TypedEventBus<AgentEvents>();
  activityLog = createActivityLog(bus);
  scout = new StubScoutAgent(bus);
  analyzer = new StubAnalyzerAgent(bus);
  treasury = new StubTreasuryAgent(bus);
  governance = new GovernanceAgent(bus, scout, analyzer, treasury);
  router = new VoiceCommandRouter({ governance, scout, analyzer, treasury });
});

describe('End-to-End Demo Pipeline', () => {
  it('full pipeline via text command produces decision with allocations', async () => {
    const command = parseTextCommand('find promising solana projects');
    const result = await router.execute(command);

    expect(result.success).toBe(true);
    expect(result.intent).toBe('findProposals');
    expect(result.data).toBeDefined();

    const decision = result.data as {
      allocations: Array<{ proposalTitle: string; action: string }>;
      summary: string;
      totalAllocated: number;
      remainingBudget: number;
    };
    expect(Array.isArray(decision.allocations)).toBe(true);
    expect(decision.allocations.length).toBeGreaterThan(0);
    expect(decision.summary).toBeTruthy();
  });

  it('pipeline emits events captured by activity log', async () => {
    // Activity log should have entries from the pipeline run above
    const entries = activityLog.getAll();

    expect(entries.length).toBeGreaterThan(0);

    // Should have step entries for discover started/completed
    const discoverStarted = entries.find(
      (e) => e.type === 'step' && e.message.includes('discover') && e.message.includes('started'),
    );
    expect(discoverStarted).toBeDefined();

    const discoverCompleted = entries.find(
      (e) => e.type === 'step' && e.message.includes('discover') && e.message.includes('completed'),
    );
    expect(discoverCompleted).toBeDefined();

    // Should have evaluate step entries
    const evaluateStarted = entries.find(
      (e) => e.type === 'step' && e.message.includes('evaluate') && e.message.includes('started'),
    );
    expect(evaluateStarted).toBeDefined();

    const evaluateCompleted = entries.find(
      (e) => e.type === 'step' && e.message.includes('evaluate') && e.message.includes('completed'),
    );
    expect(evaluateCompleted).toBeDefined();

    // Should have a decision entry
    const decisionEntry = entries.find((e) => e.type === 'decision');
    expect(decisionEntry).toBeDefined();

    // Should have funded entries with tx signatures
    const fundedEntries = entries.filter((e) => e.type === 'funded');
    expect(fundedEntries.length).toBeGreaterThan(0);
    // StubTreasuryAgent generates stub-tx-* signatures
    for (const funded of fundedEntries) {
      expect(funded.txSignature).toBeTruthy();
      expect(funded.txSignature).toMatch(/^stub-tx-/);
    }
  });

  it('check treasury returns balance data with SOL and USDC', async () => {
    const command = parseTextCommand('check treasury balance');
    const result = await router.execute(command);

    expect(result.success).toBe(true);
    expect(result.intent).toBe('checkTreasury');
    expect(result.message).toContain('SOL');
    expect(result.message).toContain('USDC');

    const balance = result.data as {
      solBalance: number;
      usdcBalance: number;
      totalValueUsd: number;
    };
    expect(typeof balance.solBalance).toBe('number');
    expect(typeof balance.usdcBalance).toBe('number');
    expect(typeof balance.totalValueUsd).toBe('number');
  });

  it('activity log filters by timestamp', async () => {
    // Create a fresh bus and activity log for this test
    const testBus = new TypedEventBus<AgentEvents>();
    const testLog = createActivityLog(testBus);

    // Emit some early events
    testBus.emit('pipeline:step', {
      step: 'discover',
      status: 'started',
      detail: { query: 'early' },
    });

    // Record timestamp boundary
    const boundary = Date.now();

    // Small delay to ensure timestamp separation
    await new Promise((r) => setTimeout(r, 10));

    // Emit later events
    testBus.emit('pipeline:step', {
      step: 'evaluate',
      status: 'completed',
      detail: { proposal: 'late' },
    });

    // Get only entries after boundary
    const filtered = testLog.getEntries(boundary);

    // Should only contain the later event
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    for (const entry of filtered) {
      expect(entry.timestamp).toBeGreaterThan(boundary);
    }

    // All entries should be more than just the filtered set
    const all = testLog.getAll();
    expect(all.length).toBeGreaterThan(filtered.length);
  });
});
