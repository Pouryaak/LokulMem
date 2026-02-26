/**
 * API types for LokulMem configuration and options
 */

import type { MemoryDTO, MemoryType } from './memory.js';

// Re-export ChatMessage from api/types for public API
export type { ChatMessage } from '../api/types.js';

/**
 * Initialization stages for progress callbacks
 */
export type InitStage =
  | 'worker'
  | 'model'
  | 'storage'
  | 'maintenance'
  | 'ready';

/**
 * Worker type preference for initialization
 */
export type WorkerTypePreference = 'auto' | 'shared' | 'dedicated' | 'main';

/**
 * Embedding configuration for model initialization
 * Passed through to the worker for model setup
 */
export interface EmbeddingConfig {
  /** Model name (e.g., 'Xenova/all-MiniLM-L6-v2') */
  modelName: string;
  /** Base URL for local model files (airgap mode) */
  localModelBaseUrl?: string;
  /** Embedding dimensions (default: 384 for MiniLM-L6-v2) */
  embeddingDims: number;
  /** Custom ONNX Runtime WASM paths */
  onnxPaths?: string | Record<string, string>;
  /** Cache size for LRU embedding cache */
  cacheSize?: number;
  /** Enable embedding cache */
  enableCache?: boolean;
}

/**
 * Configuration options for LokulMem instance
 */
export interface LokulMemConfig {
  /** Database name for IndexedDB storage */
  dbName?: string;

  /** Model name for embeddings (default: 'Xenova/all-MiniLM-L6-v2') */
  modelName?: string;

  /** Base URL for local embedding model (e.g., http://localhost:8080) */
  localModelBaseUrl?: string;

  /** Custom worker URL (advanced use case) */
  workerUrl?: string;

  /** Custom ONNX Runtime WASM paths (advanced use case) */
  onnxPaths?: string | Record<string, string>;

  /** Threshold for memory extraction (0-1, higher = more selective) */
  extractionThreshold?: number;

  /** Worker type preference - 'auto' tries SharedWorker → DedicatedWorker → main thread */
  workerType?: WorkerTypePreference;

  /** Initialization timeout in milliseconds (default: 10000) */
  initTimeoutMs?: number;

  /** Maximum retry attempts for initialization (default: 1) */
  maxRetries?: number;

  /** Progress callback during initialization */
  onProgress?: (stage: InitStage, progress: number) => void;

  /** Embedding cache size (default: 1000 entries) */
  embeddingCacheSize?: number;

  /** Enable embedding cache (default: true) */
  enableEmbeddingCache?: boolean;

  /**
   * LLM context window size in tokens.
   *
   * Used to calculate available token budget for memory injection.
   * If not provided, uses maxTokens parameter or safe default (512).
   *
   * NO DEFAULT: This is intentionally optional. Different LLMs have
   * vastly different context windows (4k, 8k, 16k, 128k+). Let the
   * user specify based on their LLM, or use maxTokens override.
   *
   * @example
   * // For Claude 3 (200k context)
   * contextWindowTokens: 200000
   *
   * @example
   * // For GPT-4 (8k context)
   * contextWindowTokens: 8192
   */
  contextWindowTokens?: number;

  /**
   * Tokens to reserve for the LLM's response (default: 1024).
   *
   * This ensures the context window isn't completely filled with
   * injected memories, leaving room for the model to generate a response.
   */
  reservedForResponseTokens?: number;

  /**
   * Token overhead per message (default: 4).
   *
   * Accounts for message formatting overhead (role, delimiters, etc.)
   * in chat-style APIs like OpenAI's Chat Completions.
   */
  tokenOverheadPerMessage?: number;

  /**
   * Custom token counter for accurate tokenization (optional).
   *
   * If provided, overrides the default ~4 chars/token estimation.
   * Useful for integrating tiktoken or other tokenizers in v2.
   *
   * @param text - Text to count tokens for
   * @returns Estimated token count
   */
  tokenCounter?: (text: string) => number;

  // === Lifecycle Configuration (optional) ===

  /**
   * Decay lambda values by memory category.
   *
   * Controls how quickly different types of memories decay.
   * Lower values = slower decay (memories last longer).
   * Defaults: semantic=0.01, episodic=0.02, procedural=0.005,
   *           semantic_short=0.03, working=0.1.
   */
  lambdaByCategory?: Partial<Record<MemoryType, number>>;

  /**
   * Lambda value for pinned memories (default: 0).
   *
   * Pinned memories don't decay by default (lambda=0).
   * Set to a positive value to allow slow decay even for pinned memories.
   */
  pinnedLambda?: number;

  /**
   * Threshold below which a memory is considered "faded" (default: 0.1).
   *
   * When strength drops below this threshold, the memory is marked as faded
   * and a MEMORY_FADED event is emitted. Faded memories are deleted after
   * 30 days.
   */
  fadedThreshold?: number;

