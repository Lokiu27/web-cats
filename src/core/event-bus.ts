// Typed publish-subscribe event bus for Openspacemarin
// Requirements: 2.6, 10.3
//
// All cross-module communication goes through the event bus — modules never
// reference each other directly. Uses the GameEvent discriminated union for
// full type safety on both emit and subscribe sides.

import type { GameEvent, IEventBus } from '../types/index.js';

type Handler<T> = (event: T) => void;
type HandlerMap = Map<string, Set<Handler<GameEvent>>>;

export class EventBus implements IEventBus {
  private readonly handlers: HandlerMap = new Map();

  /**
   * Emit an event to all registered handlers for its type.
   */
  emit<T extends GameEvent>(event: T): void {
    const set = this.handlers.get(event.type);
    if (!set) return;
    // Snapshot the set before iterating so handlers added during dispatch
    // don't run in the same cycle, and removed handlers are skipped.
    for (const handler of [...set]) {
      (handler as Handler<T>)(event);
    }
  }

  /**
   * Subscribe to events of a specific type.
   * Returns an unsubscribe function for convenient cleanup.
   */
  on<K extends GameEvent['type']>(
    type: K,
    handler: Handler<Extract<GameEvent, { type: K }>>,
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<GameEvent>);
    return () => this.off(type, handler);
  }

  /**
   * Unsubscribe a previously registered handler.
   */
  off<K extends GameEvent['type']>(
    type: K,
    handler: Handler<Extract<GameEvent, { type: K }>>,
  ): void {
    this.handlers.get(type)?.delete(handler as Handler<GameEvent>);
  }

  /**
   * Subscribe to the next occurrence of an event type only.
   * Automatically unsubscribes after the first invocation.
   */
  once<K extends GameEvent['type']>(
    type: K,
    handler: Handler<Extract<GameEvent, { type: K }>>,
  ): void {
    const wrapper: Handler<Extract<GameEvent, { type: K }>> = (event) => {
      this.off(type, wrapper);
      handler(event);
    };
    this.on(type, wrapper);
  }

  /**
   * Remove all handlers for all event types.
   * Useful for teardown / testing.
   */
  clear(): void {
    this.handlers.clear();
  }
}
