/**
 * Lifecycle types for memory decay and reinforcement
 *
 * These types define the configuration and results for:
 * - Ebbinghaus decay calculation with per-category lambda values
 * - Reinforcement tracking with debounced writes
 * - Memory lifecycle management
 * - Maintenance sweep and event emission
 */

import type { MemoryDTO, MemoryType } from '../types/memory.js';

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

// ============================================================================
// Maintenance Configuration
// ============================================================================

/**
 * MaintenanceConfig - Configuration for maintenance sweep operations
 *
 * Controls how often and how maintenance sweeps are performed
 */
export interface MaintenanceConfig {
  /**
   * Interval between periodic maintenance sweeps (milliseconds)
   * Default: 3600000 (1 hour)
   */
  sweepIntervalMs: number;

  /**
   * Optional progress callback for maintenance operations
   * Called with stage name and progress percentage (0-100)
   */
  onProgress?: (stage: string, progress: number) => void;
}

/**
 * SweepResult - Result of a maintenance sweep operation
 *
 * Tracks the effects of a single maintenance sweep
 */
export interface SweepResult {
  /** Number of memories whose strength was decayed */
  decayedCount: number;

  /** Number of memories marked as faded */
  fadedCount: number;

  /** Number of old faded memories permanently deleted */
  deletedCount: number;
}

/**
 * LifecycleStats - Statistics about memory lifecycle system
 *
 * Provides visibility into the state of the lifecycle system
 */
export interface LifecycleStats {
  /** Total number of memories in the system */
  totalMemories: number;

  /** Number of active (non-faded) memories */
  activeMemories: number;

  /** Number of faded memories */
  fadedMemories: number;

  /** Timestamp of the last maintenance sweep */
  lastSweepTime: number;

  /** Timestamp of the next scheduled sweep (null if not scheduled) */
  nextSweepTime: number | null;

  /** Number of pending reinforcements waiting to be flushed */
  pendingReinforcements: number;
}

/**
 * LifecycleEventHandlers - Event handler callbacks for lifecycle events
 *
 * Defines the signature for lifecycle event callbacks
 */
export interface LifecycleEventHandlers {
  /** Called when a memory fades below threshold */
  onMemoryFaded?: (memory: MemoryDTO) => void;

  /** Called when a memory is permanently deleted */
  onMemoryDeleted?: (memoryId: string) => void;
}

// ============================================================================
// Unified Lifecycle Configuration
// ============================================================================

/**
 * LifecycleConfig - Unified configuration for memory lifecycle
 *
 * Combines decay, reinforcement, and maintenance configuration into a single interface
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

  // Maintenance configuration
  /** Interval between periodic maintenance sweeps (ms) */
  maintenanceIntervalMs: number;

  /** Optional progress callback for maintenance operations */
  onProgress?: (stage: string, progress: number) => void;

  // K-means clustering configuration
  /** Number of clusters for K-means (auto-calculated if not specified) */
  kMeansK?: number;
  /** Maximum iterations for K-means algorithm */
  kMeansMaxIterations: number;
  /** Convergence threshold for K-means algorithm */
  kMeansConvergenceThreshold: number;
}

// ============================================================================
// K-means Clustering Configuration
// ============================================================================

/**
 * KMeansConfig - Configuration for K-means clustering algorithm
 *
 * Controls how memories are organized into semantic clusters
 */
export interface KMeansConfig {
  /**
   * Number of clusters (k)
   * If not specified, auto-calculated as max(2, floor(sqrt(n/2)))
   */
  k?: number;

  /**
   * Maximum number of iterations for Lloyd's algorithm
   * Default: 100
   */
  maxIterations: number;

  /**
   * Convergence threshold for centroid movement
   * Algorithm stops when all centroids shift less than this amount
   * Default: 0.001
   */
  convergenceThreshold: number;
}

/**
 * ClusterResult - Result of K-means clustering operation
 *
 * Contains the clustering results including memory-to-cluster assignments
 * and final centroid positions
 */
export interface ClusterResult {
  /** Map of memory ID to cluster ID (e.g., 'cluster-0', 'cluster-1') */
  clusters: Map<string, string>;

  /** Map of cluster ID to centroid vector */
  centroids: Map<string, Float32Array>;

  /** Number of iterations performed */
  iterations: number;

  /** Whether algorithm converged before hitting max iterations */
  converged: boolean;
}
