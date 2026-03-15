/**
 * Tests for activity log EventBus integration.
 *
 * Verifies that:
 * - createActivityLog subscribes to all 5 AgentEventBus event types
 * - agent:status events create status entries with agent name
 * - pipeline:step events create step entries with step:status message
 * - pipeline:funded events create funded entries with txSignature
 * - pipeline:decision events create decision entries with summary
 * - agent:error events create error entries
 * - getEntries(since) filters by timestamp
 * - Ring buffer drops oldest entries when exceeding MAX_ENTRIES (100)
 *
 * Uses a real TypedEventBus instance -- no mocks needed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypedEventBus } from '../../src/events/event-bus.js';
import { createActivityLog } from '../../src/events/activity-log.js';
import type { ActivityEntry } from '../../src/events/activity-log.js';
import type { AgentEvents } from '../../src/events/event-types.js';

describe('ActivityLog', () => {
  let bus: TypedEventBus<AgentEvents>;
  let log: ReturnType<typeof createActivityLog>;

  beforeEach(() => {
    bus = new TypedEventBus<AgentEvents>();
    log = createActivityLog(bus);
  });

  it('creates status entry from agent:status event', () => {
    bus.emit('agent:status', {
      agent: 'scout',
      status: 'discovering',
      detail: 'Searching for solana grants',
      timestamp: Date.now(),
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('status');
    expect(entries[0].agent).toBe('scout');
    expect(entries[0].message).toBe('Searching for solana grants');
  });

  it('uses status field as message when detail is undefined', () => {
    bus.emit('agent:status', {
      agent: 'analyzer',
      status: 'idle',
      timestamp: Date.now(),
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('idle');
  });

  it('creates step entry from pipeline:step event', () => {
    bus.emit('pipeline:step', {
      step: 'discover',
      status: 'completed',
      detail: { proposalCount: 5 },
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('step');
    expect(entries[0].message).toBe('discover: completed');
    expect(entries[0].detail).toEqual({ proposalCount: 5 });
  });

  it('creates funded entry from pipeline:funded event with txSignature', () => {
    bus.emit('pipeline:funded', {
      proposalTitle: 'Solana SDK Enhancement',
      amount: 50000,
      txSignature: '3xJ9k...',
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('funded');
    expect(entries[0].message).toBe('Funded Solana SDK Enhancement');
    expect(entries[0].txSignature).toBe('3xJ9k...');
  });

  it('creates decision entry from pipeline:decision event', () => {
    bus.emit('pipeline:decision', {
      summary: 'Approved 2 of 5 proposals for funding',
      allocations: [
        { proposalTitle: 'Proj A', action: 'fund', reasoning: 'Strong team' },
        { proposalTitle: 'Proj B', action: 'reject', reasoning: 'Weak plan' },
      ],
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('decision');
    expect(entries[0].message).toBe('Approved 2 of 5 proposals for funding');
  });

  it('creates error entry from agent:error event', () => {
    bus.emit('agent:error', {
      agent: 'treasury',
      error: 'Insufficient SOL for transaction fees',
      timestamp: Date.now(),
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('error');
    expect(entries[0].agent).toBe('treasury');
    expect(entries[0].message).toBe('Insufficient SOL for transaction fees');
  });

  it('assigns unique IDs and timestamps to each entry', () => {
    bus.emit('agent:status', {
      agent: 'scout',
      status: 'ready',
      timestamp: Date.now(),
    });
    bus.emit('agent:status', {
      agent: 'analyzer',
      status: 'ready',
      timestamp: Date.now(),
    });

    const entries = log.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBeTruthy();
    expect(entries[1].id).toBeTruthy();
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(entries[0].timestamp).toBeLessThanOrEqual(entries[1].timestamp);
  });

  it('getEntries(since) filters by timestamp', () => {
    const t1 = 1000;
    const t2 = 2000;
    const t3 = 3000;

    // Emit events with known timestamps
    bus.emit('agent:status', { agent: 'scout', status: 'a', timestamp: t1 });
    bus.emit('agent:status', { agent: 'scout', status: 'b', timestamp: t2 });
    bus.emit('agent:status', { agent: 'scout', status: 'c', timestamp: t3 });

    // Get entries since t2 (should exclude first entry at t1)
    const filtered = log.getEntries(1500);
    expect(filtered.length).toBeGreaterThanOrEqual(2);

    // All returned entries should have timestamp > 1500
    for (const entry of filtered) {
      expect(entry.timestamp).toBeGreaterThan(1500);
    }
  });

  it('ring buffer drops oldest entries when exceeding 100', () => {
    // Emit 110 events
    for (let i = 0; i < 110; i++) {
      bus.emit('agent:status', {
        agent: 'scout',
        status: `event-${i}`,
        timestamp: Date.now() + i,
      });
    }

    const entries = log.getEntries();
    expect(entries).toHaveLength(100);

    // Oldest should be event-10 (first 10 dropped)
    expect(entries[0].message).toBe('event-10');
    // Newest should be event-109
    expect(entries[99].message).toBe('event-109');
  });

  it('returns entries in chronological order', () => {
    bus.emit('pipeline:step', { step: 'discover', status: 'started' });
    bus.emit('agent:status', { agent: 'scout', status: 'working', timestamp: Date.now() });
    bus.emit('pipeline:step', { step: 'discover', status: 'completed' });

    const entries = log.getEntries();
    expect(entries).toHaveLength(3);

    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].timestamp).toBeGreaterThanOrEqual(entries[i - 1].timestamp);
    }
  });
});
