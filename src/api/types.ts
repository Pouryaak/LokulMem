/**
 * Management API types for LokulMem
 *
 * These types define the manage() namespace API including:
 * - Bulk operation results with detailed feedback
 * - Export/import formats and modes
 * - Single operation status responses
 * - Clear and stats results
 */

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
