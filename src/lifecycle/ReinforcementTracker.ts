/**
 * ReinforcementTracker - Debounced reinforcement tracking and batched DB writes
 *
 * Tracks memory access for reinforcement and batches write operations to avoid
 * excessive IndexedDB operations. Uses a debounce pattern to collect multiple
 * reinforcements within a time window and write them in a single batch.
 *
 * Key features:
 * - Category-based reinforcement amounts (configurable per type)
 * - Debounced writes with configurable window (default 5 seconds)
 * - Hard cap at maxBaseStrength (default 3.0)
 * - Automatic lastAccessedAt and mentionCount updates
 * - Efficient batch updates via repository.bulkUpdateStrengths()
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { ReinforcementConfig, ReinforcementTask } from './types.js';

/**
 * ReinforcementTracker - Tracks and applies memory reinforcement with debounced writes
 *
 * When memories are accessed (via get() or semanticSearch()), they should be
 * reinforced to simulate the Ebbinghaus rehearsal effect. This class tracks
 * those reinforcements and batches them to avoid excessive DB writes.
 */
export class ReinforcementTracker {
  private readonly config: ReinforcementConfig;
  private readonly repository: MemoryRepository;

  /** Pending reinforcements waiting to be written */
  private readonly pendingReinforcements = new Map<string, ReinforcementTask>();

  /** Debounce timer for batch writes */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Create a new ReinforcementTracker instance
   * @param config - Reinforcement configuration
   * @param repository - MemoryRepository for batch updates
   */
  constructor(config: ReinforcementConfig, repository: MemoryRepository) {
    this.config = config;
    this.repository = repository;
  }

  /**
   * Record a memory access for reinforcement
   * @param memory - Memory that was accessed
   * @returns Promise that resolves when access is recorded
   *
   * If the memory is already at max strength, this is a no-op.
   * Otherwise, adds the memory to the pending reinforcements and schedules
   * a debounced write operation.
   */
  async recordAccess(memory: MemoryInternal): Promise<void> {
    // Skip if already at cap
    if (memory.baseStrength >= this.config.maxBaseStrength) {
      return;
    }

    // Get primary category: first type or 'preference' fallback
    const primaryCategory = memory.types[0] || 'preference';

    // Get reinforcement amount for this category (default 0.3)
    const reinforcementAmount =
      this.config.reinforcementByCategory[primaryCategory] ?? 0.3;

    // Skip if adding reinforcement would exceed cap
    const newStrength = memory.baseStrength + reinforcementAmount;
    if (newStrength > this.config.maxBaseStrength) {
      return;
    }

    // Add pending reinforcement
    this.pendingReinforcements.set(memory.id, {
      memoryId: memory.id,
      category: primaryCategory,
      timestamp: Date.now(),
    });

    // Schedule debounced write
    this.scheduleDebouncedWrite();
  }

  /**
   * Schedule a debounced write if not already scheduled
   *
   * Uses a timer to delay the write operation. If multiple accesses occur
   * within the debounce window, only one write operation is performed.
   */
  private scheduleDebouncedWrite(): void {
    // Return early if timer already set
    if (this.debounceTimer !== null) {
      return;
    }

    // Set timer for debounce window
    this.debounceTimer = setTimeout(async () => {
      await this.flushPendingReinforcements();
      this.debounceTimer = null;
    }, this.config.debounceWindowMs);
  }

  /**
   * Flush all pending reinforcements to the database
   *
   * This method:
   * 1. Fetches all pending memories by ID
   * 2. Calculates new base strength values with cap enforcement
   * 3. Updates lastAccessedAt and mentionCount
   * 4. Writes all updates in a single batch operation
   *
   * Called automatically by the debounce timer or manually via forceFlush().
   */
  private async flushPendingReinforcements(): Promise<void> {
    // Return early if nothing to flush
    if (this.pendingReinforcements.size === 0) {
      return;
    }

    // Convert Map values to array and clear the map
    const tasks = Array.from(this.pendingReinforcements.values());
    this.pendingReinforcements.clear();

    // Fetch all memories by ID
    const memoryIds = tasks.map((task) => task.memoryId);
    const memories: MemoryInternal[] = [];

    for (const id of memoryIds) {
      const memory = await this.repository.getById(id);
      if (memory !== null) {
        memories.push(memory);
      }
    }

    // Filter out null results and calculate updates
    const now = Date.now();
    const updates: MemoryInternal[] = [];

    for (const memory of memories) {
      // Get the reinforcement task for this memory
      const task = tasks.find((t) => t.memoryId === memory.id);
      if (!task) {
        continue;
      }

      // Get reinforcement amount for this category
      const reinforcementAmount =
        this.config.reinforcementByCategory[task.category] ?? 0.3;

      // Calculate new base strength with cap
      const newBaseStrength = Math.min(
        memory.baseStrength + reinforcementAmount,
        this.config.maxBaseStrength,
      );

      // Skip if no change (already at cap)
      if (newBaseStrength === memory.baseStrength) {
        continue;
      }

      // Update memory fields
      updates.push({
        ...memory,
        baseStrength: newBaseStrength,
        lastAccessedAt: now,
        mentionCount: memory.mentionCount + 1,
      });
    }

    // Write all updates in a single batch
    if (updates.length > 0) {
      await this.repository.bulkUpdateStrengths(updates);
    }
  }

  /**
   * Force immediate flush of pending reinforcements
   *
   * Clears the debounce timer and writes all pending reinforcements immediately.
   * Useful for shutdown or when you need to ensure reinforcements are persisted.
   *
   * @returns Promise that resolves when flush is complete
   */
  async forceFlush(): Promise<void> {
    // Clear debounce timer if set
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Flush pending reinforcements
    await this.flushPendingReinforcements();
  }

  /**
   * Get the number of pending reinforcements
   * @returns Number of reinforcements waiting to be written
   */
  getPendingCount(): number {
    return this.pendingReinforcements.size;
  }
}

/**
 * Re-export ReinforcementConfig and ReinforcementTask for convenience
 */
export type { ReinforcementConfig, ReinforcementTask };
