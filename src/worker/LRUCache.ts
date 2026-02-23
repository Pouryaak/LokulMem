/**
 * LRUCache - Least Recently Used cache for embeddings
 *
 * Provides:
 * - Fixed-size cache with LRU eviction
 * - Statistics tracking (hits, misses, hit rate)
 * - Memory usage estimation
 * - Promise queue for concurrency control
 */

/**
 * Entry stored in the cache
 */
interface CacheEntry {
  /** The embedding vector */
  embedding: Float32Array;
  /** Unix timestamp for age calculation */
  timestamp: number;
  /** Access count for statistics */
  accessCount: number;
}

/**
 * Cache statistics for monitoring and debugging
 */
export interface CacheStats {
  /** Current number of entries */
  size: number;
  /** Maximum number of entries */
  maxSize: number;
  /** Total cache hits */
  hitCount: number;
  /** Total cache misses */
  missCount: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Age of oldest entry in milliseconds */
  oldestEntryAgeMs: number;
  /** Estimated memory usage in bytes */
  estimatedMemoryBytes: number;
}

/**
 * LRU Cache implementation using Map for O(1) operations
 * Map preserves insertion order, so first entry is oldest (LRU)
 */
export class LRUCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private stats: { hits: number; misses: number };
  private dims: number;
  private readonly BYTES_PER_FLOAT = 4;

  /**
   * Create a new LRU cache
   * @param maxSize - Maximum number of entries (default: 1000)
   * @param dims - Embedding dimensions for memory calculation (default: 384)
   */
  constructor(maxSize = 1000, dims = 384) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.dims = dims;
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get an embedding from the cache
   * @param key - The cache key (typically the text content)
   * @returns The cached embedding or undefined if not found
   */
  get(key: string): Float32Array | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      // Cache hit
      this.stats.hits++;
      entry.accessCount++;
      entry.timestamp = Date.now();

      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);

      return entry.embedding;
    }

    // Cache miss
    this.stats.misses++;
    return undefined;
  }

  /**
   * Store an embedding in the cache
   * @param key - The cache key (typically the text content)
   * @param embedding - The embedding vector to store
   */
  set(key: string, embedding: Float32Array): void {
    // If key exists, delete it first (will be re-added at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // At capacity - delete oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry at end (most recent)
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  /**
   * Check if a key exists in the cache
   * @param key - The cache key
   * @returns True if the key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete an entry from the cache
   * @param key - The cache key
   * @returns True if an entry was deleted
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get current cache statistics
   * @returns CacheStats with size, hit rate, memory estimate, etc.
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    // Find oldest entry
    let oldestTimestamp = Date.now();
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }
    const oldestEntryAgeMs =
      this.cache.size > 0 ? Date.now() - oldestTimestamp : 0;

    // Estimate memory usage
    const estimatedMemoryBytes =
      this.cache.size * this.dims * this.BYTES_PER_FLOAT;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.stats.hits,
      missCount: this.stats.misses,
      hitRate,
      oldestEntryAgeMs,
      estimatedMemoryBytes,
    };
  }

  /**
   * Get the current number of entries in the cache
   * @returns Current cache size
   */
  getSize(): number {
    return this.cache.size;
  }
}

/**
 * Queue item for PromiseQueue
 */
interface QueueItem<T> {
  /** The function to execute */
  fn: () => Promise<T>;
  /** Resolve the promise */
  resolve: (value: T) => void;
  /** Reject the promise */
  reject: (error: Error) => void;
}

/**
 * PromiseQueue - Ensures sequential execution of async operations
 *
 * Only one operation runs at a time, preventing race conditions
 * and memory pressure from concurrent embedding calls.
 */
export class PromiseQueue {
  private queue: QueueItem<unknown>[];
  private running: boolean;

  constructor() {
    this.queue = [];
    this.running = false;
  }

  /**
   * Add a function to the queue
   * @param fn - Async function to execute
   * @returns Promise that resolves when fn completes
   */
  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * Process the next item in the queue
   */
  private processQueue(): void {
    if (this.running) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.running = true;
    const item = this.queue.shift();

    if (!item) {
      this.running = false;
      return;
    }

    item
      .fn()
      .then((result) => {
        item.resolve(result);
      })
      .catch((error) => {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      })
      .finally(() => {
        this.running = false;
        this.processQueue();
      });
  }

  /**
   * Get the current queue length
   * @returns Number of pending items
   */
  size(): number {
    return this.queue.length;
  }
}
