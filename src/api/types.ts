/**
 * API types for LokulMem public interface
 */

import type { ContradictionEvent } from '../types/events.js';
import type { MemoryDTO } from '../types/memory.js';

/**
 * Chat message representation for augment/learn operations
 */
export interface ChatMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system';

  /** Message content */
  content: string;

  /** Optional timestamp (Unix ms) */
  timestamp?: number;
}

/**
 * Options for learn() operation
 */
export interface LearnOptions {
  /** Conversation ID for tracking (auto-generated if not provided) */
  conversationId?: string;

  /** Which messages to extract from (default: 'user' - assistant responses usually not information sources) */
  extractFrom?: 'user' | 'assistant' | 'both';

  /** Run maintenance sweep after extraction (default: false) */
  runMaintenance?: boolean;

  /** Override extraction threshold (default: instance extractionThreshold, 0.45 by default) */
  learnThreshold?: number;

  /** Auto-associate with previous augment() results (default: false) */
  autoAssociate?: boolean;

  /** Store assistant response in episode (default: false) */
  storeResponse?: boolean;

  /** Return full memory details (default: false - IDs only) */
  verbose?: boolean;
}

/**
 * Result from learn() operation
 */
export interface LearnResult {
  /** Memories extracted from conversation */
  extracted: MemoryDTO[];

  /** Contradictions detected and resolved */
  contradictions: ContradictionEvent[];

  /** Maintenance sweep results (if runMaintenance=true) */
  maintenance: {
    faded: number;
    deleted: number;
  };

  /** Conversation ID (provided or auto-generated) */
  conversationId: string;

  /** Optional extraction diagnostics (only when LearnOptions.verbose=true) */
  diagnostics?: LearnDiagnostic[];

  /** Optional latency timings in ms (only when LearnOptions.verbose=true) */
  timings?: {
    totalMs: number;
    perSourceMs: number[];
  };
}

/** Per-source diagnostic emitted by learn() in verbose mode */
export interface LearnDiagnostic {
  source: string;
  extractionMode?: 'deterministic' | 'fallback';
  normalizedSource?: string;
  extractionSource?: string;
  normalizationOperations?: string[];
  canonicalKey?: string;
  score: number;
  novelty: number;
  specificity: number;
  recurrence: number;
  threshold: number;
  accepted: boolean;
  memoryTypes: import('../types/memory.js').MemoryType[];
  entityCount: number;
  linkedEntityCount?: number;
  riskSignals?: Array<
    | 'REPETITIVE_NOISE'
    | 'LOW_STRUCTURE_HIGH_SCORE'
    | 'AMBIGUOUS_TEMPORAL'
    | 'INTERROGATIVE_ONLY'
  >;
  policyAction?: 'ADD' | 'UPDATE' | 'SUPERSEDE' | 'IGNORE';
  policyReasonCodes?: Array<
    | 'NO_ACTIVE_MATCH'
    | 'EXACT_CANONICAL_DUPLICATE'
    | 'TRANSITIONAL_REPLACEMENT'
    | 'SAME_PREDICATE_NEW_VALUE'
    | 'LOW_CONFIDENCE_MATCH'
  >;
  policyTargetMemoryId?: string;
  ambiguityTriggered?: boolean;
  ambiguityReasons?: Array<
    | 'GRAY_ZONE_SCORE'
    | 'PRONOUN_RELATION_AMBIGUITY'
    | 'UNRESOLVED_TEMPORAL_SHIFT'
    | 'PERSONAL_FACT_CUE'
  >;
  fallbackInvoked?: boolean;
  fallbackFactCount?: number;
  fallbackProvider?: 'pattern' | 'webllm' | 'noop';
  fallbackModel?: string;
  fallbackError?: string;
  fusionAccepted?: boolean;
  fusionAgreement?: boolean;
  processingMs?: number;
}

/**
 * Options for augment() operation
 */
export interface AugmentOptions {
  /**
   * LLM context window size in tokens
   *
   * NO default - user must specify this for accurate token budgeting.
   * Can be set globally in LokulMem config or per-call.
   *
   * @example 8192 for Claude 3, 128000 for GPT-4
   */
  contextWindowTokens?: number;

  /**
   * Tokens to reserve for LLM response
   *
   * @default 512
   */
  reservedForResponseTokens?: number;