  /**
   * Reinforcement amounts by memory category.
   *
   * Controls how much different types of memories are reinforced when accessed.
   * Higher values = stronger reinforcement.
   * Defaults: semantic=0.3, episodic=0.5, procedural=0.2,
   *           semantic_short=0.4, working=0.6.
   */
  reinforcementByCategory?: Partial<Record<MemoryType, number>>;

  /**
   * Maximum base strength cap (default: 3.0).
   *
   * Prevents unlimited reinforcement. Once a memory reaches this strength,
   * further reinforcement has no effect.
   */
  maxBaseStrength?: number;

  /**
   * Reinforcement debounce window in milliseconds (default: 5000).
   *
   * Multiple accesses within this window are debounced and written as a single
   * reinforcement to reduce IndexedDB operations.
   */
  reinforcementDebounceMs?: number;

  /**
   * Maintenance sweep interval in milliseconds (default: 3600000 = 1 hour).
   *
   * How often to run maintenance sweeps that calculate decay, mark faded memories,
   * and delete old faded memories.
   */
  maintenanceIntervalMs?: number;

  /**
   * Number of clusters for K-means (default: 10).
   *
   * If not provided, uses heuristic: max(2, floor(sqrt(n/2))).
   */
  kMeansK?: number;

  /**
   * Maximum iterations for K-means convergence (default: 100).
   */
  kMeansMaxIterations?: number;

  /**
   * Convergence threshold for K-means (default: 0.001).
   *
   * K-means stops when centroid movement is below this threshold.
   */
  kMeansConvergenceThreshold?: number;

  // === Event Configuration (optional) ===

  /**
   * Enable verbose event payloads (default: false).
   *
   * When true, event callbacks include full memory content and metadata.
   * When false (default), events only include IDs, timestamps, types, and status.
   *
   * @default false
   */
  verboseEvents?: boolean;
}

/**
 * Embedding cache statistics for public API
 */
export interface EmbeddingCacheStats {
  /** Current number of cached entries */
  size: number;
  /** Maximum number of cache entries */
  maxSize: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Estimated memory usage in bytes */
  estimatedMemoryBytes: number;
}

/**
 * Options for the augment() API
 */
export interface AugmentOptions {
  /** Maximum tokens for augmented context (overrides automatic calculation) */
  maxTokens?: number;

  /** Enable debug mode to get detailed retrieval information */
  debug?: boolean;
}

/**
 * Options for the learn() API
 */
export interface LearnOptions {
  /** Threshold for memory extraction (0-1, higher = more selective) */
  extractionThreshold?: number;
}

/**
 * Debug information returned when debug: true in augment()
 */
export interface LokulMemDebug {
  /** Memories that were injected into the context */
  injectedMemories: MemoryDTO[];

  /** Relevance scores for retrieved memories */
  scores: Array<{
    memoryId: string;
    relevance: number;
    breakdown: Record<string, number>;
  }>;

  /** Candidates that were excluded and why */
  excludedCandidates: Array<{
    memoryId: string;
    reason: string;
  }>;

  /** Token usage statistics */
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Total latency in milliseconds */
  latencyMs: number;

  /** Cache statistics when debug mode enabled */
  cacheStats?: {
    hitRate: number;
    size: number;
    maxSize: number;
    estimatedMemoryBytes: number;
  };
}

/**
 * Types of storage errors that can occur
 */
export type StorageErrorType =
  | 'quota_exceeded'
  | 'corruption'
  | 'migration_failed'
  | 'unknown';

/**
 * Complete export of all LokulMem data
 * Used for backup, corruption recovery, and migration
 */
export interface LokulMemExport {
  version: number; // schema version
  exportedAt: number; // Unix timestamp
  memories: {
    id: string;
    content: string;
    types: string[];
    status: string;
    embeddingBase64: string; // base64-encoded embedding
    createdAt: number;
    updatedAt: number;
    validFrom: number;
    validTo: number | null;
    baseStrength: number;
    currentStrength: number;
    pinned: boolean;
    mentionCount: number;
    lastAccessedAt: number;
    clusterId: string | null;
    entities: string[];
    sourceConversationIds: string[];
    supersededBy: string | null;
    supersededAt: number | null;
    fadedAt: number | null;
    metadata: Record<string, unknown>;
  }[];
  episodes: unknown[];
  edges: unknown[];
  clusters: unknown[];
}

/**
 * Structured storage error information
 * Per Phase 2 decisions: full error details with timestamp and recovery hint
 */
export interface StorageError {
  type: StorageErrorType;
  message: string;
  code: string; // error code for programmatic handling
  timestamp: number; // Unix timestamp when error occurred
  recoveryHint?: string; // suggested recovery action
  originalError?: Error;
  backup?: LokulMemExport | undefined; // backup data if corruption recovery succeeded
}

/**
 * Storage status for debugging and monitoring
 */
export interface StorageStatus {
  /** Whether database is in read-only mode (quota exceeded) */
  isReadOnly: boolean;

  /** Last error message if any */
  lastError: string | null;

  /** Current database schema version */
  dbVersion: number;

  /** Whether database is currently open */
  isOpen: boolean;
}
