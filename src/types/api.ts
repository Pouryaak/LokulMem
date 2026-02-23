/**
 * API types for LokulMem configuration and options
 */

import type { MemoryDTO } from './memory.js';

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
 * Configuration options for LokulMem instance
 */
export interface LokulMemConfig {
  /** Database name for IndexedDB storage */
  dbName?: string;

  /** Base URL for local embedding model (e.g., http://localhost:8080) */
  localModelBaseUrl?: string;

  /** Custom worker URL (advanced use case) */
  workerUrl?: string;

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
}

/**
 * Options for the augment() API
 */
export interface AugmentOptions {
  /** Maximum tokens for augmented context */
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
  backup?: LokulMemExport; // backup data if corruption recovery succeeded
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
