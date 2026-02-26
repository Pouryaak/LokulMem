/**
 * Manager - Memory inspection and manipulation namespace
 *
 * Provides separate methods for each operation for discoverability.
 * All mutations return lightweight status objects.
 * All queries delegate to worker-side QueryEngine via IPC.
 *
 * ARCHITECTURE NOTE:
 * QueryEngine and MemoryRepository live in the worker thread.
 * Manager communicates via WorkerClient using request/response pattern.
 * This design keeps the main thread lightweight while providing full API access.
 */

import type { WorkerClient } from '../core/MessagePort.js';
import type { MemoryStats } from '../types/events.js';
import type { MemoryDTO } from '../types/memory.js';
import type { EventManager } from './EventManager.js';
import type {
  BulkOperationResult,
  ChatMessage,
  ClearResult,
  ExportFormat,
  GroupedResult,
  ImportMode,
  ImportResult,
  InjectionPreviewResult,
  ListOptions,
  MemoryUpdate,
  PaginatedResult,
  SemanticSearchOptions,
  SingleOperationResult,
  TimelineResult,
} from './types.js';

/**
 * Request timeout for management operations (default: 30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Manager namespace for memory inspection and manipulation
 *
 * Provides 16+ methods for querying, mutating, exporting, and importing memories.
 * All operations communicate with the worker thread via IPC.
 */
export class Manager {
  constructor(
    private workerClient: WorkerClient,
    private eventManager: EventManager,
  ) {}

  // ============================================================================
  // Single Operations (Task 3)
  // ============================================================================

  /**
   * Update a memory with new field values
   * @param id - Memory ID to update
   * @param updates - Fields to update
   * @returns Single operation result with ID and status
   */
  async update(
    id: string,
    updates: MemoryUpdate,
  ): Promise<SingleOperationResult> {
    const payload = { id, updates };
    const response = (await this.workerClient.request(
      'MEMORY_UPDATE',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as SingleOperationResult;

    // Emit MEMORY_UPDATED after successful update
    if (response.status === 'updated') {
      const updated = await this.get(id);
      if (updated) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(updated),
        );
      }
    }

    return response;
  }

  /**
   * Pin a memory (prevent decay)
   * @param id - Memory ID to pin
   * @returns Single operation result with ID and status
   */
  async pin(id: string): Promise<SingleOperationResult> {
    const payload = { id };
    const response = (await this.workerClient.request(
      'MEMORY_PIN',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as SingleOperationResult;

    // Emit MEMORY_UPDATED after successful pin
    if (response.status === 'pinned') {
      const pinned = await this.get(id);
      if (pinned) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(pinned),
        );
      }
    }

    return response;
  }

  /**
   * Unpin a memory (allow normal decay)
   * @param id - Memory ID to unpin
   * @returns Single operation result with ID and status
   */
  async unpin(id: string): Promise<SingleOperationResult> {
    const payload = { id };
    const response = (await this.workerClient.request(
      'MEMORY_UNPIN',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as SingleOperationResult;

    // Emit MEMORY_UPDATED after successful unpin
    if (response.status === 'unpinned') {
      const unpinned = await this.get(id);
      if (unpinned) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(unpinned),
        );
      }
    }

    return response;
  }

  /**
   * Archive a memory (mark as archived)
   * @param id - Memory ID to archive
   * @returns Single operation result with ID and status
   */
  async archive(id: string): Promise<SingleOperationResult> {
    const payload = { id };
    const response = (await this.workerClient.request(
      'MEMORY_ARCHIVE',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as SingleOperationResult;

    // Emit MEMORY_UPDATED after successful archive
    if (response.status === 'archived') {
      const archived = await this.get(id);
      if (archived) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(archived),
        );
      }
    }

    return response;
  }

  /**
   * Unarchive a memory (return to active status)
   * @param id - Memory ID to unarchive
   * @returns Single operation result with ID and status
   */
  async unarchive(id: string): Promise<SingleOperationResult> {
    const payload = { id };
    const response = (await this.workerClient.request(
      'MEMORY_UNARCHIVE',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as SingleOperationResult;

    // Emit MEMORY_UPDATED after successful unarchive
    if (response.status === 'active') {
      const unarchived = await this.get(id);
      if (unarchived) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(unarchived),
        );
      }
    }

    return response;
  }

