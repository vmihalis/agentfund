/**
 * Generic TypedEventBus wrapping Node.js EventEmitter.
 *
 * Provides compile-time type safety for event names and payloads.
 * Generic over TEvents which maps event names to payload tuples.
 */

import { EventEmitter } from 'events';

export class TypedEventBus<TEvents extends Record<string, any[]>> {
  private emitter = new EventEmitter();

  emit<K extends keyof TEvents & string>(
    event: K,
    ...args: TEvents[K]
  ): boolean {
    return this.emitter.emit(event, ...args);
  }

  on<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void,
  ): this {
    this.emitter.on(event, listener as (...args: any[]) => void);
    return this;
  }

  off<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void,
  ): this {
    this.emitter.off(event, listener as (...args: any[]) => void);
    return this;
  }

  once<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void,
  ): this {
    this.emitter.once(event, listener as (...args: any[]) => void);
    return this;
  }

  removeAllListeners<K extends keyof TEvents & string>(event?: K): this {
    if (event === undefined) {
      this.emitter.removeAllListeners();
    } else {
      this.emitter.removeAllListeners(event);
    }
    return this;
  }
}
