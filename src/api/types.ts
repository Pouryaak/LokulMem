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

  /** Which messages to extract from (default: 'both') */
  extractFrom?: 'user' | 'assistant' | 'both';

  /** Run maintenance sweep after extraction (default: false) */
  runMaintenance?: boolean;

  /** Override extraction threshold (default: 0.55) */
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
}

/**
 * Options for augment() operation
 */
export interface AugmentOptions {
  /** Maximum number of memories to inject (default: 10) */
  maxMemories?: number;

  /** Minimum relevance threshold (default: 0.6) */
  minScore?: number;

  /** Token budget for memory injection (default: from config) */
  contextWindowTokens?: number;

  /** Reserved tokens for response (default: from config) */
  reservedForResponseTokens?: number;

  /** Whether to include debug information (default: false) */
  debug?: boolean;

  /** Session memory IDs for continuity scoring */
  sessionMemoryIds?: Set<string>;
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

    /** Total tokens used for memory injection */
    injectionTokens: number;

    /** Remaining tokens after injection */
    remainingTokens: number;

    /** Whether any relevant memories were found */
    foundMemories: boolean;

    /** Debug information (if debug=true) */
    debug?: LokulMemDebug;
  };
}

/**
 * Debug information for augment/learn operations
 */
export interface LokulMemDebug {
  /** All retrieved memories with scores */
  retrieved: Array<{
    memory: MemoryDTO;
    score: number;
    reason?: string;
  }>;

  /** Memories excluded from injection */
  excluded: Array<{
    memory: MemoryDTO;
    reason: string;
  }>;

  /** Token usage breakdown */
  tokens: {
    usedBeforeInjection: number;
    injectionCost: number;
    remainingAfterInjection: number;
  };

  /** Timing information (ms) */
  timing: {
    search: number;
    scoring: number;
    injection: number;
    total: number;
  };
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
