/**
 * Search types and interfaces for LokulMem
 *
 * These types define the search API including:
 * - Search results with composite scoring
 * - Search options and configuration
 * - Scoring weights and breakdown
 */

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
