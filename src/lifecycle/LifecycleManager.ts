/**
 * LifecycleManager - Main orchestrator for memory lifecycle management
 *
 * Combines all lifecycle components into a unified interface:
 * - DecayCalculator for strength computation
 * - ReinforcementTracker for access-based strengthening
 * - MaintenanceSweep for periodic maintenance
 * - LifecycleEventEmitter for event callbacks
 * - KMeansClusterer (added in next plan)
 *
 * Key features:
 * - Synchronous initialization with session-start sweep
 * - Automatic periodic sweeps at configured interval
 * - Event handler registration for lifecycle callbacks
 * - Stats aggregation for monitoring
 */

import type { MemoryRepository } from '../storage/MemoryRepository.js';
import type { VectorSearch } from '../search/VectorSearch.js';
import type { MemoryInternal } from '../internal/types.js';
import type {
  LifecycleConfig,
  LifecycleStats,
  LifecycleEventHandlers,
  DecayConfig,
  ReinforcementConfig,
  MaintenanceConfig,
} from './types.js';
import { DecayCalculator } from './DecayCalculator.js';
import { ReinforcementTracker } from './ReinforcementTracker.js';
import { MaintenanceSweep } from './MaintenanceSweep.js';
import { LifecycleEventEmitter } from './EventEmitter.js';

/**
 * LifecycleManager - Orchestrates all memory lifecycle operations
 *
 * Manages the complete lifecycle of memories from creation to deletion.
 * Coordinates decay calculation, reinforcement, maintenance, and events.
 */
export class LifecycleManager {
  private readonly repository: MemoryRepository;
  private readonly vectorSearch: VectorSearch;

  // Lifecycle components
  private readonly decayCalculator: DecayCalculator;
  private readonly reinforcementTracker: ReinforcementTracker;
  private readonly maintenanceSweep: MaintenanceSweep;
  private readonly eventEmitter: LifecycleEventEmitter;

  // K-means clusterer will be added in next plan (06-03)
  // private kMeansClusterer: KMeansClusterer | null = null;

  /** Timestamp of last maintenance sweep */
  private lastSweepTime = 0;

  /** Initialization flag */
  private isInitialized = false;

  /**
   * Create a new LifecycleManager instance
   * @param repository - MemoryRepository for data access
   * @param vectorSearch - VectorSearch for K-means clustering (future use)
   * @param config - LifecycleConfig for all components
   */
  constructor(
    repository: MemoryRepository,
    vectorSearch: VectorSearch,
    config: LifecycleConfig,
  ) {
    this.repository = repository;
    this.vectorSearch = vectorSearch;

    // Extract decay config
    const decayConfig: DecayConfig = {
      lambdaByCategory: config.lambdaByCategory,
      pinnedLambda: config.pinnedLambda,
      fadedThreshold: config.fadedThreshold,
    };

    // Extract reinforcement config
    const reinforcementConfig: ReinforcementConfig = {
      reinforcementByCategory: config.reinforcementByCategory,
      maxBaseStrength: config.maxBaseStrength,
      debounceWindowMs: config.reinforcementDebounceMs,
    };

    // Extract maintenance config
    const maintenanceConfig: MaintenanceConfig = {
      sweepIntervalMs: config.maintenanceIntervalMs,
      onProgress: config.onProgress,
    };

    // Initialize components
    this.decayCalculator = new DecayCalculator(decayConfig);
    this.reinforcementTracker = new ReinforcementTracker(
      reinforcementConfig,
      repository,
    );
    this.eventEmitter = new LifecycleEventEmitter();
    this.maintenanceSweep = new MaintenanceSweep(
      maintenanceConfig,
      this.decayCalculator,
      this.reinforcementTracker,
      repository,
      this.eventEmitter,
    );

    // K-means clusterer will be initialized in next plan (06-03)
    // this.kMeansClusterer = null;
  }

