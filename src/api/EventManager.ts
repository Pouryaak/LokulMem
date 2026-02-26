/**
 * EventManager - Event callback registry with unsubscribe pattern
 *
 * Handles event callback registration and emission for memory lifecycle events.
 * Uses IDs-only payloads by default for lightweight events.
 * Verbose mode includes content and metadata fields.
 * Embeddings never included in events (per CONTEXT decision).
 */

import type { MemoryDTO } from '../types/memory.js';
import type {
  EventConfig,
  EventType,
  MemoryEventPayload,
  StatsChangedPayload,
} from './types.js';

/**
 * EventManager handles event callback registration and emission
 *
 * Uses IDs-only payloads by default for lightweight events.
 * Verbose mode includes content and metadata fields.
 * Embeddings never included in events (per CONTEXT decision).
 */
export class EventManager {
  private handlers: Map<EventType, Set<(...args: unknown[]) => void>> =
    new Map();
  private config: EventConfig;

  constructor(config: EventConfig = {}) {
    this.config = { verboseEvents: false, ...config };
  }

  /**
   * Register event handler
   * @returns Unsubscribe function
   */
  on(eventType: EventType, handler: (...args: unknown[]) => void): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    const handlerSet = this.handlers.get(eventType);
    if (handlerSet) {
      handlerSet.add(handler);
    }

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Emit event to all registered handlers
   */
  emit(eventType: EventType, data: unknown): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        // Isolate handler errors - don't break emission
        console.error(`Error in ${eventType} handler:`, error);
      }
    }
  }

  /**
   * Create IDs-only memory event payload (default)
   */
  createMemoryEvent(memory: MemoryDTO): MemoryEventPayload {
    const base: MemoryEventPayload = {
      memoryId: memory.id,
      timestamp: memory.createdAt,
      type: memory.types.join(', '),
      status: memory.status,
    };

    // Add verbose fields if enabled
    if (this.config.verboseEvents) {
      return {
        ...base,
        content: memory.content,
        metadata: memory.metadata,
      };
    }

    return base;
  }

  /**
   * Create stats changed event payload
   */
  createStatsEvent(
    stats: import('../types/events.js').MemoryStats,
  ): StatsChangedPayload {
    return {
      stats,
      timestamp: Date.now(),
    };
  }

  /**
   * Remove all handlers (cleanup)
   */
  removeAll(): void {
    this.handlers.clear();
  }

  /**
   * Get handler count for event type
   */
  handlerCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }
}