  /**
   * Delete a memory permanently
   * @param id - Memory ID to delete
   * @returns Single operation result with ID and status
   */
  async delete(id: string): Promise<SingleOperationResult> {
    const payload = { id };
    const response = (await this.workerClient.request(
      'MEMORY_DELETE',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as SingleOperationResult;

    // Emit MEMORY_DELETED and STATS_CHANGED after successful delete
    if (response.status === 'deleted') {
      this.eventManager.emit('MEMORY_DELETED', id);
      this.eventManager.emit(
        'STATS_CHANGED',
        this.eventManager.createStatsEvent(await this.stats()),
      );
    }

    return response;
  }

  // ============================================================================
  // Bulk Operations (Task 4)
  // ============================================================================

  /**
   * Delete multiple memories
   * @param ids - Array of memory IDs to delete
   * @returns Bulk operation result with succeeded/failed details
   */
  async deleteMany(ids: string[]): Promise<BulkOperationResult> {
    const payload = { ids };
    const response = (await this.workerClient.request(
      'MEMORY_DELETE_MANY',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as BulkOperationResult;

    // Emit MEMORY_DELETED for each succeeded deletion
    for (const id of response.succeeded) {
      this.eventManager.emit('MEMORY_DELETED', id);
    }

    // Emit STATS_CHANGED after bulk deletion
    this.eventManager.emit(
      'STATS_CHANGED',
      this.eventManager.createStatsEvent(await this.stats()),
    );

    return response;
  }

  /**
   * Pin multiple memories
   * @param ids - Array of memory IDs to pin
   * @returns Bulk operation result with succeeded/failed details
   */
  async pinMany(ids: string[]): Promise<BulkOperationResult> {
    const payload = { ids };
    const response = (await this.workerClient.request(
      'MEMORY_PIN_MANY',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as BulkOperationResult;

    // Emit MEMORY_UPDATED for each succeeded pin
    for (const id of response.succeeded) {
      const pinned = await this.get(id);
      if (pinned) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(pinned),
        );
      }
    }

    return response;
  }

  /**
   * Unpin multiple memories
   * @param ids - Array of memory IDs to unpin
   * @returns Bulk operation result with succeeded/failed details
   */
  async unpinMany(ids: string[]): Promise<BulkOperationResult> {
    const payload = { ids };
    const response = (await this.workerClient.request(
      'MEMORY_UNPIN_MANY',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as BulkOperationResult;

    // Emit MEMORY_UPDATED for each succeeded unpin
    for (const id of response.succeeded) {
      const unpinned = await this.get(id);
      if (unpinned) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(unpinned),
        );
      }
    }

    return response;
  }

  /**
   * Archive multiple memories
   * @param ids - Array of memory IDs to archive
   * @returns Bulk operation result with succeeded/failed details
   */
  async archiveMany(ids: string[]): Promise<BulkOperationResult> {
    const payload = { ids };
    const response = (await this.workerClient.request(
      'MEMORY_ARCHIVE_MANY',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as BulkOperationResult;

    // Emit MEMORY_UPDATED for each succeeded archive
    for (const id of response.succeeded) {
      const archived = await this.get(id);
      if (archived) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(archived),
        );
      }
    }

    return response;
  }

  /**
   * Unarchive multiple memories
   * @param ids - Array of memory IDs to unarchive
   * @returns Bulk operation result with succeeded/failed details
   */
  async unarchiveMany(ids: string[]): Promise<BulkOperationResult> {
    const payload = { ids };
    const response = (await this.workerClient.request(
      'MEMORY_UNARCHIVE_MANY',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as BulkOperationResult;

    // Emit MEMORY_UPDATED for each succeeded unarchive
    for (const id of response.succeeded) {
      const unarchived = await this.get(id);
      if (unarchived) {
        this.eventManager.emit(
          'MEMORY_UPDATED',
          this.eventManager.createMemoryEvent(unarchived),
        );
      }
    }

    return response;
  }

  // ============================================================================
  // Clear and Stats (Task 5)
  // ============================================================================

  /**
   * Clear all memories from storage
   * @returns Clear result with count of cleared memories
   */
  async clear(): Promise<ClearResult> {
    const response = (await this.workerClient.request(
      'MEMORY_CLEAR',
      {},
      DEFAULT_TIMEOUT_MS,
    )) as ClearResult;

    // Emit STATS_CHANGED after clear
    this.eventManager.emit(
      'STATS_CHANGED',
      this.eventManager.createStatsEvent({
        totalMemories: 0,
        activeMemories: 0,
        fadedMemories: 0,
        pinnedMemories: 0,
        averageStrength: 0,
        oldestMemoryAt: null,
        newestMemoryAt: null,
      }),
    );

    return response;
  }

  /**
   * Get memory statistics
   * @returns Memory stats with counts and aggregates
   */
  async stats(): Promise<MemoryStats> {
    const response = (await this.workerClient.request(
      'MEMORY_STATS',
      {},
      DEFAULT_TIMEOUT_MS,
    )) as MemoryStats;
    return response;
  }

  // ============================================================================
  // Export/Import (Task 6)
  // ============================================================================

  /**
   * Export memories in specified format
   * @param format - Export format ('json' or 'markdown')
   * @returns Exported data as string
   */
  async export(format: ExportFormat): Promise<string> {
    const payload = { format };
    const response = (await this.workerClient.request(
      'MEMORY_EXPORT',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as string;
    return response;
  }

  /**
   * Import memories from exported data
   * @param data - Export data string (JSON format)
   * @param mode - Import mode ('replace' or 'merge')
   * @returns Import result with counts
   */
  async import(data: string, mode: ImportMode): Promise<ImportResult> {
    const payload = { data, mode };
    const response = (await this.workerClient.request(
      'MEMORY_IMPORT',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as ImportResult;

    // Emit STATS_CHANGED after import completes
    this.eventManager.emit(
      'STATS_CHANGED',
      this.eventManager.createStatsEvent(await this.stats()),
    );

    return response;
  }

  // ============================================================================
  // Query Methods (Task 7) - Delegate to QueryEngine
  // ============================================================================

  /**
   * List memories with optional filtering, sorting, and pagination
   * @param options - Query options including filter, sort, offset, limit
   * @returns Paginated result with items, total count, and hasMore flag
   */
  async list(options?: ListOptions): Promise<PaginatedResult<MemoryDTO>> {
    const response = (await this.workerClient.request(
      'LIST',
      options ?? {},
      DEFAULT_TIMEOUT_MS,
    )) as PaginatedResult<MemoryDTO>;
    return response;
  }

  /**
   * Get a single memory by ID
   * @param id - Memory ID to look up
   * @returns Memory if found, null otherwise
   */
  async get(id: string): Promise<MemoryDTO | null> {
    const payload = { id };
    const response = (await this.workerClient.request(
      'GET',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as MemoryDTO | null;
    return response;
  }

  /**
   * Get memories by conversation ID
   * @param conversationId - Conversation ID to filter by
   * @returns Array of memories from the conversation
   */
  async getByConversation(conversationId: string): Promise<MemoryDTO[]> {
    const payload = { conversationId };
    const response = (await this.workerClient.request(
      'GET_BY_CONVERSATION',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as MemoryDTO[];
    return response;
  }

  /**
   * Get recent memories
   * @param limit - Maximum number of memories to return (default: 10)
   * @returns Array of recent memories
   */
  async getRecent(limit = 10): Promise<MemoryDTO[]> {
    const payload = { limit };
    const response = (await this.workerClient.request(
      'GET_RECENT',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as MemoryDTO[];
    return response;
  }

  /**
   * Get top memories by strength
   * @param limit - Maximum number of memories to return (default: 10)
   * @returns Array of strongest memories
   */
  async getTop(limit = 10): Promise<MemoryDTO[]> {
    const payload = { limit };
    const response = (await this.workerClient.request(
      'GET_TOP',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as MemoryDTO[];
    return response;
  }

  /**
   * Get pinned memories
   * @returns Array of pinned memories
   */
  async getPinned(): Promise<MemoryDTO[]> {
    const response = (await this.workerClient.request(
      'GET_PINNED',
      {},
      DEFAULT_TIMEOUT_MS,
    )) as MemoryDTO[];
    return response;
  }

  /**
   * Full-text search on memory content
   * @param query - Search query string
   * @param mode - Search mode: 'exact', 'and', or 'or' (default: 'and')
   * @returns Array of matching memories
   */
  async search(
    query: string,
    mode: 'exact' | 'and' | 'or' = 'and',
  ): Promise<MemoryDTO[]> {
    const payload = { query, options: { mode } };
    const response = (await this.workerClient.request(
      'SEARCH',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as MemoryDTO[];
    return response;
  }

  /**
   * Semantic search using vector similarity
   * @param query - Query text to search for
   * @param options - Search options including k and composite scoring
   * @returns Array of memories ranked by relevance
   */
  async semanticSearch(
    query: string,
    options?: SemanticSearchOptions,
  ): Promise<MemoryDTO[]> {
    const payload = { query, options: options ?? {} };
    const response = (await this.workerClient.request(
      'SEMANTIC_SEARCH',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as MemoryDTO[];
    return response;
  }

  /**
   * Get memories grouped by date (timeline view)
   * @param groupBy - Grouping level: 'day', 'week', or 'month' (default: 'day')
   * @returns Timeline result with date groups
   */
  async getTimeline(
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<TimelineResult> {
    const payload = { options: { groupBy } };
    const response = (await this.workerClient.request(
      'GET_TIMELINE',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as TimelineResult;
    return response;
  }

  /**
   * Get memories grouped by type
   * @returns Grouped result with type groups
   */
  async getGrouped(): Promise<GroupedResult> {
    const response = (await this.workerClient.request(
      'GET_GROUPED',
      {},
      DEFAULT_TIMEOUT_MS,
    )) as GroupedResult;
    return response;
  }

  /**
   * Preview what augment() would inject for a query
   * @param userMessage - User message to search for
   * @param history - Chat message history for token accounting
   * @returns Injection preview with memories and token estimates
   */
  async getInjectionPreview(
    userMessage: string,
    history: ChatMessage[] = [],
  ): Promise<InjectionPreviewResult> {
    const payload = { query: userMessage, options: { messages: history } };
    const response = (await this.workerClient.request(
      'GET_INJECTION_PREVIEW',
      payload,
      DEFAULT_TIMEOUT_MS,
    )) as InjectionPreviewResult;
    return response;
  }
}
