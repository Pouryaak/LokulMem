/**
 * MaintenanceSweep - Periodic maintenance scheduler for memory lifecycle
 *
 * Manages automatic memory lifecycle maintenance through:
 * - Session-start sweeps (synchronous, blocking init)
 * - Periodic sweeps (async, at configurable interval)
 * - Decay calculation, fading, and deletion in one operation
 *
 * Key features:
 * - Flushes reinforcements before decay calculation
 * - Marks faded memories with status and timestamp
 * - Deletes old faded memories (>30 days)
 * - Emits events for all state transitions
 * - Race condition protection via isSweepRunning flag
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { DecayCalculator } from './DecayCalculator.js';
import type { LifecycleEventEmitter } from './EventEmitter.js';
import type { ReinforcementTracker } from './ReinforcementTracker.js';
import type { MaintenanceConfig, SweepResult } from './types.js';

/**
 * Milliseconds in 30 days (deletion threshold for faded memories)
 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * MaintenanceSweep - Orchestrates periodic maintenance sweeps
 *
 * Executes maintenance operations at session start and periodic intervals.
 * Each sweep: flushes reinforcements → calculates decay → marks faded → deletes old
 */
export class MaintenanceSweep {
  private readonly config: MaintenanceConfig;
  private readonly decayCalculator: DecayCalculator;
  private readonly reinforcementTracker: ReinforcementTracker;
  private readonly repository: MemoryRepository;
  private readonly eventEmitter: LifecycleEventEmitter;

  /** Periodic timer for async sweeps */
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  /** Race condition protection flag */
  private isSweepRunning = false;

