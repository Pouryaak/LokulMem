/**
 * VectorSearch - Brute-force cosine similarity search with in-memory cache
 *
 * This module implements:
 * - Eager loading of active memory embeddings at initialization
 * - Write-through cache synchronization (add/update/delete)
 * - Brute-force O(N) cosine similarity search for N ≤ 3000
 * - Composite scoring with Scoring class integration
 * - Cluster bonus for related memories
 *
 * Performance target: <30ms for N ≤ 3000 memories
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { EmbeddingEngine } from '../worker/EmbeddingEngine.js';
import { Scoring } from './Scoring.js';
import type { ScoringConfig, SearchResult } from './types.js';

// Re-export SearchOptions with local default values
export interface SearchOptions {
  /** Maximum number of results to return (default: 50) */
  k?: number;

  /** Whether to use composite scoring vs cosine similarity only (default: true) */
  useCompositeScoring?: boolean;

  /** Minimum score threshold for relevance (default: from config) */
  floorThreshold?: number;

  /** Set of memory IDs in current session for continuity scoring */
  sessionMemoryIds?: Set<string>;
}

/**
 * VectorSearch class for semantic memory retrieval
 *
 * Uses brute-force cosine similarity search with in-memory Float32Array cache
 * for fast repeated searches without IndexedDB round-trips.
 */
export class VectorSearch {
  private cache = new Map<string, Float32Array>();
  private metaCache = new Map<
    string,
    {
      lastAccessedAt: number;
      pinned: boolean;
      strength: number;
      clusterId: string | null;
      conflictDomain:
        | 'identity'
        | 'location'
        | 'preference'
        | 'temporal'
        | 'relational'
        | 'emotional'
        | 'profession'
        | 'project';
    }
  >();
  private scoring: Scoring;

  /**
   * Create a new VectorSearch instance
   * @param repository - Memory repository for database access
   * @param embeddingEngine - Embedding engine for query embedding generation
   * @param scoringConfig - Optional scoring configuration
   */
  constructor(
    private repository: MemoryRepository,
    private embeddingEngine: EmbeddingEngine,
    scoringConfig?: Partial<ScoringConfig>,
  ) {
    this.scoring = new Scoring(scoringConfig);
  }

  /**
   * Initialize: eager load all active memory embeddings AND metadata
   *
   * Loads all active memories into dual cache (embeddings + metadata)
   * for fast repeated searches without database round-trips.
   */
  async initialize(): Promise<void> {
    const activeMemories = await this.repository.findByStatus('active');

    for (const memory of activeMemories) {
      this.cache.set(memory.id, memory.embedding);
      this.metaCache.set(memory.id, {
        lastAccessedAt: memory.lastAccessedAt,
        pinned: memory.pinned,
        strength: memory.currentStrength,
        clusterId: memory.clusterId,
        conflictDomain: memory.conflictDomain,
      });
    }

    console.log(
      `[VectorSearch] Cached ${this.cache.size} active memory embeddings with metadata`,
    );
  }

  /**
   * Write-through: add embedding and metadata to cache
   * @param memory - Memory to add to cache
   */
  add(memory: MemoryInternal): void {
    this.cache.set(memory.id, memory.embedding);
    this.metaCache.set(memory.id, {
      lastAccessedAt: memory.lastAccessedAt,
      pinned: memory.pinned,
      strength: memory.currentStrength,
      clusterId: memory.clusterId,
      conflictDomain: memory.conflictDomain,
    });
  }

  /**
   * Write-through: update embedding and metadata in cache
   * @param memory - Memory to update in cache
   */
  update(memory: MemoryInternal): void {
    this.cache.set(memory.id, memory.embedding);
    this.metaCache.set(memory.id, {
      lastAccessedAt: memory.lastAccessedAt,
      pinned: memory.pinned,
      strength: memory.currentStrength,
      clusterId: memory.clusterId,
      conflictDomain: memory.conflictDomain,
    });
  }

  /**
   * Write-through: remove embedding and metadata from cache
   * @param memoryId - Memory ID to remove from cache
   */
  delete(memoryId: string): void {
    this.cache.delete(memoryId);
    this.metaCache.delete(memoryId);
  }

  /**
   * Get embedding from cache
   * @param memoryId - Memory ID to look up
   * @returns Float32Array embedding or undefined if not cached
   */
  get(memoryId: string): Float32Array | undefined {
    return this.cache.get(memoryId);
  }

  /**
   * Get all cached embeddings (for testing/debugging)
   * @returns Map of memory ID to embedding
   */
  getCache(): Map<string, Float32Array> {
    return this.cache;
  }

