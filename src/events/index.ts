/**
 * Events module public API.
 *
 * Re-exports TypedEventBus, all event types, and AgentEventBus.
 */

export { TypedEventBus } from './event-bus.js';
export type {
  AgentStatusEvent,
  AgentThinkingEvent,
  AgentQuestionEvent,
  AgentAnswerEvent,
  AgentConfidenceEvent,
  PipelineStepEvent,
  PipelineDecisionEvent,
  AgentEvents,
  AgentEventBus,
} from './event-types.js';
