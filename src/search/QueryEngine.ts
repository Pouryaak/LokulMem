/**
 * QueryEngine - High-level query API for memory retrieval
 *
 * Provides 10+ methods for:
 * - Listing and filtering memories with pagination
 * - Full-text search with exact/and/or modes
 * - Semantic search with composite scoring
 * - Timeline and grouped queries
 * - Injection preview for augment()
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { MemoryDTO, MemoryType } from '../types/memory.js';
import type { EmbeddingEngine } from '../worker/EmbeddingEngine.js';
import type { VectorSearch } from './VectorSearch.js';
import type {
  FullTextSearchOptions,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
  SemanticSearchOptions,
  TimelineGroup,
  TypeGroup,
} from './types.js';

/**
 * QueryEngine class for high-level memory queries
 *
 * Delegates to MemoryRepository for database operations
 * and VectorSearch for semantic similarity scoring.
 */
export class QueryEngine {
  /**
   * Create a new QueryEngine instance
   * @param repository - Memory repository for database access
   * @param vectorSearch - Vector search engine for semantic queries
   * @param embeddingEngine - Embedding engine (unused in Phase 5, stored for Phase 6+)
   */
  constructor(
    private repository: MemoryRepository,
    private vectorSearch: VectorSearch,
    embeddingEngine: EmbeddingEngine,
  ) {
    // Store for Phase 6+ dynamic query embedding
    void embeddingEngine;
  }

