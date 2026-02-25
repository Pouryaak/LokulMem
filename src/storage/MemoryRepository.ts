/**
 * MemoryRepository - Repository pattern for memory CRUD operations
 *
 * Provides type-safe, indexed access to memory storage with:
 * - Full CRUD operations (create, read, update, delete)
 * - Query methods using all compound indexes
 * - Bulk operations for performance
 * - Count and utility methods
 *
 * All methods convert between MemoryInternal (runtime) and DbMemoryRow (storage)
 * using the embedding conversion utilities.
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryStatus, MemoryType } from '../types/memory.js';
import type { LokulDatabase } from './Database.js';
import type { DbMemoryRow } from './Database.js';
import { memoryFromDb, memoryToDb } from './embeddingStorage.js';

/**
 * Filter interface for memory queries
 * Uses boolean for pinned for better DX, converted to pinnedInt internally
 */
export interface MemoryFilter {
  /** Filter by memory types (matches any if multiple) */
  types?: MemoryType[];

  /** Filter by memory status */
  status?: MemoryStatus;

  /** Filter by cluster ID */
  clusterId?: string;

  /** Filter by pinned status */
  pinned?: boolean;

  /** Minimum base strength (inclusive) */
  minStrength?: number;
}

/**
 * MemoryRepository - Primary interface for memory storage operations
 *
 * Implements the repository pattern to abstract database operations
 * and provide a clean, type-safe API for memory CRUD.
 */
export class MemoryRepository {
  /**
   * Create a new MemoryRepository instance
   * @param db - LokulDatabase instance for database access
   */
  constructor(private db: LokulDatabase) {}

  // ============================================================================
  // Core CRUD Operations
  // ============================================================================

  /**
   * Create a new memory in the database
   * @param memory - MemoryInternal to store
   * @throws Error if memory with same ID already exists
   */
  async create(memory: MemoryInternal): Promise<void> {
    const row = memoryToDb(memory);
    await this.db.memories.add(row);
  }

  /**
   * Get a memory by its ID
   * @param id - Memory ID to look up
   * @returns MemoryInternal if found, null otherwise
   */
  async getById(id: string): Promise<MemoryInternal | null> {
    const row = await this.db.memories.get(id);
    if (!row) {
      return null;
    }
    return memoryFromDb(row);
  }

  /**
   * Update an existing memory (upsert behavior)
   * @param memory - MemoryInternal to update
   */
  async update(memory: MemoryInternal): Promise<void> {
    const row = memoryToDb(memory);
    await this.db.memories.put(row);
  }

  /**
   * Delete a memory by its ID
   * @param id - Memory ID to delete
   */
  async delete(id: string): Promise<void> {
    await this.db.memories.delete(id);
  }

  // ============================================================================
  // Query Methods Using Indexes
  // ============================================================================

  /**
   * Find memories by type and filter by status
   * Uses multiEntry types index, then filters by status in JavaScript
   *
   * Note: Cannot use compound index with multiEntry types, so we filter
   * in memory. For ≤3000 memories, this is efficient enough.
   *
   * @param type - MemoryType to search for
   * @param status - Optional status filter
   * @returns Array of matching memories
   */
  async findByTypeAndStatus(
    type: MemoryType,
    status?: MemoryStatus,
  ): Promise<MemoryInternal[]> {
    // Use multiEntry index to find all memories with this type
    const rows = await this.db.memories.where('types').equals(type).toArray();

    // Filter by status if provided
    const filteredRows = status
      ? rows.filter((row) => row.status === status)
      : rows;

    return filteredRows.map((row) => memoryFromDb(row));
  }

