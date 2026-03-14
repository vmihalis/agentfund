/**
 * Abstract BaseAgent class providing keypair, event bus, and lifecycle hooks.
 *
 * All agents in the system extend BaseAgent. It provides:
 * - Keypair access via getWeb3Keypair for the agent's role
 * - Event bus connection for emitting status events
 * - Solana Connection access
 * - Abstract initialize() and shutdown() lifecycle methods
 */

import { Keypair } from '@solana/web3.js';
import { getWeb3Keypair } from '../lib/keys.js';
import { getConnection } from '../lib/solana/index.js';
import type { AgentRole } from '../types/agents.js';
import type { AgentEventBus } from '../events/event-types.js';

export abstract class BaseAgent {
  readonly role: AgentRole;
  readonly keypair: Keypair;
  protected readonly bus: AgentEventBus;

  constructor(role: AgentRole, bus: AgentEventBus) {
    this.role = role;
    this.keypair = getWeb3Keypair(role);
    this.bus = bus;
  }

  get publicKey() {
    return this.keypair.publicKey;
  }

  protected get connection() {
    return getConnection();
  }

  /** Emit a lifecycle/status event on the bus. */
  protected emitStatus(status: string, detail?: string): void {
    this.bus.emit('agent:status', {
      agent: this.role,
      status,
      detail,
      timestamp: Date.now(),
    });
  }

  /** Initialize agent (connect, verify identity, etc.) */
  abstract initialize(): Promise<void>;

  /** Graceful shutdown */
  abstract shutdown(): Promise<void>;
}
