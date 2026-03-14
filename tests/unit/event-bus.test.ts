/**
 * Tests for TypedEventBus.
 *
 * Verifies emit/on, once, off, removeAllListeners behaviors
 * using a simple test event map.
 */

import { describe, it, expect, vi } from 'vitest';
import { TypedEventBus } from '../../src/events/event-bus.js';

/** Simple test event map for verifying bus behavior. */
type TestEvents = {
  'test:message': [{ text: string }];
  'test:count': [number];
  'test:multi': [string, number];
};

describe('TypedEventBus', () => {
  it('emit/on: emitting an event triggers the registered listener with correct args', () => {
    const bus = new TypedEventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('test:message', listener);
    bus.emit('test:message', { text: 'hello' });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('emit/on: supports multiple listeners for the same event', () => {
    const bus = new TypedEventBus<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    bus.on('test:count', listener1);
    bus.on('test:count', listener2);
    bus.emit('test:count', 42);

    expect(listener1).toHaveBeenCalledWith(42);
    expect(listener2).toHaveBeenCalledWith(42);
  });

  it('once: listener fires exactly once then auto-removes', () => {
    const bus = new TypedEventBus<TestEvents>();
    const listener = vi.fn();

    bus.once('test:count', listener);
    bus.emit('test:count', 1);
    bus.emit('test:count', 2);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(1);
  });

  it('off: removed listener does not fire on subsequent emits', () => {
    const bus = new TypedEventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('test:message', listener);
    bus.emit('test:message', { text: 'first' });
    expect(listener).toHaveBeenCalledOnce();

    bus.off('test:message', listener);
    bus.emit('test:message', { text: 'second' });
    expect(listener).toHaveBeenCalledOnce(); // still 1, not 2
  });

  it('removeAllListeners: clears all listeners for a given event', () => {
    const bus = new TypedEventBus<TestEvents>();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    bus.on('test:count', listener1);
    bus.on('test:count', listener2);
    bus.removeAllListeners('test:count');
    bus.emit('test:count', 99);

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it('removeAllListeners without argument clears all events', () => {
    const bus = new TypedEventBus<TestEvents>();
    const msgListener = vi.fn();
    const countListener = vi.fn();

    bus.on('test:message', msgListener);
    bus.on('test:count', countListener);
    bus.removeAllListeners();
    bus.emit('test:message', { text: 'gone' });
    bus.emit('test:count', 0);

    expect(msgListener).not.toHaveBeenCalled();
    expect(countListener).not.toHaveBeenCalled();
  });

  it('supports multi-arg event payloads', () => {
    const bus = new TypedEventBus<TestEvents>();
    const listener = vi.fn();

    bus.on('test:multi', listener);
    bus.emit('test:multi', 'hello', 42);

    expect(listener).toHaveBeenCalledWith('hello', 42);
  });

  it('on returns this for chaining', () => {
    const bus = new TypedEventBus<TestEvents>();
    const result = bus.on('test:count', () => {});
    expect(result).toBe(bus);
  });
});
