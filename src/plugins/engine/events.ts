/**
 * @file Typed event bus for plugin engine observability.
 * @module plugins/engine/events
 *
 * Provides a publish/subscribe event system that the plugin registry,
 * executor, and lifecycle manager use to emit structured events. Handlers
 * may be synchronous or asynchronous; errors in handlers are logged but
 * never propagate to the emitter, ensuring pipeline stability.
 */

import type {
  PluginEvent,
  PluginEventHandler,
  PluginEventType,
} from './types.js';

// ---------------------------------------------------------------------------
// PluginEventBus
// ---------------------------------------------------------------------------

/**
 * A typed, async-safe event bus for the plugin engine.
 *
 * @remarks
 * - Subscribers are grouped by event type for O(1) dispatch lookup.
 * - "wildcard" subscribers (registered via {@link onAny}) receive every event.
 * - Async handler rejections are caught and logged to `stderr` so that a
 *   misbehaving observer can never crash the host process.
 *
 * @example
 * ```ts
 * pluginEventBus.on('plugin:registered', (evt) => {
 *   console.log(`Registered: ${evt.pluginName}`);
 * });
 * ```
 */
export class PluginEventBus {
  /** Per-type subscriber lists. */
  private readonly handlers: Map<PluginEventType, Set<PluginEventHandler>>;

  /** Wildcard subscribers that receive every event. */
  private readonly wildcardHandlers: Set<PluginEventHandler>;

  /**
   * Creates a new {@link PluginEventBus} instance.
   */
  constructor() {
    this.handlers = new Map();
    this.wildcardHandlers = new Set();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe a handler to a specific event type.
   *
   * @param eventType - The event type to listen for.
   * @param handler   - Callback invoked when a matching event is emitted.
   * @throws {Error} If `eventType` is falsy or `handler` is not a function.
   */
  on(eventType: PluginEventType, handler: PluginEventHandler): void {
    if (!eventType) {
      throw new Error('PluginEventBus.on: eventType must be a non-empty string.');
    }
    if (typeof handler !== 'function') {
      throw new Error('PluginEventBus.on: handler must be a function.');
    }

    let set = this.handlers.get(eventType);
    if (!set) {
      set = new Set();
      this.handlers.set(eventType, set);
    }
    set.add(handler);
  }

  /**
   * Unsubscribe a handler from a specific event type.
   *
   * If the handler was not previously registered this is a no-op.
   *
   * @param eventType - The event type to stop listening for.
   * @param handler   - The exact handler reference to remove.
   * @throws {Error} If `eventType` is falsy or `handler` is not a function.
   */
  off(eventType: PluginEventType, handler: PluginEventHandler): void {
    if (!eventType) {
      throw new Error('PluginEventBus.off: eventType must be a non-empty string.');
    }
    if (typeof handler !== 'function') {
      throw new Error('PluginEventBus.off: handler must be a function.');
    }

    const set = this.handlers.get(eventType);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Subscribe a handler that receives **all** events regardless of type.
   *
   * @param handler - Callback invoked for every emitted event.
   * @throws {Error} If `handler` is not a function.
   */
  onAny(handler: PluginEventHandler): void {
    if (typeof handler !== 'function') {
      throw new Error('PluginEventBus.onAny: handler must be a function.');
    }
    this.wildcardHandlers.add(handler);
  }

  /**
   * Remove a wildcard handler previously registered via {@link onAny}.
   *
   * @param handler - The exact handler reference to remove.
   * @throws {Error} If `handler` is not a function.
   */
  offAny(handler: PluginEventHandler): void {
    if (typeof handler !== 'function') {
      throw new Error('PluginEventBus.offAny: handler must be a function.');
    }
    this.wildcardHandlers.delete(handler);
  }

  // -----------------------------------------------------------------------
  // Emission
  // -----------------------------------------------------------------------

  /**
   * Emit an event to all matching subscribers.
   *
   * Both type-specific and wildcard handlers are invoked. Async handlers
   * are awaited concurrently via `Promise.allSettled`; rejections are
   * logged to `stderr` but never re-thrown.
   *
   * @param event - The fully-formed {@link PluginEvent} to broadcast.
   * @throws {Error} If `event` is nullish or missing required fields.
   */
  async emit(event: PluginEvent): Promise<void> {
    if (!event) {
      throw new Error('PluginEventBus.emit: event must not be null or undefined.');
    }
    if (!event.type) {
      throw new Error('PluginEventBus.emit: event.type is required.');
    }
    if (!event.pluginName) {
      throw new Error('PluginEventBus.emit: event.pluginName is required.');
    }

    const typeHandlers = this.handlers.get(event.type);

    // Collect all handlers that need to be invoked.
    const allHandlers: PluginEventHandler[] = [];

    if (typeHandlers) {
      for (const h of typeHandlers) {
        allHandlers.push(h);
      }
    }

    for (const h of this.wildcardHandlers) {
      allHandlers.push(h);
    }

    if (allHandlers.length === 0) {
      return;
    }

    // Invoke all handlers concurrently and isolate failures.
    const settlements = await Promise.allSettled(
      allHandlers.map((handler) => {
        try {
          const result = handler(event);
          // If handler returns a Promise, let it settle naturally.
          if (result && typeof (result as Promise<void>).then === 'function') {
            return result as Promise<void>;
          }
          return Promise.resolve();
        } catch (syncError: unknown) {
          // Handler threw synchronously.
          return Promise.reject(syncError);
        }
      }),
    );

    // Log any rejected handlers without crashing.
    for (const settlement of settlements) {
      if (settlement.status === 'rejected') {
        const reason =
          settlement.reason instanceof Error
            ? settlement.reason.message
            : String(settlement.reason);

        console.error(
          `[PluginEventBus] Handler error for event "${event.type}" ` +
            `(plugin: ${event.pluginName}): ${reason}`,
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /**
   * Returns the number of handlers registered for a given event type
   * (excludes wildcard handlers).
   *
   * @param eventType - The event type to query.
   * @returns The subscriber count.
   */
  listenerCount(eventType: PluginEventType): number {
    const set = this.handlers.get(eventType);
    return set ? set.size : 0;
  }

  /**
   * Returns the number of wildcard handlers.
   *
   * @returns The wildcard subscriber count.
   */
  wildcardListenerCount(): number {
    return this.wildcardHandlers.size;
  }

  /**
   * Remove **all** handlers (type-specific and wildcard).
   *
   * Primarily useful in tests or during shutdown.
   */
  removeAllListeners(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Shared singleton instance of the plugin event bus.
 *
 * All engine subsystems (registry, executor, lifecycle) import this
 * instance so that external consumers can subscribe in a single place.
 */
export const pluginEventBus: PluginEventBus = new PluginEventBus();
