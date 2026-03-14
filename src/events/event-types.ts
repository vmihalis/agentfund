/**
 * Agent event type definitions.
 *
 * Defines the event map for the AgentEventBus, including
 * agent status, pipeline step, and pipeline decision events.
 */

import type { AgentRole } from '../types/agents.js';
import type { TypedEventBus } from './event-bus.js';

export interface AgentStatusEvent {
  agent: AgentRole;
  status: string;
  detail?: string;
  timestamp: number;
}

export interface PipelineStepEvent {
  step: 'discover' | 'evaluate' | 'decide' | 'fund';
  status: 'started' | 'completed' | 'failed';
  detail?: Record<string, unknown>;
}

export interface PipelineDecisionEvent {
  summary: string;
  allocations: Array<{
    proposalTitle: string;
    action: 'fund' | 'reject' | 'defer';
    reasoning: string;
  }>;
}

export type AgentEvents = {
  'agent:status': [AgentStatusEvent];
  'agent:error': [{ agent: AgentRole; error: string; timestamp: number }];
  'pipeline:step': [PipelineStepEvent];
  'pipeline:decision': [PipelineDecisionEvent];
  'pipeline:funded': [{ proposalTitle: string; amount: number; txSignature: string }];
};

export type AgentEventBus = TypedEventBus<AgentEvents>;