  /**
   * Semantic search with composite scoring
   *
   * Performs brute-force cosine similarity search over all cached embeddings,
   * then applies composite scoring (if enabled) and floor threshold filtering.
   *
   * @param query - Query text to search for
   * @param options - Search options (k, composite scoring, threshold, session)
   * @returns Array of search results ranked by score
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const {
      k = 50,
      useCompositeScoring = true,
      floorThreshold,
      sessionMemoryIds = new Set(),
    } = options;

    const threshold = floorThreshold ?? this.scoring.getConfig().floorThreshold;

    // Generate query embedding
    const queryEmbedding = await this.embeddingEngine.embed(query);

    // Build similarity map first (O(N))
    const similarityMap = new Map<string, number>();
    for (const [memoryId, memoryEmbedding] of this.cache) {
      similarityMap.set(
        memoryId,
        this.cosineSimilarity(queryEmbedding, memoryEmbedding),
      );
    }

    const results: SearchResult[] = [];
    const now = Date.now();

    // Compute composite scores using cached metadata (no DB reads)
    for (const [memoryId, similarity] of similarityMap) {
      const meta = this.metaCache.get(memoryId);
      if (!meta) continue;

      // Apply composite scoring if enabled
      let score = similarity;
      let breakdown: ReturnType<typeof this.scoring.computeScore> | undefined =
        undefined;

      if (useCompositeScoring) {
        breakdown = this.scoring.computeScore(
          similarity,
          {
            id: memoryId,
            ...meta,
          },
          now,
          sessionMemoryIds,
        );
        score = breakdown.total;
      }

      // Apply floor threshold
      if (score >= threshold) {
        const result: SearchResult = {
          memoryId,
          similarity,
          score,
        };
        if (breakdown !== undefined) {
          result.breakdown = breakdown;
        }
        results.push(result);
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply cluster bonus: +0.05 to candidates with same cluster as top match
    if (results.length > 0) {
      const topResult = results[0];
      if (!topResult) {
        return results.slice(0, k);
      }
      const topMeta = this.metaCache.get(topResult.memoryId);
      if (topMeta?.clusterId) {
        for (const result of results) {
          if (result.memoryId !== topResult.memoryId) {
            const resultMeta = this.metaCache.get(result.memoryId);
            if (resultMeta?.clusterId === topMeta.clusterId) {
              result.score += 0.05;
              if (result.breakdown) {
                result.breakdown.total = result.score;
              }
            }
          }
        }
        // Re-sort after cluster bonus
        results.sort((a, b) => b.score - a.score);
      }
    }

    // Return top K
    return results.slice(0, k);
  }

  /**
   * Optimized cosine similarity for normalized vectors
   *
   * IMPORTANT: Assumes embeddings are normalized. Verify Phase 4 enforces
   * normalize=true on pipeline output, or compute true cosine with norms.
   *
   * For normalized vectors: cosine(a,b) = dot(a,b)
   * For unnormalized vectors: cosine(a,b) = dot(a,b) / (||a|| * ||b||)
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity in [0, 1]
   * @throws Error if dimensions don't match
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(
        `Embedding dimension mismatch: ${a.length} != ${b.length}`,
      );
    }

    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
      }
    }

    // Vectors MUST be normalized for dot product to equal cosine similarity
    // TODO: Verify EmbeddingEngine.normalize=true config in Phase 4
    // If not normalized, compute true cosine:
    // const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    // const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    // return dotProduct / (normA * normB);

    // Clamp to [0, 1] to handle floating point errors
    return Math.max(0, Math.min(1, dotProduct));
  }

  /**
   * Get cache size (number of cached embeddings)
   * @returns Number of embeddings in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear cache (for testing or recovery)
   * Clears both embedding cache and metadata cache
   */
  clear(): void {
    this.cache.clear();
    this.metaCache.clear();
  }

  /**
   * Search memories within a conflict domain
   * Used for contradiction detection candidate retrieval
   *
   * @param query - Query text
   * @param conflictDomain - Conflict domain to filter
   * @param k - Number of candidates (default: 7)
   * @returns Array of search results with memory details
   */
  async searchByConflictDomain(
    query: string,
    conflictDomain:
      | 'identity'
      | 'location'
      | 'preference'
      | 'temporal'
      | 'relational'
      | 'emotional'
      | 'profession'
      | 'project',
    k = 7,
  ): Promise<Array<{ memoryId: string; similarity: number }>> {
    const queryEmbedding = await this.embeddingEngine.embed(query);

    // Build similarity map filtered by conflict domain
    const candidates: Array<{ memoryId: string; similarity: number }> = [];

    for (const [memoryId, memoryEmbedding] of this.cache) {
      const meta = this.metaCache.get(memoryId);
      if (!meta) continue;

      // CRITICAL FIX: Filter by conflict domain during iteration
      // conflictDomain MUST be in metaCache from Phase 5 init
      if (meta.conflictDomain !== conflictDomain) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);
      candidates.push({ memoryId, similarity });
    }

    // Sort by similarity descending
    candidates.sort((a, b) => b.similarity - a.similarity);

    return candidates.slice(0, k);
  }
}
