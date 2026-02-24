/**
 * Scoring - Composite relevance scoring with exponential recency decay
 *
 * This module implements the R(m,q) composite scoring function that combines:
 * - Semantic similarity (cosine similarity)
 * - Recency (exponential decay with configurable half-life)
 * - Strength (memory importance, pinned = 1.0)
 * - Continuity (session-based boost)
 *
 * Formula: R(m,q) = w1×semantic + w2×recency + w3×strength + w4×continuity
 */

import type { ScoreBreakdown, ScoringConfig, ScoringWeights } from './types.js';

/**
 * Default scoring configuration
 * - Weights: semantic 0.40, recency 0.20, strength 0.25, continuity 0.15
 * - Half-life: 72 hours (3 days) for recency decay
 * - Floor threshold: 0.3 for relevance filtering
 * - Continuity window: 30 minutes for session tracking
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    semantic: 0.4,
    recency: 0.2,
    strength: 0.25,
    continuity: 0.15,
  },
  halfLifeHours: 72,
  floorThreshold: 0.3,
  continuityWindowMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * Scoring class for composite relevance scoring
 *
 * Combines multiple relevance signals into a single score using
 * configurable weights and exponential recency decay.
 */
export class Scoring {
  private config: ScoringConfig;

  /**
   * Create a new Scoring instance
   * @param config - Partial configuration (merged with defaults)
   */
  constructor(config?: Partial<ScoringConfig>) {
    // Deep-merge weights properly: preserve defaults for unspecified weights
    const defaultWeights: ScoringWeights = {
      semantic: 0.4,
      recency: 0.2,
      strength: 0.25,
      continuity: 0.15,
    };

    const mergedWeights = config?.weights
      ? { ...defaultWeights, ...config.weights }
      : defaultWeights;

    // Destructure config to exclude weights (already merged)
    const { weights: _ignoredWeights, ...restConfig } = config ?? {};

    this.config = {
      weights: mergedWeights,
      halfLifeHours: 72,
      floorThreshold: 0.3,
      continuityWindowMs: 30 * 60 * 1000, // 30 minutes default
      ...restConfig,
    };
  }

  /**
   * Compute composite relevance score R(m,q)
   *
   * Combines semantic similarity, recency decay, strength, and continuity
   * into a single weighted score.
   *
   * @param similarity - Cosine similarity (0-1) between query and memory
   * @param memory - Memory metadata (supports both MemoryInternal and cached metadata)
   * @param now - Current timestamp in milliseconds
   * @param sessionMemoryIds - Set of memory IDs in current session for continuity boost
   * @returns ScoreBreakdown with individual components and total score
   */
  computeScore(
    similarity: number,
    memory: {
      id: string;
      lastAccessedAt: number;
      pinned: boolean;
      currentStrength?: number;
      strength?: number; // For cached metadata
    },
    now: number,
    sessionMemoryIds: Set<string>,
  ): ScoreBreakdown {
    const weights = this.config.weights;

    // Semantic: already computed as similarity (0-1)
    const semantic = similarity;

    // Recency: exponential decay with configurable half-life
    // Formula: exp(-ln(2) * ageHours / halfLifeHours)
    const ageHours = (now - memory.lastAccessedAt) / 3600000;
    const recency = Math.exp(
      (-Math.log(2) * ageHours) / this.config.halfLifeHours,
    );

    // Strength: treat pinned as strength component = 1.0, weights unchanged
    // This implements the "weight override" decision: pinned memories get max strength score
    const strength = memory.pinned
      ? 1.0
      : (memory.currentStrength ?? memory.strength ?? 0);

    // Continuity: boost if in session memory set
    // Note: continuityWindowMs config is available but session tracking uses explicit Set
    // Implement timestamp-based continuity if needed in Phase 6+
    const continuity = sessionMemoryIds.has(memory.id) ? 1.0 : 0.0;

    // Weighted sum
    const total =
      weights.semantic * semantic +
      weights.recency * recency +
      weights.strength * strength +
      weights.continuity * continuity;

    return { semantic, recency, strength, continuity, total };
  }

  /**
   * Check if a score meets the floor threshold
   * @param score - Composite score to check
   * @returns true if score > floorThreshold
   */
  meetsThreshold(score: number): boolean {
    return score > this.config.floorThreshold;
  }

  /**
   * Get current configuration (defensive copy)
   * @returns Current ScoringConfig
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }
}
