/**
 * Search types and interfaces for LokulMem
 *
 * These types define the search API including:
 * - Search results with composite scoring
 * - Search options and configuration
 * - Scoring weights and breakdown
 * - Query filters and pagination
 */

import type { MemoryStatus, MemoryType } from '../types/memory.js';

/**
 * SearchResult - A single search result with similarity and composite score
 */
export interface SearchResult {
  /** Memory ID (excludes embedding for IPC compatibility) */
  memoryId: string;

  /** Cosine similarity (0-1) between query and memory embedding */
  similarity: number;

  /** Composite R(m,q) score combining semantic, recency, strength, continuity */
  score: number;

  /** Optional breakdown of individual score components (for debugging) */
  breakdown?: ScoreBreakdown;
}

/**
 * SearchOptions - Configuration for semantic search operations
 */
export interface SearchOptions {
  /** Maximum number of results to return (default: 50) */
  k?: number;

  /** Whether to use composite scoring vs cosine similarity only (default: true) */
  useCompositeScoring?: boolean;

  /** Minimum score threshold for relevance (default: 0.3) */
  floorThreshold?: number;

  /** Set of memory IDs in current session for continuity scoring */
  sessionMemoryIds?: Set<string>;
}

/**
 * ScoringWeights - Individual weights for composite scoring components
 * All weights should be positive and typically sum to 1.0
 */
export interface ScoringWeights {
  /** Semantic similarity weight (default: 0.40) */
  semantic: number;

  /** Recency decay weight (default: 0.20) */
  recency: number;

  /** Memory strength/importance weight (default: 0.25) */
  strength: number;

  /** Continuity/session context weight (default: 0.15) */
  continuity: number;
}

/**
 * ScoringConfig - Complete configuration for composite scoring
 */
export interface ScoringConfig {
  /** Individual component weights */
  weights: ScoringWeights;

  /** Half-life in hours for exponential recency decay (default: 72) */
  halfLifeHours: number;

  /** Floor threshold for relevance filtering (default: 0.3) */
  floorThreshold: number;

  /** Session window in milliseconds for continuity boost (default: 30 minutes) */
  continuityWindowMs: number;
}

/**
 * ScoreBreakdown - Individual components of composite score
 * Useful for debugging and understanding why memories ranked as they did
 */
export interface ScoreBreakdown {
  /** Semantic similarity component (0-1) */
  semantic: number;

  /** Recency decay component (0-1, exponential decay) */
  recency: number;

  /** Strength component (0-1, 1.0 for pinned memories) */
  strength: number;

  /** Continuity component (0-1, 1.0 if in session) */
  continuity: number;

  /** Total weighted score (sum of weighted components) */
  total: number;
}

/**
 * QueryFilter - Filter criteria for memory queries
 */
export interface QueryFilter {
  /** Filter by memory types (matches any if multiple) */
  types?: MemoryType[];

  /** Filter by memory status */
  status?: MemoryStatus;

  /** Minimum current strength (inclusive) */
  minStrength?: number;

  /** Maximum current strength (inclusive) */
  maxStrength?: number;

  /** Filter by pinned status */
  pinned?: boolean;

  /** Filter by cluster ID */
  clusterId?: string;
}

/**
 * QueryOptions - Options for listing and querying memories
 */
export interface QueryOptions {
  /** Filter criteria */
  filter?: QueryFilter;

  /** Sort order: recent (lastAccessedAt), strength, or created */
  sort?: 'recent' | 'strength' | 'created';

  /** Number of items to skip (for pagination) */
  offset?: number;

  /** Maximum number of items to return (default: 50) */
  limit?: number;

  /** Include embedding in results (internal use only) */
  includeEmbedding?: boolean;
}

/**
 * PaginatedResult - Paginated query result with metadata
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
 * FullTextSearchOptions - Options for full-text search
 */
export interface FullTextSearchOptions extends QueryOptions {
  /** Search mode: exact match, all terms (and), or any term (or) */
  mode?: 'exact' | 'and' | 'or';

  /** Whether to use case-sensitive search (default: false) */
  caseSensitive?: boolean;
}

/**
 * SemanticSearchOptions - Options for semantic vector search
 */
export interface SemanticSearchOptions {
  /** Maximum number of results to return (default: 50) */
  k?: number;

  /** Whether to use composite scoring vs semantic-only (default: false per CONTEXT.md) */
  useCompositeScoring?: boolean;

  /** Search mode: active-cache (in-memory), database (IndexedDB), all (both) */
  searchMode?: 'active-cache' | 'database' | 'all';

  /** Include embedding in results (internal use only) */
  includeEmbedding?: boolean;
}

/**
 * TimelineGroup - Memories grouped by date
 */
export interface TimelineGroup {
  /** ISO date string (YYYY-MM-DD) */
  date: string;

  /** Memories for this date */
  memories: import('../types/memory.js').MemoryDTO[];
}

/**
 * TypeGroup - Memories grouped by type
 */
export interface TypeGroup {
  /** Memory type */
  type: MemoryType;

  /** Memories for this type */
  memories: import('../types/memory.js').MemoryDTO[];
}

/**
 * ChatMessage - Message for token estimation
 */
export interface ChatMessage {
  /** Message role: 'system', 'user', 'assistant', etc. */
  role: string;

  /** Message content */
  content: string;
}

/**
 * TokenBudgetConfig - Configuration for token budget calculation
 */
export interface TokenBudgetConfig {
  /** LLM context window size in tokens (optional, no default) */
  contextWindowTokens?: number;

  /** Tokens to reserve for response (default: 1024) */
  reservedForResponseTokens?: number;

  /** Token overhead per message (default: 4) */
  tokenOverheadPerMessage?: number;

  /** Custom token counter (optional) */
  tokenCounter?: (text: string) => number;

  /** System prompt tokens override (deprecated: use messages array) */
  systemPromptTokens?: number;
}

/**
 * TokenBudgetResult - Result of token budget calculation
 */
export interface TokenBudgetResult {
  /** Total tokens available for memory injection */
  availableTokens: number;

  /** Total tokens used by messages (with overhead) */
  usedTokens: number;

  /** Remaining tokens after reserving for response */
  remainingTokens: number;
}
