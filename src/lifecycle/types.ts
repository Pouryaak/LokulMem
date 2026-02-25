/**
 * Lifecycle types for memory decay and reinforcement
 *
 * These types define the configuration and results for:
 * - Ebbinghaus decay calculation with per-category lambda values
 * - Reinforcement tracking with debounced writes
 * - Memory lifecycle management
 */

import type { MemoryType } from '../types/memory.js';

// ============================================================================
// Decay Configuration
// ============================================================================

/**
 * DecayConfig - Configuration for Ebbinghaus decay calculation
 *
 * Lambda values control decay rate for each memory type:
 * - Lower lambda = slower decay (longer retention)
 * - Higher lambda = faster decay (shorter retention)
 * - Lambda = 0 means no decay (pinned memories)
 */
export interface DecayConfig {
  /**
   * Per-category lambda values (decay constants)
   * Defaults:
   * - identity: 0.0001 (very slow decay)
   * - location: 0.0005
   * - profession: 0.0003
   * - preference: 0.001
   * - project: 0.005
   * - temporal: 0.02 (fast decay - time-based memories fade quickly)
   * - relational: 0.0004
   * - emotional: 0.01
   */
  lambdaByCategory: Partial<Record<MemoryType, number>>;

  /**
   * Lambda value for pinned memories (always 0)
   * Pinned memories never decay
   */
  pinnedLambda: number;

  /**
   * Threshold below which a memory is considered "faded"
   * Default: 0.1
   * Memories with currentStrength < fadedThreshold are marked as faded
   */
  fadedThreshold: number;
}

/**
 * DecayResult - Result of decay calculation for a single memory
 */
export interface DecayResult {
  /** Memory ID */
  memoryId: string;

  /** Strength before decay calculation */
  oldStrength: number;

  /** Strength after decay calculation */
  newStrength: number;

  /** Whether memory has faded below threshold */
  isFaded: boolean;
}

// ============================================================================
// Reinforcement Configuration
// ============================================================================

/**
 * ReinforcementConfig - Configuration for memory reinforcement on access
 *
 * Reinforcement strengthens memories when they are accessed, simulating
 * memory rehearsal in the Ebbinghaus forgetting curve.
 */
export interface ReinforcementConfig {
  /**
   * Per-category reinforcement amounts
   * When a memory is accessed, its baseStrength is increased by this amount
   * Default: 0.3 for most categories (configurable)
   */
  reinforcementByCategory: Partial<Record<MemoryType, number>>;

  /**
   * Maximum base strength (hard cap)
   * Memories stop reinforcing once they reach this level
   * Default: 3.0
   */
  maxBaseStrength: number;

  /**
   * Debounce window for batch writes (milliseconds)
   * Multiple reinforcements within this window are batched into a single DB write
   * Default: 5000 (5 seconds)
   */
  debounceWindowMs: number;
}

/**
 * ReinforcementTask - Pending reinforcement operation
 *
 * Represents a memory access that needs reinforcement update
 * Stored in a pending Map until debounced write executes
 */
export interface ReinforcementTask {
  /** Memory ID to reinforce */
  memoryId: string;

  /** Primary category for reinforcement amount lookup */
  category: MemoryType;

  /** When the access occurred (Unix ms) */
  timestamp: number;
}

// ============================================================================
// Unified Lifecycle Configuration
// ============================================================================

/**
 * LifecycleConfig - Unified configuration for memory lifecycle
 *
 * Combines decay and reinforcement configuration into a single interface
 * for convenient initialization and type safety.
 */
export interface LifecycleConfig {
  // Decay configuration
  /** Per-category lambda values for decay calculation */
  lambdaByCategory: Partial<Record<MemoryType, number>>;
  /** Lambda for pinned memories (should be 0) */
  pinnedLambda: number;
  /** Threshold for marking memories as faded */
  fadedThreshold: number;

  // Reinforcement configuration
  /** Per-category reinforcement amounts */
  reinforcementByCategory: Partial<Record<MemoryType, number>>;
  /** Maximum base strength (hard cap) */
  maxBaseStrength: number;
  /** Debounce window for reinforcement writes (ms) */
  reinforcementDebounceMs: number;
}