  /**
   * Find active memories ordered by recency (lastAccessedAt)
   * Uses compound index [status+lastAccessedAt] for efficient querying
   *
   * @param limit - Maximum number of memories to return
   * @returns Array of active memories, most recently accessed first
   */
  async findActiveByRecency(limit: number): Promise<MemoryInternal[]> {
    const now = Date.now();
    const rows = await this.db.memories
      .where('[status+lastAccessedAt]')
      .between(['active', 0], ['active', now])
      .reverse()
      .limit(limit)
      .toArray();

    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Find memories by cluster ID
   * Uses [clusterId+status] compound index when status is provided,
   * otherwise uses clusterId index
   *
   * @param clusterId - Cluster ID to search for
   * @param status - Optional status filter (uses compound index if provided)
   * @returns Array of matching memories
   */
  async findByCluster(
    clusterId: string,
    status?: MemoryStatus,
  ): Promise<MemoryInternal[]> {
    let rows: DbMemoryRow[];

    if (status) {
      // Use compound index [clusterId+status]
      rows = await this.db.memories
        .where('[clusterId+status]')
        .equals([clusterId, status])
        .toArray();
    } else {
      // Use single index on clusterId
      rows = await this.db.memories
        .where('clusterId')
        .equals(clusterId)
        .toArray();
    }

    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Find all pinned memories
   * Uses pinnedInt index (pinnedInt is 0 or 1, not boolean)
   *
   * @returns Array of pinned memories
   */
  async findPinned(): Promise<MemoryInternal[]> {
    const rows = await this.db.memories.where('pinnedInt').equals(1).toArray();
    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Find memories by mention count
   * Uses mentionCount index for efficient range queries
   *
   * @param minCount - Minimum mention count (inclusive)
   * @param limit - Maximum number of memories to return
   * @returns Array of memories with mentionCount >= minCount, highest first
   */
  async findByMentionCount(
    minCount: number,
    limit: number,
  ): Promise<MemoryInternal[]> {
    const rows = await this.db.memories
      .where('mentionCount')
      .aboveOrEqual(minCount)
      .reverse()
      .limit(limit)
      .toArray();

    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Find memories by base strength range
   * Uses [status+baseStrength] compound index when status is provided,
   * otherwise uses baseStrength index
   *
   * @param min - Minimum base strength (inclusive)
   * @param max - Maximum base strength (inclusive)
   * @param status - Optional status filter (uses compound index if provided)
   * @returns Array of memories within the strength range
   */
  async findByBaseStrengthRange(
    min: number,
    max: number,
    status?: MemoryStatus,
  ): Promise<MemoryInternal[]> {
    let rows: DbMemoryRow[];

    if (status) {
      // Use compound index [status+baseStrength]
      rows = await this.db.memories
        .where('[status+baseStrength]')
        .between([status, min], [status, max])
        .toArray();
    } else {
      // Use single index on baseStrength
      rows = await this.db.memories
        .where('baseStrength')
        .between(min, max)
        .toArray();
    }

    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Find memories by status
   * Uses status index for efficient filtering
   *
   * @param status - Status to filter by
   * @returns Array of memories with the given status
   */
  async findByStatus(status: MemoryStatus): Promise<MemoryInternal[]> {
    const rows = await this.db.memories
      .where('status')
      .equals(status)
      .toArray();
    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Find memories by valid time range
   * Uses validFrom index for efficient range queries
   *
   * @param from - Start timestamp (inclusive)
   * @param to - End timestamp (inclusive)
   * @returns Array of memories valid within the time range
   */
  async findByValidTimeRange(
    from: number,
    to: number,
  ): Promise<MemoryInternal[]> {
    const rows = await this.db.memories
      .where('validFrom')
      .between(from, to)
      .toArray();

    return rows.map((row) => memoryFromDb(row));
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Create multiple memories in a single transaction
   * More efficient than individual creates for large batches
   *
   * @param memories - Array of MemoryInternal to create
   * @throws Error if any memory already exists
   */
  async bulkCreate(memories: MemoryInternal[]): Promise<void> {
    if (memories.length === 0) {
      return;
    }

    const rows = memories.map((memory) => memoryToDb(memory));
    await this.db.memories.bulkAdd(rows);
  }

  /**
   * Update multiple memories in a single transaction
   * Uses bulkPut for upsert behavior
   *
   * @param memories - Array of MemoryInternal to update
   */
  async bulkUpdate(memories: MemoryInternal[]): Promise<void> {
    if (memories.length === 0) {
      return;
    }

    const rows = memories.map((memory) => memoryToDb(memory));
    await this.db.memories.bulkPut(rows);
  }

  /**
   * Delete multiple memories by ID in a single transaction
   *
   * @param ids - Array of memory IDs to delete
   */
  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.db.memories.bulkDelete(ids);
  }

  /**
   * Update strength-related fields for multiple memories
   *
   * Optimized for reinforcement updates from ReinforcementTracker.
   * Only updates baseStrength, lastAccessedAt, and mentionCount fields.
   * Uses bulkPut for efficient batch updates.
   *
   * @param memories - Array of MemoryInternal with updated strength fields
   */
  async bulkUpdateStrengths(memories: MemoryInternal[]): Promise<void> {
    if (memories.length === 0) {
      return;
    }

    const rows = memories.map((memory) => memoryToDb(memory));
    await this.db.memories.bulkPut(rows);
  }

  /**
   * Update cluster IDs for multiple memories
   *
   * Optimized for K-means clustering updates.
   * Only updates the clusterId field using partial update.
   *
   * @param updates - Array of objects with id and clusterId fields
   */
  async bulkUpdateClusterIds(
    updates: Array<{ id: string; clusterId: string }>,
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    await this.db.memories.bulkUpdate(updates, ['clusterId']);
  }

  // ============================================================================
  // Count Methods
  // ============================================================================

  /**
   * Count memories matching the given filter
   *
   * @param filter - Optional filter criteria
   * @returns Number of matching memories
   */
  async count(filter?: MemoryFilter): Promise<number> {
    // If no filter, use Dexie's fast count
    if (!filter) {
      return await this.db.memories.count();
    }

    // Build query based on available indexes
    let query = this.db.memories.toCollection();

    // Apply status filter first (most selective, has index)
    if (filter.status) {
      query = this.db.memories.where('status').equals(filter.status);
    }

    // Apply clusterId filter (has index)
    if (filter.clusterId) {
      if (filter.status) {
        // Use compound index if both filters present
        query = this.db.memories
          .where('[clusterId+status]')
          .equals([filter.clusterId, filter.status]);
      } else {
        query = this.db.memories.where('clusterId').equals(filter.clusterId);
      }
    }

    // Apply pinned filter (has index)
    if (filter.pinned !== undefined) {
      query = this.db.memories.where('pinnedInt').equals(filter.pinned ? 1 : 0);
    }

    // Get results and apply remaining filters in memory
    const rows = await query.toArray();

    // Apply type filter in memory (multiEntry, can't use with compound)
    let filteredRows = rows;
    const filterTypes = filter.types;
    if (filterTypes && filterTypes.length > 0) {
      filteredRows = rows.filter((row) =>
        filterTypes.some((type) => row.types.includes(type)),
      );
    }

    // Apply minStrength filter in memory
    const minStrength = filter.minStrength;
    if (minStrength !== undefined) {
      filteredRows = filteredRows.filter(
        (row) => row.baseStrength >= minStrength,
      );
    }

    return filteredRows.length;
  }

  /**
   * Count memories by status
   *
   * @param status - Status to count
   * @returns Number of memories with the given status
   */
  async countByStatus(status: MemoryStatus): Promise<number> {
    return await this.db.memories.where('status').equals(status).count();
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a memory exists by ID
   *
   * @param id - Memory ID to check
   * @returns true if memory exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.db.memories.where('id').equals(id).count();
    return count > 0;
  }

  /**
   * Get all memory IDs
   *
   * @returns Array of all memory IDs
   */
  async getAllIds(): Promise<string[]> {
    return await this.db.memories.toCollection().primaryKeys();
  }

  /**
   * Get all memories (use with caution - can be expensive)
   *
   * @returns Array of all memories
   */
  async getAll(): Promise<MemoryInternal[]> {
    const rows = await this.db.memories.toArray();
    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Update the lastAccessedAt timestamp for a memory
   * Used when a memory is retrieved/mentioned
   *
   * @param id - Memory ID to update
   * @param timestamp - New timestamp (defaults to now)
   * @returns true if memory was found and updated
   */
  async touch(id: string, timestamp = Date.now()): Promise<boolean> {
    const row = await this.db.memories.get(id);
    if (!row) {
      return false;
    }

    await this.db.memories.update(id, {
      lastAccessedAt: timestamp,
      mentionCount: row.mentionCount + 1,
    });

    return true;
  }

  /**
   * Find memories that have expired (validTo < now)
   *
   * @param now - Current timestamp (defaults to Date.now())
   * @returns Array of expired memories
   */
  async findExpired(now = Date.now()): Promise<MemoryInternal[]> {
    const rows = await this.db.memories
      .where('validTo')
      .below(now)
      .and((row) => row.validTo !== null)
      .toArray();

    return rows.map((row) => memoryFromDb(row));
  }

  /**
   * Find superseded memories that haven't been archived
   *
   * @returns Array of superseded memories
   */
  async findSuperseded(): Promise<MemoryInternal[]> {
    const rows = await this.db.memories
      .where('status')
      .equals('superseded')
      .toArray();

    return rows.map((row) => memoryFromDb(row));
  }
}