  /**
   * Override max tokens directly (bypasses budget calculation)
   *
   * If set, skips contextWindowTokens calculation and uses this value
   * as the maximum tokens for memory injection.
   */
  maxTokens?: number;

  /**
   * Enable debug mode
   *
   * Debug object is LAZY-COMPUTED - only when debug=true.
   * Default: false (must be explicitly enabled for performance).
   *
   * @default false
   */
  debug?: boolean;
}

/**
 * Result from augment() operation
 */
export interface AugmentResult {
  /** Augmented messages array ready for LLM */
  messages: ChatMessage[];

  /** Metadata about the augmentation */
  metadata: {
    /** Number of memories injected */
    injectedCount: number;

    /**
     * Flag: no relevant memories found
     *
     * true if search returned no results or all memories were below
     * the relevance threshold.
     */
    noMemoriesFound: boolean;

    /**
     * Tokens used before injection
     *
     * Sum of system prompt + history + user message tokens.
     */
    usedTokensBeforeInjection: number;

    /**
     * Tokens used for injected memories
     *
     * Estimated tokens for the memory block that was injected.
     */
    injectionTokens: number;

    /**
     * Remaining tokens after injection
     *
     * Budget remaining after injecting memories (before LLM response).
     */
    remainingTokensAfterInjection: number;
  };

  /**
   * Debug object (only if options.debug = true)
   *
   * Undefined when debug=false (lazy computation for performance).
   */
  debug?: LokulMemDebug;
}

/**
 * Debug information for augment() operation
 *
 * Provides detailed information about memory retrieval, scoring,
 * token usage, and performance. Only computed when debug=true.
 */
export interface LokulMemDebug {
  /**
   * Memories that were injected
   *
   * Full DTO objects with all metadata.
   */
  injectedMemories: MemoryDTO[];

  /**
   * Relevance scores with breakdowns
   *
   * Shows the composite score and individual components for each
   * injected memory.
   */
  scores: Array<{
    /** Memory ID */
    memoryId: string;

    /** Final composite relevance score (0-1) */
    relevance: number;

    /** Individual score components */
    breakdown: {
      /** Semantic similarity component */
      semantic: number;

      /** Recency decay component */
      recency: number;

      /** Memory strength component */
      strength: number;

      /** Session continuity component */
      continuity: number;
    };
  }>;

  /**
   * Candidates excluded and why
   *
   * Memories that were considered but excluded from injection,
   * with the reason for exclusion.
   */
  excludedCandidates: Array<{
    /** Memory ID */
    memoryId: string;

    /** Reason for exclusion */
    reason: 'low_relevance' | 'floor_threshold' | 'token_budget';
  }>;

  /**
   * Token usage breakdown
   *
   * Detailed token accounting for the entire operation.
   */
  tokenUsage: {
    /** Tokens used for prompt (messages + injected memories) */
    prompt: number;

    /** Tokens reserved for LLM completion */
    completion: number;

    /** Total tokens (prompt + completion) */
    total: number;
  };

  /**
   * Latency in milliseconds
   *
   * Total time for the augment() operation from start to finish.
   */
  latencyMs: number;
}

// ============================================================================
// Management API Types
// ============================================================================

/**
 * BulkOperationResult - Result of bulk operations (deleteMany, pinMany, etc.)
 * Provides detailed feedback on succeeded and failed operations
 */
export interface BulkOperationResult {
  /** IDs that succeeded */
  succeeded: string[];
  /** IDs that failed with error messages */
  failed: Array<{ id: string; error: string }>;
  /** Total operations attempted */
  total: number;
  /** Count summary */
  counts: {
    succeeded: number;
    failed: number;
  };
}

/**
 * ExportFormat - Export format options
 * - json: Structured JSON with base64-encoded embeddings
 * - markdown: Human-readable markdown format
 */
export type ExportFormat = 'json' | 'markdown';

/**
 * ImportMode - Import behavior modes
 * - replace: Clear all existing memories before importing
 * - merge: Add new memories, skip existing IDs
 */
export type ImportMode = 'replace' | 'merge';

/**
 * ImportResult - Result of import operation
 */
export interface ImportResult {
  /** Number of memories imported */
  imported: number;
  /** Number of memories skipped (merge mode) */
  skipped: number;
  /** Number of errors encountered */
  errors: number;
}

/**
 * ClearResult - Result of clear operation
 */
