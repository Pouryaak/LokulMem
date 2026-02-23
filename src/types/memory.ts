/**
 * Memory types supported by the library
 * Memories can have multiple types (e.g., a preference about a profession)
 */
export type MemoryType =
  | 'identity'
  | 'location'
  | 'profession'
  | 'preference'
  | 'project'
  | 'temporal'
  | 'relational'
  | 'emotional';

/**
 * Memory status lifecycle
 */
export type MemoryStatus = 'active' | 'faded' | 'archived' | 'superseded';

/**
 * MemoryDTO - Public API representation of a memory
 * DTO pattern: embeddings are excluded from public API responses
 * Note: Uses number timestamps instead of Date for serialization compatibility
 */
export interface MemoryDTO {
  /** Unique identifier for the memory */
  id: string;

  /** Memory content (the actual information) */
  content: string;

  /** Memory types (can have multiple per schema) */
  types: MemoryType[];

  /** Current status in the lifecycle */
  status: MemoryStatus;

  /** Creation timestamp (Unix ms) */
  createdAt: number;

  /** Last update timestamp (Unix ms) */
  updatedAt: number;

  /** When this memory becomes valid (Unix ms) */
  validFrom: number;

  /** When this memory expires, null if never (Unix ms) */
  validTo: number | null;

  /** Base importance/strength of the memory (0-1) */
  baseStrength: number;

  /** Current strength after decay (0-1) */
  currentStrength: number;

  /** Whether the memory is pinned (never decays) */
  pinned: boolean;

  /** How many times this memory has been mentioned/accessed */
  mentionCount: number;

  /** Last access timestamp (Unix ms) */
  lastAccessedAt: number;

  /** Cluster ID for grouping related memories */
  clusterId: string | null;

  /** Named entities extracted from the content */
  entities: string[];

  /** Conversation IDs this memory belongs to (memories can span multiple conversations) */
  sourceConversationIds: string[];

  /** ID of the memory that superseded this one (if status is 'superseded') */
  supersededBy: string | null;

  /** When this memory was superseded (Unix ms) */
  supersededAt: number | null;

  /** When this memory faded (Unix ms) */
  fadedAt: number | null;

  /** Additional metadata (flexible extension point) */
  metadata: Record<string, unknown>;
}
