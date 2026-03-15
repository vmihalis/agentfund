/**
 * Activity Log - EventBus event capture into queryable ring buffer.
 *
 * Subscribes to all AgentEventBus event types and records each as an
 * ActivityEntry. The internal buffer caps at MAX_ENTRIES (100) entries,
 * dropping the oldest when exceeded. Entries are queryable by timestamp.
 */

import { randomUUID } from 'crypto';
import type { AgentEventBus } from './event-types.js';

const MAX_ENTRIES = 100;

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'status' | 'step' | 'decision' | 'funded' | 'error' | 'thinking' | 'question' | 'answer' | 'confidence';
  agent?: string;
  message: string;
  detail?: Record<string, unknown>;
  txSignature?: string;
  targetAgent?: string;
  confidence?: number;
  correlationId?: string;
  phase?: 'considering' | 'weighing' | 'concluding';
}

/**
 * Create an activity log that subscribes to all AgentEventBus events.
 *
 * @param bus - The typed event bus to subscribe to
 * @returns Object with getEntries(since?) for querying captured events
 */
export function createActivityLog(bus: AgentEventBus) {
  const entries: ActivityEntry[] = [];

  function push(entry: ActivityEntry): void {
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries.shift();
    }
  }

  // Subscribe to agent:status
  bus.on('agent:status', (event) => {
    push({
      id: randomUUID(),
      timestamp: event.timestamp,
      type: 'status',
      agent: event.agent,
      message: event.detail ?? event.status,
    });
  });

  // Subscribe to agent:error
  bus.on('agent:error', (event) => {
    push({
      id: randomUUID(),
      timestamp: event.timestamp,
      type: 'error',
      agent: event.agent,
      message: event.error,
    });
  });

  // Subscribe to agent:thinking
  bus.on('agent:thinking', (event) => {
    push({
      id: randomUUID(),
      timestamp: event.timestamp,
      type: 'thinking',
      agent: event.agent,
      message: event.thought,
      phase: event.phase,
    });
  });

  // Subscribe to agent:question
  bus.on('agent:question', (event) => {
    push({
      id: randomUUID(),
      timestamp: event.timestamp,
      type: 'question',
      agent: event.from,
      targetAgent: event.to,
      message: event.question,
      correlationId: event.correlationId,
      detail: event.context,
    });
  });

  // Subscribe to agent:answer
  bus.on('agent:answer', (event) => {
    push({
      id: randomUUID(),
      timestamp: event.timestamp,
      type: 'answer',
      agent: event.from,
      targetAgent: event.to,
      message: event.answer,
      correlationId: event.correlationId,
    });
  });

  // Subscribe to agent:confidence
  bus.on('agent:confidence', (event) => {
    push({
      id: randomUUID(),
      timestamp: event.timestamp,
      type: 'confidence',
      agent: event.agent,
      message: `${event.subject}: ${event.reasoning}`,
      confidence: event.confidence,
    });
  });

  // Subscribe to pipeline:step
  bus.on('pipeline:step', (event) => {
    push({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'step',
      message: `${event.step}: ${event.status}`,
      detail: event.detail as Record<string, unknown> | undefined,
    });
  });

  // Subscribe to pipeline:decision
  bus.on('pipeline:decision', (event) => {
    push({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'decision',
      message: event.summary,
    });
  });

  // Subscribe to pipeline:funded
  bus.on('pipeline:funded', (event) => {
    push({
      id: randomUUID(),
      timestamp: Date.now(),
      type: 'funded',
      message: `Funded ${event.proposalTitle}`,
      txSignature: event.txSignature,
    });
  });

  return {
    /**
     * Get activity entries, optionally filtered by timestamp.
     * @param since - Only return entries with timestamp > since
     */
    getEntries(since?: number): ActivityEntry[] {
      if (since !== undefined) {
        return entries.filter((e) => e.timestamp > since);
      }
      return [...entries];
    },

    /**
     * Get all entries (alias for getEntries with no filter).
     */
    getAll(): ActivityEntry[] {
      return [...entries];
    },
  };
}
