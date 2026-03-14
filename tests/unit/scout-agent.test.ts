/**
 * Tests for ScoutAgent with 3-layer fallback (live -> cache -> stub).
 *
 * Covers:
 * - discoverProposals calls UnbrowseClient and returns parsed Proposal[]
 * - Fallback to cache when Unbrowse fails
 * - Fallback to STUB_PROPOSALS when both live and cache are empty
 * - Status event emissions at each stage
 * - Result caching and deduplication
 * - initialize() health check and shutdown()
 * - IScoutAgent interface compliance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { TypedEventBus } from '../../src/events/event-bus.js';
import type { AgentEvents } from '../../src/events/event-types.js';
import type { IScoutAgent } from '../../src/agents/types.js';
import type { Proposal } from '../../src/types/proposals.js';
import { STUB_PROPOSALS } from '../../src/agents/stubs/stub-scout.js';

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

// Import after mocks are set up
const { ScoutAgent } = await import('../../src/agents/scout-agent.js');

// --- Mock UnbrowseClient ---

function createMockUnbrowseClient() {
  return {
    resolveIntent: vi.fn<(intent: string, targetUrl?: string) => Promise<unknown>>(),
    healthCheck: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
}

// Sample Unbrowse response data for testing
const sampleUnbrowseResponse = {
  result: [
    {
      title: 'Real Grant Alpha',
      description: 'A real discovered grant',
      amount: 15000,
      team: 'Alpha Team',
      url: 'https://solana.org/grants/alpha',
    },
    {
      title: 'Real Grant Beta',
      description: 'Another discovered grant',
      amount: 25000,
      team: 'Beta Team',
      url: 'https://solana.org/grants/beta',
    },
  ],
};

describe('ScoutAgent', () => {
  let bus: TypedEventBus<AgentEvents>;
  let mockClient: ReturnType<typeof createMockUnbrowseClient>;
  let agent: InstanceType<typeof ScoutAgent>;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();
    mockClient = createMockUnbrowseClient();
    agent = new ScoutAgent(bus, mockClient as any);
  });

  describe('discoverProposals', () => {
    it('calls resolveIntent and returns parsed proposals', async () => {
      mockClient.resolveIntent.mockResolvedValue(sampleUnbrowseResponse);

      const proposals = await agent.discoverProposals('solana grants');

      expect(mockClient.resolveIntent).toHaveBeenCalled();
      // Should have proposals from the Unbrowse response
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0].title).toBe('Real Grant Alpha');
      expect(proposals[0].requestedAmount).toBe(15000);
      expect(proposals[0].sourceUrl).toBe('https://solana.org/grants/alpha');
    });

    it('falls back to cached proposals when Unbrowse returns error', async () => {
      // First call succeeds to populate cache
      mockClient.resolveIntent.mockResolvedValueOnce(sampleUnbrowseResponse);
      const firstCall = await agent.discoverProposals('solana grants');
      expect(firstCall.length).toBeGreaterThan(0);

      // Second call fails -- should return cached data
      mockClient.resolveIntent.mockRejectedValue(new Error('Connection refused'));
      const secondCall = await agent.discoverProposals('solana grants');

      expect(secondCall.length).toBeGreaterThan(0);
      expect(secondCall[0].title).toBe('Real Grant Alpha');
    });

    it('falls back to STUB_PROPOSALS when both live and cache are empty', async () => {
      mockClient.resolveIntent.mockRejectedValue(new Error('Connection refused'));

      const proposals = await agent.discoverProposals('solana grants');

      // Should return the stub proposals
      expect(proposals).toHaveLength(STUB_PROPOSALS.length);
      expect(proposals[0].id).toBe('prop-001');
      expect(proposals[0].title).toBe('Solana DeFi Analytics Dashboard');
    });

    it('always returns at least the stub proposals (pipeline never gets empty array from fallback)', async () => {
      // Unbrowse returns empty result
      mockClient.resolveIntent.mockResolvedValue({ result: [] });

      const proposals = await agent.discoverProposals('no results query');

      // Even with empty Unbrowse results, should fall back to stubs
      expect(proposals.length).toBeGreaterThanOrEqual(STUB_PROPOSALS.length);
    });

    it('caches results from successful Unbrowse call', async () => {
      mockClient.resolveIntent.mockResolvedValue(sampleUnbrowseResponse);
      await agent.discoverProposals('solana grants');

      // Now make Unbrowse fail
      mockClient.resolveIntent.mockRejectedValue(new Error('down'));
      const cached = await agent.discoverProposals('solana grants');

      // Should get cached results, not stubs
      expect(cached[0].title).toBe('Real Grant Alpha');
    });

    it('deduplicates proposals by title (case-insensitive)', async () => {
      // Return same proposals for multiple targets
      mockClient.resolveIntent.mockResolvedValue(sampleUnbrowseResponse);

      const proposals = await agent.discoverProposals('solana grants');

      // Check no duplicates
      const titles = proposals.map((p) => p.title.toLowerCase());
      const uniqueTitles = [...new Set(titles)];
      expect(titles.length).toBe(uniqueTitles.length);
    });
  });

  describe('status events', () => {
    it('emits discovering status event', async () => {
      mockClient.resolveIntent.mockResolvedValue(sampleUnbrowseResponse);

      const events: Array<{ status: string; detail?: string }> = [];
      bus.on('agent:status', (e) => {
        if (e.agent === 'scout') events.push({ status: e.status, detail: e.detail });
      });

      await agent.discoverProposals('solana grants');

      const statuses = events.map((e) => e.status);
      expect(statuses).toContain('discovering');
    });

    it('emits unbrowse-unavailable when Unbrowse fails', async () => {
      mockClient.resolveIntent.mockRejectedValue(new Error('Connection refused'));

      const events: Array<{ status: string }> = [];
      bus.on('agent:status', (e) => {
        if (e.agent === 'scout') events.push({ status: e.status });
      });

      await agent.discoverProposals('solana grants');

      const statuses = events.map((e) => e.status);
      expect(statuses).toContain('unbrowse-unavailable');
    });

    it('emits using-stub when falling back to stubs', async () => {
      mockClient.resolveIntent.mockRejectedValue(new Error('Connection refused'));

      const events: Array<{ status: string }> = [];
      bus.on('agent:status', (e) => {
        if (e.agent === 'scout') events.push({ status: e.status });
      });

      await agent.discoverProposals('solana grants');

      const statuses = events.map((e) => e.status);
      expect(statuses).toContain('using-stub');
    });
  });

  describe('lifecycle', () => {
    it('initialize calls healthCheck', async () => {
      mockClient.healthCheck.mockResolvedValue(true);

      await agent.initialize();

      expect(mockClient.healthCheck).toHaveBeenCalled();
    });

    it('initialize emits status about Unbrowse availability', async () => {
      mockClient.healthCheck.mockResolvedValue(false);

      const events: Array<{ status: string; detail?: string }> = [];
      bus.on('agent:status', (e) => {
        if (e.agent === 'scout') events.push({ status: e.status, detail: e.detail });
      });

      await agent.initialize();

      const statuses = events.map((e) => e.status);
      expect(statuses).toContain('initialized');
    });

    it('shutdown emits status and completes cleanly', async () => {
      const events: Array<{ status: string }> = [];
      bus.on('agent:status', (e) => {
        if (e.agent === 'scout') events.push({ status: e.status });
      });

      await agent.shutdown();

      const statuses = events.map((e) => e.status);
      expect(statuses).toContain('shutdown');
    });
  });

  describe('interface compliance', () => {
    it('implements IScoutAgent interface', () => {
      // Type-level assertion -- compilation proves interface compliance
      const scoutAgent: IScoutAgent = new ScoutAgent(bus, mockClient as any);
      expect(scoutAgent.discoverProposals).toBeInstanceOf(Function);
    });
  });
});
