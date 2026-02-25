/**
 * SupersessionManager - Manages supersession chains and tombstone cleanup
 *
 * Handles the lifecycle of superseded memories:
 * - Applies supersession status and timestamps
 * - Sets validTo/validFrom for temporal updates
 * - Cleans up expired superseded memories (30-day retention)
 * - Traces supersession chains for auditability
 *
 * Per CONTEXT decisions:
 * - Worker-side IPC event emission required
 * - Entities kept as Entity[] structured, NOT stringified
 * - Tombstone retention preserves minimal metadata
 */

import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { MemoryDTO } from '../types/memory.js';
import type { ContradictionEvent } from './ContradictionDetector.js';

/**
 * SupersessionEvent - Emitted when memory is superseded
 */
export interface SupersessionEvent {
  /** ID of superseded memory */
  oldMemoryId: string;

  /** ID of new memory */
  newMemoryId: string;

  /** Timestamp of supersession */
  timestamp: number;
}

/**
 * SupersessionResult - Result of supersession operation
 */
export interface SupersessionResult {
  /** ID of superseded memory */
  oldMemoryId: string;

  /** ID of new memory */
  newMemoryId: string;

  /** Timestamp of supersession */
  timestamp: number;
}

/**
 * SupersessionManager configuration
 */
export interface SupersessionManagerConfig {
  /** Event callback for supersession (worker-side) */
  onMemorySuperseded?: (event: SupersessionEvent) => void;
}

/**
 * SupersessionManager class for managing memory supersession
 */
export class SupersessionManager {
  constructor(
    private repository: MemoryRepository,
    private config: SupersessionManagerConfig = {},
  ) {}

  /**
   * Apply supersession from contradiction event
   *
   * Process:
   * 1. Set existing memory status = 'superseded'
   * 2. Set supersededBy, supersededAt
   * 3. If temporal marker, set validTo/validFrom
   * 4. Emit worker-side IPC event
   *
   * @param event - Contradiction event
   * @returns Supersession result
   */
  async applySupersession(
    event: ContradictionEvent,
  ): Promise<SupersessionResult> {
    const { newMemoryId, conflictingMemoryId, hasTemporalMarker } = event;

    // Supersede old memory
    await this.repository.supersede(conflictingMemoryId, newMemoryId);

    // If temporal marker, set validTo/validFrom
    if (hasTemporalMarker) {
      const now = Date.now();

      // Update old memory with validTo
      const oldMemory = await this.repository.getById(conflictingMemoryId);
      if (oldMemory) {
        oldMemory.validTo = now;
        await this.repository.update(oldMemory);
      }

      // Update new memory with validFrom
      const newMemory = await this.repository.getById(newMemoryId);
      if (newMemory) {
        newMemory.validFrom = now;
        await this.repository.update(newMemory);
      }
    }

    // CRITICAL FIX: Emit worker-side IPC event
    // Protocol messages defined but no worker code posting them - ADD EXPLICIT EVENT SINKS
    this.emitEvent({
      oldMemoryId: conflictingMemoryId,
      newMemoryId,
      timestamp: Date.now(),
    });

    return {
      oldMemoryId: conflictingMemoryId,
      newMemoryId,
      timestamp: Date.now(),
    };
  }

  /**
   * Emit event to worker IPC bus
   * CRITICAL FIX: Worker-side event emission was missing
   *
   * @param event - Supersession event
   */
  private emitEvent(event: SupersessionEvent): void {
    // Call the configured callback if provided
    if (this.config.onMemorySuperseded) {
      this.config.onMemorySuperseded(event);
    }
  }

  /**
   * Cleanup superseded memories older than 30 days
   * Strips content/embedding, creates tombstone
   *
   * @returns Number of tombstones created
   */
  async cleanupOldSuperseded(): Promise<number> {
    const expired = await this.repository.findExpiredSuperseded();

    for (const memory of expired) {
      await this.repository.stripToTombstone(memory.id);
    }

    return expired.length;
  }

  /**
   * Get full supersession chain
   *
   * CRITICAL: Entities should be Entity[] (structured), NOT stringified.
   * The entities.map(JSON.stringify) in original plan was incorrect serialization.
   *
   * @param memoryId - Starting memory ID
   * @returns Array of memories in chain
   */
  async getChain(memoryId: string): Promise<MemoryDTO[]> {
    const chain = await this.repository.getSupersessionChain(memoryId);
    return chain.map((m) => ({
      id: m.id,
      content: m.content,
      types: m.types,
      status: m.status,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      validFrom: m.validFrom,
      validTo: m.validTo,
      baseStrength: m.baseStrength,
      currentStrength: m.currentStrength,
      pinned: m.pinned,
      mentionCount: m.mentionCount,
      lastAccessedAt: m.lastAccessedAt,
      clusterId: m.clusterId,
      entities: m.entities, // CRITICAL FIX: Keep as Entity[] structured, don't stringify
      sourceConversationIds: m.sourceConversationIds,
      supersededBy: m.supersededBy,
      supersededAt: m.supersededAt,
      fadedAt: m.fadedAt,
      metadata: m.metadata,
    }));
  }
}