  /**
   * Initialize the lifecycle manager
   *
   * Runs a synchronous maintenance sweep at session start, then starts
   * periodic sweeps. K-means clustering will be added in next plan.
   *
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Return early if already initialized
    if (this.isInitialized) {
      console.log('LifecycleManager: Already initialized');
      return;
    }

    console.log('LifecycleManager: Starting initialization...');

    // Step 1: Run session-start maintenance sweep (synchronous, blocking)
    console.log('LifecycleManager: Running session-start maintenance sweep');
    const sweepResult = await this.maintenanceSweep.runSweep();
    console.log(
      `LifecycleManager: Sweep complete - decayed: ${sweepResult.decayedCount}, faded: ${sweepResult.fadedCount}, deleted: ${sweepResult.deletedCount}`,
    );

    // Step 2: K-means clustering will be added in next plan (06-03)
    // console.log('LifecycleManager: Running K-means clustering');
    // await this.runKMeansClustering();

    // Step 3: Start periodic sweeps
    this.maintenanceSweep.startPeriodicSweeps();

    // Update state
    this.lastSweepTime = Date.now();
    this.isInitialized = true;

    console.log('LifecycleManager: Initialization complete');
  }

  /**
   * Record a memory access for reinforcement
   * @param memory - Memory that was accessed
   *
   * Delegates to ReinforcementTracker to apply reinforcement
   * with debounced writes.
   */
  async recordAccess(memory: MemoryInternal): Promise<void> {
    if (!this.isInitialized) {
      console.warn(
        'LifecycleManager: recordAccess called before initialization',
      );
      return;
    }

    await this.reinforcementTracker.recordAccess(memory);
  }

  /**
   * Get lifecycle statistics
   * @returns Promise<LifecycleStats> with current system state
   *
   * Aggregates statistics from repository and components.
   */
  async getStats(): Promise<LifecycleStats> {
    // Parallel count queries
    const [totalCount, activeCount, fadedCount] = await Promise.all([
      this.repository.count(),
      this.repository.countByStatus('active'),
      this.repository.countByStatus('faded'),
    ]);

    // Calculate next sweep time (1 hour default if not configured)
    const sweepIntervalMs = 3600000; // Default 1 hour
    const nextSweepTime =
      this.lastSweepTime > 0 ? this.lastSweepTime + sweepIntervalMs : null;

    return {
      totalMemories: totalCount,
      activeMemories: activeCount,
      fadedMemories: fadedCount,
      lastSweepTime: this.lastSweepTime,
      nextSweepTime,
      pendingReinforcements: this.reinforcementTracker.getPendingCount(),
    };
  }

  /**
   * Register a handler for memory faded events
   * @param handler - Callback function to receive faded memory DTOs
   * @returns Unsubscribe function that removes the handler
   *
   * Delegates to LifecycleEventEmitter.
   */
  onMemoryFaded(handler: (memory: import('../types/memory.js').MemoryDTO) => void): () => void {
    return this.eventEmitter.onMemoryFaded(handler);
  }

  /**
   * Register a handler for memory deleted events
   * @param handler - Callback function to receive deleted memory IDs
   * @returns Unsubscribe function that removes the handler
   *
   * Delegates to LifecycleEventEmitter.
   */
  onMemoryDeleted(handler: (memoryId: string) => void): () => void {
    return this.eventEmitter.onMemoryDeleted(handler);
  }

  /**
   * Shutdown the lifecycle manager
   *
   * Stops periodic sweeps and flushes pending reinforcements.
   * Call this before shutting down the application.
   */
  async shutdown(): Promise<void> {
    console.log('LifecycleManager: Shutting down...');
    this.maintenanceSweep.stopPeriodicSweeps();
    await this.maintenanceSweep.shutdown();
    this.isInitialized = false;
    console.log('LifecycleManager: Shutdown complete');
  }

  /**
   * Calculate optimal K for K-means clustering
   * @returns Promise<number> with recommended K value
   *
   * Uses heuristic: max(2, floor(sqrt(n/2)))
   * K-means will be implemented in next plan (06-03).
   */
  private async calculateOptimalK(): Promise<number> {
    const count = await this.repository.count();
    return Math.max(2, Math.floor(Math.sqrt(count / 2)));
  }
}

/**
 * Re-export LifecycleConfig and LifecycleStats for convenience
 */
export type { LifecycleConfig, LifecycleStats, LifecycleEventHandlers };
