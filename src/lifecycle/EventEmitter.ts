/**
 * LifecycleEventEmitter - Event emission for memory lifecycle transitions
 *
 * Provides a callback-based event system for memory lifecycle events:
 * - Memory faded (when strength drops below threshold)
 * - Memory deleted (when old faded memories are purged)
 *
 * Key features:
 * - Handler registration with unsubscribe support
 * - MemoryInternal to MemoryDTO conversion (excludes embedding)
 * - Error isolation (handler errors don't break emitter)
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryDTO } from '../types/memory.js';

/**
 * Handler function type for memory faded events
 */
type FadedHandler = (memory: MemoryDTO) => void;

/**
 * Handler function type for memory deleted events
 */
type DeletedHandler = (memoryId: string) => void;

/**
 * LifecycleEventEmitter - Manages event emission for memory lifecycle
 *
 * Allows registration of event handlers for lifecycle transitions.
 * Returns unsubscribe functions for clean handler removal.
 */
export class LifecycleEventEmitter {
  /** Registered handlers for memory faded events */
  private readonly fadedHandlers: FadedHandler[] = [];

  /** Registered handlers for memory deleted events */
  private readonly deletedHandlers: DeletedHandler[] = [];

  /**
   * Register a handler for memory faded events
   * @param handler - Callback function to receive faded memory DTOs
   * @returns Unsubscribe function that removes the handler
   */
  onMemoryFaded(handler: FadedHandler): () => void {
    this.fadedHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.fadedHandlers.indexOf(handler);
      if (index !== -1) {
        this.fadedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register a handler for memory deleted events
   * @param handler - Callback function to receive deleted memory IDs
   * @returns Unsubscribe function that removes the handler
   */
  onMemoryDeleted(handler: DeletedHandler): () => void {
    this.deletedHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.deletedHandlers.indexOf(handler);
      if (index !== -1) {
        this.deletedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Emit a memory faded event to all registered handlers
   * @param memory - MemoryInternal that has faded
   *
   * Converts MemoryInternal to MemoryDTO (excludes embedding field).
   * Errors in individual handlers are caught and logged, preventing
   * one bad handler from breaking the entire emission.
   */
  async emitMemoryFaded(memory: MemoryInternal): Promise<void> {
    const dto = this.toDTO(memory);

    // Emit to all handlers with error isolation
    for (const handler of this.fadedHandlers) {
      try {
        handler(dto);
      } catch (error) {
        // Log error but continue with other handlers
        console.error(
          `LifecycleEventEmitter: Error in onMemoryFaded handler for memory ${memory.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Emit a memory deleted event to all registered handlers
   * @param memoryId - ID of the memory that was deleted
   *
   * Errors in individual handlers are caught and logged, preventing
   * one bad handler from breaking the entire emission.
   */
  async emitMemoryDeleted(memoryId: string): Promise<void> {
    // Emit to all handlers with error isolation
    for (const handler of this.deletedHandlers) {
      try {
        handler(memoryId);
      } catch (error) {
        // Log error but continue with other handlers
        console.error(
          `LifecycleEventEmitter: Error in onMemoryDeleted handler for memory ${memoryId}:`,
          error,
        );
      }
    }
  }

  /**
   * Convert MemoryInternal to MemoryDTO (exclude embedding field)
   * @param memory - MemoryInternal to convert
   * @returns MemoryDTO without embedding field
   *
   * The DTO pattern excludes the embedding field from public API responses
   * because Float32Array doesn't serialize well over IPC.
   */
  private toDTO(memory: MemoryInternal): MemoryDTO {
    // Destructure to exclude embedding field
    const { embedding, ...rest } = memory;

    // Return rest as MemoryDTO (embedding excluded)
    return rest as MemoryDTO;
  }
}