  /**
   * Create a new MaintenanceSweep instance
   * @param config - Maintenance configuration
   * @param decayCalculator - DecayCalculator for strength updates
   * @param reinforcementTracker - ReinforcementTracker for flushing
   * @param repository - MemoryRepository for DB operations
   * @param eventEmitter - LifecycleEventEmitter for events
   */
  constructor(
    config: MaintenanceConfig,
    decayCalculator: DecayCalculator,
    reinforcementTracker: ReinforcementTracker,
    repository: MemoryRepository,
    eventEmitter: LifecycleEventEmitter,
  ) {
    this.config = config;
    this.decayCalculator = decayCalculator;
    this.reinforcementTracker = reinforcementTracker;
    this.repository = repository;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Run a complete maintenance sweep
   * @returns Promise<SweepResult> with counts of decayed, faded, deleted
   *
   * Sweep process:
   * 1. Flush pending reinforcements
   * 2. Fetch all memories
   * 3. Calculate decay for all memories
   * 4. Update strengths and mark faded memories
   * 5. Emit fade events
   * 6. Delete old faded memories (>30 days)
   * 7. Emit delete events
   */
  async runSweep(): Promise<SweepResult> {
    // Race condition protection: skip if already running
    if (this.isSweepRunning) {
      console.log('MaintenanceSweep: Sweep already running, skipping');
      return { decayedCount: 0, fadedCount: 0, deletedCount: 0 };
    }

    this.isSweepRunning = true;

    try {
      // Progress: starting
      this.config.onProgress?.('decay', 0);

      // Step 1: Flush pending reinforcements before decay calculation
      await this.reinforcementTracker.forceFlush();

      // Step 2: Fetch all memories
      const allMemories = await this.repository.getAll();

      // Step 3: Calculate decay for all memories
      const now = Date.now();
      const decayResults = this.decayCalculator.calculateDecayBatch(
        allMemories,
        now,
      );

      // Progress: decay calculated
      this.config.onProgress?.('decay', 50);

      // Step 4: Separate faded memories and build updates array
      const updates: MemoryInternal[] = [];
      const fadedMemories: MemoryInternal[] = [];

      for (let i = 0; i < allMemories.length; i++) {
        const memory = allMemories[i];
        const result = decayResults[i];

        if (!memory || !result) {
          continue;
        }

        // Update current strength
        memory.currentStrength = result.newStrength;

        // Check if memory should be faded
        if (result.isFaded && memory.status === 'active') {
          memory.status = 'faded';
          memory.fadedAt = now;
          fadedMemories.push(memory);
        }

        updates.push(memory);
      }

      // Step 5: Batch update all strengths and status changes
      await this.repository.bulkUpdateCurrentStrengths(updates);

      // Progress: DB updated
      this.config.onProgress?.('decay', 75);

      // Step 6: Emit fade events
      for (const memory of fadedMemories) {
        await this.eventEmitter.emitMemoryFaded(memory);
      }

      // Progress: fade events emitted
      this.config.onProgress?.('decay', 90);

      // Step 7: Delete old faded memories
      const deletedCount = await this.deleteOldFadedMemories(now);

      // Progress: complete
      this.config.onProgress?.('decay', 100);

      return {
        decayedCount: updates.length,
        fadedCount: fadedMemories.length,
        deletedCount,
      };
    } finally {
      // Always clear the running flag
      this.isSweepRunning = false;
    }
  }

  /**
   * Delete faded memories older than 30 days
   * @param now - Current timestamp in milliseconds
   * @returns Number of memories deleted
   *
   * Faded memories older than 30 days are permanently deleted.
   * This is a one-way operation - deleted memories cannot be recovered.
   */
  private async deleteOldFadedMemories(now: number): Promise<number> {
    // Calculate cutoff time (30 days ago)
    const cutoffTime = now - THIRTY_DAYS_MS;

    // Get all faded memories
    const fadedMemories = await this.repository.findByStatus('faded');

    // Filter memories that should be deleted
    const toDelete: MemoryInternal[] = [];
    for (const memory of fadedMemories) {
      // Only delete if fadedAt is set and older than cutoff
      if (memory.fadedAt !== null && memory.fadedAt < cutoffTime) {
        toDelete.push(memory);
      }
    }

    // Return early if nothing to delete
    if (toDelete.length === 0) {
      return 0;
    }

    // Extract IDs for bulk delete
    const idsToDelete = toDelete.map((m) => m.id);

    // Perform bulk delete
    await this.repository.bulkDelete(idsToDelete);

    // Emit delete events
    for (const memory of toDelete) {
      await this.eventEmitter.emitMemoryDeleted(memory.id);
    }

    // Log deletion count
    console.log(
      `MaintenanceSweep: Deleted ${toDelete.length} old faded memories`,
    );

    return toDelete.length;
  }

  /**
   * Start periodic maintenance sweeps
   *
   * Begins a timer that runs sweeps at the configured interval.
   * Sweeps run asynchronously and don't block the main thread.
   */
  startPeriodicSweeps(): void {
    // Return if already started
    if (this.periodicTimer !== null) {
      console.log('MaintenanceSweep: Periodic sweeps already started');
      return;
    }

    // Start periodic timer
    this.periodicTimer = setInterval(async () => {
      try {
        await this.runSweep();
      } catch (error) {
        console.error('MaintenanceSweep: Error in periodic sweep:', error);
      }
    }, this.config.sweepIntervalMs);

    console.log(
      `MaintenanceSweep: Started periodic sweeps (interval: ${this.config.sweepIntervalMs}ms)`,
    );
  }

  /**
   * Stop periodic maintenance sweeps
   *
   * Cancels the periodic timer. No further sweeps will run
   * until startPeriodicSweeps is called again.
   */
  stopPeriodicSweeps(): void {
    if (this.periodicTimer !== null) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
      console.log('MaintenanceSweep: Stopped periodic sweeps');
    }
  }

  /**
   * Shutdown the maintenance sweep system
   *
   * Stops periodic sweeps and flushes pending reinforcements.
   * Call this before shutting down the application.
   */
  async shutdown(): Promise<void> {
    this.stopPeriodicSweeps();
    await this.reinforcementTracker.forceFlush();
  }
}

/**
 * Re-export MaintenanceConfig and SweepResult for convenience
 */
export type { MaintenanceConfig, SweepResult };