export interface ClearResult {
  /** Status indicator */
  status: 'cleared';
  /** Number of memories cleared */
  count: number;
}

/**
 * SingleOperationResult - Result of single operation (update, pin, delete, etc.)
 * Lightweight response with ID and status only
 */
export interface SingleOperationResult {
  /** Memory ID */
  id: string;
  /** Operation status */
  status: 'updated' | 'pinned' | 'unpinned' | 'archived' | 'active' | 'deleted';
}

/**
 * LokulMemExport - Export data structure for JSON format
 * Contains memories with base64-encoded embeddings for serialization
 */
export interface LokulMemExport {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: number;
  /** Memories with base64-encoded embeddings */
  memories: Array<{
    id: string;
    content: string;
    types: string[];
    status: string;
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
    /** Base64-encoded embedding for JSON serialization */
    embeddingBase64: string;
  }>;
}

/**
 * MemoryUpdate - Memory update fields for single operations
 * Subset of MemoryDTO fields that can be updated
 */
export interface MemoryUpdate {
  content?: string;
  types?: string[];
  status?: string;
  validFrom?: number;
  validTo?: number | null;
  baseStrength?: number;
  pinned?: boolean;
  clusterId?: string | null;
  entities?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * ListOptions - Options for list queries
 */
export interface ListOptions {
  /** Filter criteria */
  filter?: {
    types?: string[];
    status?: string;
    minStrength?: number;
    maxStrength?: number;
    pinned?: boolean;
    clusterId?: string;
  };
  /** Sort order: recent (lastAccessedAt), strength, or created */
  sort?: 'recent' | 'strength' | 'created';
  /** Number of items to skip (for pagination) */
  offset?: number;
  /** Maximum number of items to return */
  limit?: number;
}

/**
 * PaginatedResult - Paginated query result
 */
export interface PaginatedResult<T> {
  /** Array of items in the current page */
  items: T[];
  /** Total number of items matching the query */
  total: number;
  /** Whether there are more items available */
  hasMore: boolean;
}

/**
 * SemanticSearchOptions - Options for semantic search
 */
export interface SemanticSearchOptions {
  /** Maximum number of results to return */
  k?: number;
  /** Whether to use composite scoring vs semantic-only */
  useCompositeScoring?: boolean;
}

/**
 * TimelineResult - Result of timeline query
 */
export interface TimelineResult {
  groups: Array<{
    date: string;
    memories: MemoryDTO[];
  }>;
}

/**
 * GroupedResult - Result of grouped query
 */
export interface GroupedResult {
  groups: Array<{
    type: string;
    memories: MemoryDTO[];
  }>;
}

/**
 * InjectionPreviewResult - Result of injection preview
 */
export interface InjectionPreviewResult {
  memories: MemoryDTO[];
  estimatedTokens: number;
  availableTokens: number;
  usedTokens: number;
}

// ============================================================================
// Event System Types
// ============================================================================

/**
 * EventConfig - Event system configuration
 */
export interface EventConfig {
  /** Enable verbose event payloads (default: false - IDs only) */
  verboseEvents?: boolean;
}

/**
 * MemoryEventPayload - Memory lifecycle event payload
 *
 * IDs-only by default for lightweight events.
 * Verbose mode includes content and metadata fields.
 * Embeddings never included in events (per CONTEXT decision).
 */
export interface MemoryEventPayload {
  /** Memory ID */
  memoryId: string;
  /** Timestamp of event */
  timestamp: number;
  /** Memory types (comma-separated) */
  type: string;
  /** Memory status */
  status: string;
  /** Optional verbose fields (only if verboseEvents=true) */
  content?: string;
  /** Optional metadata (only if verboseEvents=true) */
  metadata?: Record<string, unknown>;
  /** NOTE: embedding field NEVER included (per CONTEXT decision) */
}

/**
 * StatsChangedPayload - Stats changed event payload
 */
export interface StatsChangedPayload {
  /** Updated statistics */
  stats: import('../types/events.js').MemoryStats;
  /** Timestamp of change */
  timestamp: number;
}

/**
 * EventType - All event types
 */
export type EventType =
  | 'MEMORY_ADDED'
  | 'MEMORY_UPDATED'
  | 'MEMORY_DELETED'
  | 'MEMORY_FADED'
  | 'STATS_CHANGED'
  | 'CONTRADICTION_DETECTED'
  | 'MEMORY_SUPERSEDED';
