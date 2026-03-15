/**
 * AgentMessenger -- request/response layer on top of the event bus.
 *
 * Enables inter-agent communication with full UI visibility.
 * Questions and answers are emitted as events so the dashboard
 * can render agent conversations in real-time.
 */

import { randomUUID } from 'crypto';
import type { AgentRole } from '../types/agents.js';
import type { AgentEventBus } from '../events/event-types.js';

/** Handler function registered by an agent to respond to questions. */
export type QuestionHandler = (question: string, context?: Record<string, unknown>) => Promise<string>;

export class AgentMessenger {
  private readonly bus: AgentEventBus;
  private readonly handlers = new Map<AgentRole, QuestionHandler>();

  constructor(bus: AgentEventBus) {
    this.bus = bus;
  }

  /**
   * Register a handler for an agent role.
   * When another agent asks this role a question, the handler is invoked.
   */
  register(role: AgentRole, handler: QuestionHandler): void {
    this.handlers.set(role, handler);
  }

  /**
   * Ask another agent a question.
   * Emits question and answer events for UI visibility,
   * routes to the registered handler, and returns the response.
   */
  async ask(from: AgentRole, to: AgentRole, question: string, context?: Record<string, unknown>): Promise<string> {
    const correlationId = randomUUID();

    // Emit question event
    this.bus.emit('agent:question', {
      from,
      to,
      question,
      context,
      correlationId,
      timestamp: Date.now(),
    });

    // Route to handler
    const handler = this.handlers.get(to);
    if (!handler) {
      const fallback = `Agent ${to} has no registered handler`;
      this.bus.emit('agent:answer', {
        from: to,
        to: from,
        answer: fallback,
        correlationId,
        timestamp: Date.now(),
      });
      return fallback;
    }

    const answer = await handler(question, context);

    // Emit answer event
    this.bus.emit('agent:answer', {
      from: to,
      to: from,
      answer,
      correlationId,
      timestamp: Date.now(),
    });

    return answer;
  }
}
