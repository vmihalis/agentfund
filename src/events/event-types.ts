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
  metadata?: {
    confidence?: number;
    reasoning?: string;
    duration_ms?: number;
  };
}

export interface AgentThinkingEvent {
  agent: AgentRole;
  phase: 'considering' | 'weighing' | 'concluding';
  thought: string;
  timestamp: number;
}

export interface AgentQuestionEvent {
  from: AgentRole;
  to: AgentRole;
  question: string;
  context?: Record<string, unknown>;
  correlationId: string;
  timestamp: number;
}

export interface AgentAnswerEvent {
  from: AgentRole;
  to: AgentRole;
  answer: string;
  correlationId: string;
  timestamp: number;
}

export interface AgentConfidenceEvent {
  agent: AgentRole;
  subject: string;
  confidence: number;
  reasoning: string;
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
  'agent:thinking': [AgentThinkingEvent];
  'agent:question': [AgentQuestionEvent];
  'agent:answer': [AgentAnswerEvent];
  'agent:confidence': [AgentConfidenceEvent];
  'pipeline:step': [PipelineStepEvent];
  'pipeline:decision': [PipelineDecisionEvent];
  'pipeline:funded': [{ proposalTitle: string; amount: number; txSignature: string }];
};

export type AgentEventBus = TypedEventBus<AgentEvents>;