  /**
   * List memories with optional filtering, sorting, and pagination
   *
   * Method overloads (for Phase 6+ or .d.ts):
   * - list() returns PaginatedResult<MemoryDTO>
   * - list({ includeEmbedding: true }) returns PaginatedResult<MemoryInternal>
   *
   * @param options - Query options including filter, sort, offset, limit
   * @returns Paginated result with items, total count, and hasMore flag
   */
  async list(options: QueryOptions = {}): Promise<PaginatedResult<MemoryDTO>> {
    const {
      filter,
      sort = 'recent',
      offset = 0,
      limit = 50,
      includeEmbedding = false,
    } = options;

    // Apply filters using repository methods
    let memories: MemoryInternal[];

    if (filter?.status) {
      memories = await this.repository.findByStatus(filter.status);
    } else {
      memories = await this.repository.getAll();
    }

    // Apply additional filters in memory
    memories = this.applyFilters(memories, filter);

    // Sort
    memories = this.sortMemories(memories, sort);

    // Get total before pagination
    const total = memories.length;

    // Paginate
    const paginatedMemories = memories.slice(offset, offset + limit);

    // Convert to DTO (exclude embeddings unless requested)
    const items = includeEmbedding
      ? (paginatedMemories as unknown as MemoryDTO[])
      : paginatedMemories.map((m) => this.toDTO(m));

    return {
      items,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get a single memory by ID
   *
   * Method overloads (for Phase 6+ or .d.ts):
   * - get(id) returns MemoryDTO | null
   * - get(id, true) returns MemoryInternal | null
   *
   * @param id - Memory ID to look up
   * @param includeEmbedding - Whether to include embedding in result
   * @returns Memory if found, null otherwise
   */
  async get(id: string, includeEmbedding = false): Promise<MemoryDTO | null> {
    const memory = await this.repository.getById(id);
    if (!memory) {
      return null;
    }
    return includeEmbedding
      ? (memory as unknown as MemoryDTO)
      : this.toDTO(memory);
  }

  /**
   * Get memories by conversation ID
   * @param conversationId - Conversation ID to filter by
   * @param options - Query options for filtering, sorting, pagination
   * @returns Paginated result of memories from the conversation
   */
  async getByConversation(
    conversationId: string,
    options: QueryOptions = {},
  ): Promise<PaginatedResult<MemoryDTO>> {
    const allMemories = await this.repository.getAll();
    const conversationMemories = allMemories.filter((m) =>
      m.sourceConversationIds.includes(conversationId),
    );

    const filtered = this.applyFilters(conversationMemories, options.filter);
    const sorted = this.sortMemories(filtered, options.sort || 'recent');
    const total = sorted.length;
    const { offset = 0, limit = 50, includeEmbedding = false } = options;
    const paginated = sorted.slice(offset, offset + limit);

    return {
      items: includeEmbedding
        ? (paginated as unknown as MemoryDTO[])
        : paginated.map((m) => this.toDTO(m)),
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get recent memories (convenience method)
   * @param limit - Maximum number of memories to return
   * @returns Array of recent memories
   */
  async getRecent(limit = 50): Promise<MemoryDTO[]> {
    const result = await this.list({
      sort: 'recent',
      limit,
    });
    return result.items;
  }

  /**
   * Get top memories by strength (convenience method)
   * @param limit - Maximum number of memories to return
   * @returns Array of strongest memories
   */
  async getTop(limit = 50): Promise<MemoryDTO[]> {
    const result = await this.list({
      sort: 'strength',
      filter: { minStrength: 0.5 },
      limit,
    });
    return result.items;
  }

  /**
   * Get pinned memories (convenience method)
   * @param limit - Maximum number of memories to return
   * @returns Array of pinned memories
   */
  async getPinned(limit = 100): Promise<MemoryDTO[]> {
    const result = await this.list({
      filter: { pinned: true },
      sort: 'recent',
      limit,
    });
    return result.items;
  }

  /**
   * Full-text search on memory content
   * @param query - Search query string
   * @param options - Search options including mode, case sensitivity, filters
   * @returns Paginated result of matching memories
   */
  async search(
    query: string,
    options: FullTextSearchOptions = {},
  ): Promise<PaginatedResult<MemoryDTO>> {
    const allMemories = await this.repository.getAll();

    // Apply full-text search filter
    const matchingMemories = allMemories.filter((m) =>
      this.matchesQuery(m.content, query, options),
    );

    // Apply additional filters, sorting, pagination
    const filtered = this.applyFilters(matchingMemories, options.filter);
    const sorted = this.sortMemories(filtered, options.sort || 'recent');
    const total = sorted.length;
    const { offset = 0, limit = 50, includeEmbedding = false } = options;
    const paginated = sorted.slice(offset, offset + limit);

    return {
      items: includeEmbedding ? paginated : paginated.map((m) => this.toDTO(m)),
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Semantic search using vector similarity
   *
   * Defaults to semantic-only scoring (useCompositeScoring=false)
   * per CONTEXT.md decision. augment() can use composite scoring.
   *
   * @param query - Query text to search for
   * @param options - Search options including k, composite scoring, search mode
   * @returns Array of memories ranked by relevance
   */
  async semanticSearch(
    query: string,
    options: SemanticSearchOptions = {},
  ): Promise<MemoryDTO[]> {
    const {
      k = 50,
      useCompositeScoring = false, // Default: semantic-only per CONTEXT.md
      searchMode: _searchMode = 'active-cache', // Phase 6+: database/all modes
      includeEmbedding = false,
    } = options;

    // Call VectorSearch to get scored results
    const searchResults = await this.vectorSearch.search(query, {
      k,
      useCompositeScoring,
      sessionMemoryIds: new Set(), // TODO: Track session in Phase 6
    });

    // Materialize top-K memories from repository
    // NOTE: N getById calls is acceptable for k=50. For larger k,
    // add batch fetch optimization in Phase 6+.
    const memoryIds = searchResults.slice(0, k).map((r) => r.memoryId);
    const memories = await Promise.all(
      memoryIds.map((id) => this.repository.getById(id)),
    ).then((ms) => ms.filter((m): m is MemoryInternal => m !== null));

    // Return DTOs or full memories based on includeEmbedding
    return memories.map((m) => (includeEmbedding ? m : this.toDTO(m)));
  }

  /**
   * Get memories grouped by date (timeline view)
   * @param options - Query options for filtering and sorting
   * @returns Array of date-grouped memories
   */
  async getTimeline(options: QueryOptions = {}): Promise<TimelineGroup[]> {
    const result = await this.list(options);
    const groups = new Map<string, MemoryDTO[]>();

    for (const memory of result.items) {
      const parts = new Date(memory.createdAt).toISOString().split('T');
      const date = parts[0] ?? '';
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)?.push(memory);
    }

    return Array.from(groups.entries())
      .map(([date, memories]) => ({ date, memories }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Get memories grouped by type
   * @param options - Query options for filtering and sorting
   * @returns Array of type-grouped memories
   */
  async getGrouped(options: QueryOptions = {}): Promise<TypeGroup[]> {
    const result = await this.list(options);
    const groups = new Map<string, MemoryDTO[]>();

    for (const memory of result.items) {
      for (const type of memory.types) {
        if (!groups.has(type)) {
          groups.set(type, []);
        }
        groups.get(type)?.push(memory);
      }
    }

    return Array.from(groups.entries())
      .map(([type, memories]) => ({ type: type as MemoryType, memories }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }

  /**
   * Preview what augment() would inject for a query
   * @param query - Query text to search for
   * @param maxTokens - Maximum token budget (default: 1000)
   * @returns Memories with estimated token count
   */
  async getInjectionPreview(
    query: string,
    maxTokens = 1000,
  ): Promise<{
    memories: MemoryDTO[];
    estimatedTokens: number;
  }> {
    const results = await this.semanticSearch(query, { k: 50 });

    // Dynamic K based on token budget
    const limitedMemories: MemoryDTO[] = [];
    let currentTokens = 0;

    for (const memory of results) {
      const memTokens = Math.ceil(memory.content.length / 4);
      if (currentTokens + memTokens > maxTokens) break;
      limitedMemories.push(memory);
      currentTokens += memTokens;
    }

    return {
      memories: limitedMemories,
      estimatedTokens: currentTokens,
    };
  }

  /**
   * Apply filters to a memory array
   * @param memories - Memories to filter
   * @param filter - Filter criteria
   * @returns Filtered memories
   */
  private applyFilters(
    memories: MemoryInternal[],
    filter?: QueryFilter,
  ): MemoryInternal[] {
    if (!filter) return memories;

    let filtered = memories;

    if (filter.types && filter.types.length > 0) {
      filtered = filtered.filter((m) =>
        filter.types?.some((t) => m.types.includes(t)),
      );
    }

    if (filter.minStrength !== undefined) {
      const minStrength = filter.minStrength;
      filtered = filtered.filter((m) => m.currentStrength >= minStrength);
    }

    if (filter.maxStrength !== undefined) {
      const maxStrength = filter.maxStrength;
      filtered = filtered.filter((m) => m.currentStrength <= maxStrength);
    }

    if (filter.pinned !== undefined) {
      filtered = filtered.filter((m) => m.pinned === filter.pinned);
    }

    if (filter.clusterId !== undefined) {
      filtered = filtered.filter((m) => m.clusterId === filter.clusterId);
    }

    return filtered;
  }

  /**
   * Sort memories by field
   * @param memories - Memories to sort
   * @param sort - Sort field: recent, strength, or created
   * @returns Sorted memories
   */
  private sortMemories(
    memories: MemoryInternal[],
    sort: string,
  ): MemoryInternal[] {
    const sorted = [...memories];
    switch (sort) {
      case 'recent':
        return sorted.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
      case 'strength':
        return sorted.sort((a, b) => b.currentStrength - a.currentStrength);
      case 'created':
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      default:
        return sorted;
    }
  }

  /**
   * Check if memory content matches a full-text query
   * @param content - Memory content to search
   * @param query - Search query
   * @param options - Search options including mode and case sensitivity
   * @returns true if content matches query
   */
  private matchesQuery(
    content: string,
    query: string,
    options: FullTextSearchOptions,
  ): boolean {
    const { mode = 'and', caseSensitive = false } = options; // Default to 'and'
    const text = caseSensitive ? content : content.toLowerCase();
    const searchTerms = caseSensitive ? query : query.toLowerCase();

    switch (mode) {
      case 'exact':
        return text.includes(searchTerms);
      case 'and': {
        const terms = searchTerms.split(/\s+/);
        return terms.every((term) => text.includes(term));
      }
      case 'or': {
        const orTerms = searchTerms.split(/\s+/);
        return orTerms.some((term) => text.includes(term));
      }
      default:
        return text.includes(searchTerms);
    }
  }

  /**
   * Convert MemoryInternal to MemoryDTO (exclude embedding)
   * @param memory - Memory with embedding
   * @returns Memory DTO without embedding
   */
  private toDTO(memory: MemoryInternal): MemoryDTO {
    const { embedding, ...dto } = memory;
    return dto as MemoryDTO;
  }
}
