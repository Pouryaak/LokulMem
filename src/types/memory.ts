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

/**
 * Entity - Named entity extracted from memory content
 * Entities are typed with optional confidence scores
 *
 * NOTE: 'possession' is NOT a separate entity type - possessions are tracked
 * via a boolean flag on memories, not as entities. This prevents Entity.type
 * union from needing 'possession' which would violate the type contract.
 */
export interface Entity {
  /** Entity type (person, place, number, date, preference, negation) */
  type: 'person' | 'place' | 'number' | 'date' | 'preference' | 'negation';

  /** Extracted value (normalized form) */
  value: string;

  /** Raw text as it appeared in content */
  raw: string;

  /** Number of times this entity appears across all memories */
  count: number;

  /** Optional confidence score (0-1) from extraction pattern */
  confidence?: number;
}

/**
 * ExtractionScore - Quality score for memory extraction
 */
export interface ExtractionScore {
  /** Overall extraction quality score (0-1) */
  score: number;

  /** Novelty component (0-1) */
  novelty: number;

  /** Specificity component (0-1) */
  specificity: number;

  /** Recurrence component (0-1) */
  recurrence: number;

  /** Whether score meets extraction threshold */
  meetsThreshold: boolean;
}

/**
 * ExtractionConfig - Configuration for extraction quality scoring
 */
export interface ExtractionConfig {
  /** Default extraction threshold (0-1) - default: 0.55 */
  threshold: number;

  /** Minimum novelty gate - default: 0.15 */
  minNovelty: number;

  /** Weight for novelty component - default: 0.35 */
  noveltyWeight: number;

  /** Weight for specificity component - default: 0.45 */
  specificityWeight: number;

  /** Weight for recurrence component - default: 0.20 */
  recurrenceWeight: number;

  /** Recurrence detection threshold (cosine similarity) - default: 0.85 */
  recurrenceThreshold: number;

  /** Type-specific thresholds (optional) */
  thresholdsByType?: Partial<Record<MemoryType, number>>;
}
