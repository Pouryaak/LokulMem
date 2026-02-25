/**
 * LokulMem - Main class for browser-native LLM memory management
 *
 * This is the primary entry point that users interact with.
 * It orchestrates worker initialization, progress reporting, and provides
 * the base for augment/learn/manage APIs in later phases.
 *
 * WORKER URL RESOLUTION:
 * The worker URL is resolved using `new URL('./worker.mjs', import.meta.url).href`
 * which points to the built worker file at `dist/worker.mjs` (relative to `dist/main.mjs`).
 *
 * IMPORTANT: Do NOT use `?worker&url` import syntax. That is designed for inline
 * workers in Vite applications, not for library builds with separate worker entry
 * points in `build.lib.worker`. See Phase 4 final summary for details.
 */

import type { InitStage, LokulMemConfig } from '../types/api.js';
import type { MemoryDTO } from '../types/memory.js';
import type { WorkerClient } from './MessagePort.js';
import type { ModelConfig } from './Protocol.js';
import { MessageType as MessageTypeConst } from './Protocol.js';
import { WorkerManager } from './WorkerManager.js';
import type { PersistenceStatus } from './types.js';
import type { WorkerType } from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: {
  dbName: string;
  workerType: 'auto' | 'shared' | 'dedicated' | 'main';
  initTimeoutMs: number;
  maxRetries: number;
  extractionThreshold: number;
  localModelBaseUrl?: string;
  workerUrl?: string;
  onnxPaths?: string | Record<string, string>;
  onProgress?: (stage: InitStage, progress: number) => void;
} = {
  dbName: 'lokulmem-default',
  workerType: 'auto',
  initTimeoutMs: 10000,
  maxRetries: 1, // Per Phase 2 decisions: default 1 retry per mode
  extractionThreshold: 0.5,
};

/**
 * Main LokulMem class for memory management
 *
 * Usage:
 * ```typescript
 * const lokul = await createLokulMem({
 *   dbName: 'my-app',
 *   onProgress: (stage, progress) => console.log(stage, progress)
 * });
 * ```
 */
export class LokulMem {
  private workerManager: WorkerManager;
  private config: {
    dbName: string;
    workerType: 'auto' | 'shared' | 'dedicated' | 'main';
    initTimeoutMs: number;
    maxRetries: number;
    extractionThreshold: number;
    localModelBaseUrl?: string;
    workerUrl?: string;
    onnxPaths?: string | Record<string, string>;
    onProgress?: (stage: InitStage, progress: number) => void;
    // Token budget config (main thread only, NOT sent to worker)
    contextWindowTokens?: number;
    reservedForResponseTokens?: number;
    tokenOverheadPerMessage?: number;
    tokenCounter?: (text: string) => number;
    // Lifecycle config (sent to worker during init)
    lambdaByCategory?: Partial<
      Record<import('../types/memory.js').MemoryType, number>
    >;
    pinnedLambda?: number;
    fadedThreshold?: number;
    reinforcementByCategory?: Partial<
      Record<import('../types/memory.js').MemoryType, number>
    >;
    maxBaseStrength?: number;
    reinforcementDebounceMs?: number;
    maintenanceIntervalMs?: number;
    kMeansK?: number;
    kMeansMaxIterations?: number;
    kMeansConvergenceThreshold?: number;
  };
  private isInitialized = false;

  // Lifecycle event handlers
  private fadedHandlers: Array<(memory: MemoryDTO) => void> = [];
  private deletedHandlers: Array<(memoryId: string) => void> = [];
  private lifecycleUnsubscribers: Array<() => void> = [];

  /**
   * Creates a new LokulMem instance
   * @param config - Configuration options
   */
  constructor(config: LokulMemConfig = {}) {
    // Create WorkerManager instance first
    this.workerManager = new WorkerManager();

    // Merge with defaults - handle optional properties carefully for exactOptionalPropertyTypes
    this.config = {
      dbName: config.dbName ?? DEFAULT_CONFIG.dbName,
      workerType: config.workerType ?? DEFAULT_CONFIG.workerType,
      initTimeoutMs: config.initTimeoutMs ?? DEFAULT_CONFIG.initTimeoutMs,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
      extractionThreshold:
        config.extractionThreshold ?? DEFAULT_CONFIG.extractionThreshold,
    };

    // Set optional properties only if defined
    if (config.localModelBaseUrl !== undefined) {
      this.config.localModelBaseUrl = config.localModelBaseUrl;
    }
    if (config.workerUrl !== undefined) {
      this.config.workerUrl = config.workerUrl;
    }
    if (config.onProgress !== undefined) {
      this.config.onProgress = config.onProgress;
    }
    if (config.onnxPaths !== undefined) {
      this.config.onnxPaths = config.onnxPaths;
    }

    // NEW: Store token budget config (main thread only, NOT sent to worker)
    if (config.contextWindowTokens !== undefined) {
      this.config.contextWindowTokens = config.contextWindowTokens;
    }
    if (config.reservedForResponseTokens !== undefined) {
      this.config.reservedForResponseTokens = config.reservedForResponseTokens;
    }
    if (config.tokenOverheadPerMessage !== undefined) {
      this.config.tokenOverheadPerMessage = config.tokenOverheadPerMessage;
    }
    if (config.tokenCounter !== undefined) {
      this.config.tokenCounter = config.tokenCounter;
    }

    // Store lifecycle config (sent to worker during init)
    if (config.lambdaByCategory !== undefined) {
      this.config.lambdaByCategory = config.lambdaByCategory;
    }
    if (config.pinnedLambda !== undefined) {
      this.config.pinnedLambda = config.pinnedLambda;
    }
    if (config.fadedThreshold !== undefined) {
      this.config.fadedThreshold = config.fadedThreshold;
    }
    if (config.reinforcementByCategory !== undefined) {
      this.config.reinforcementByCategory = config.reinforcementByCategory;
    }
    if (config.maxBaseStrength !== undefined) {
      this.config.maxBaseStrength = config.maxBaseStrength;
    }
    if (config.reinforcementDebounceMs !== undefined) {
      this.config.reinforcementDebounceMs = config.reinforcementDebounceMs;
    }
    if (config.maintenanceIntervalMs !== undefined) {
      this.config.maintenanceIntervalMs = config.maintenanceIntervalMs;
    }
    if (config.kMeansK !== undefined) {
      this.config.kMeansK = config.kMeansK;
    }
    if (config.kMeansMaxIterations !== undefined) {
      this.config.kMeansMaxIterations = config.kMeansMaxIterations;
    }
    if (config.kMeansConvergenceThreshold !== undefined) {
      this.config.kMeansConvergenceThreshold =
        config.kMeansConvergenceThreshold;
    }
  }

  /**
   * Build ModelConfig from LokulMemConfig options
   * Only includes properties that are explicitly set
   */
  private buildModelConfig(): ModelConfig | undefined {
    const config: ModelConfig = {};

    if (this.config.localModelBaseUrl !== undefined) {
      config.localModelBaseUrl = this.config.localModelBaseUrl;
    }

    if (this.config.onnxPaths !== undefined) {
      config.onnxPaths = this.config.onnxPaths;
    }

    // Only return config if at least one property was set
    return Object.keys(config).length > 0 ? config : undefined;
  }

  /**
   * Build LifecycleConfig from LokulMemConfig options
   * Only includes properties that are explicitly set
   */
  private buildLifecycleConfig():
    | import('../lifecycle/types.js').LifecycleConfig
    | undefined {
    const config: import('../lifecycle/types.js').LifecycleConfig = {};

    if (this.config.lambdaByCategory !== undefined) {
      config.lambdaByCategory = this.config.lambdaByCategory;
    }

    if (this.config.pinnedLambda !== undefined) {
      config.pinnedLambda = this.config.pinnedLambda;
    }

    if (this.config.fadedThreshold !== undefined) {
      config.fadedThreshold = this.config.fadedThreshold;
    }

    if (this.config.reinforcementByCategory !== undefined) {
      config.reinforcementByCategory = this.config.reinforcementByCategory;
    }

    if (this.config.maxBaseStrength !== undefined) {
      config.maxBaseStrength = this.config.maxBaseStrength;
    }

    if (this.config.reinforcementDebounceMs !== undefined) {
      config.reinforcementDebounceMs = this.config.reinforcementDebounceMs;
    }

    if (this.config.maintenanceIntervalMs !== undefined) {
      config.maintenanceIntervalMs = this.config.maintenanceIntervalMs;
    }

    if (this.config.kMeansK !== undefined) {
      config.kMeansK = this.config.kMeansK;
    }

    if (this.config.kMeansMaxIterations !== undefined) {
      config.kMeansMaxIterations = this.config.kMeansMaxIterations;
    }

    if (this.config.kMeansConvergenceThreshold !== undefined) {
      config.kMeansConvergenceThreshold =
        this.config.kMeansConvergenceThreshold;
    }

    // Only return config if at least one property was set
    return Object.keys(config).length > 0 ? config : undefined;
  }

  /**
   * Set up lifecycle event listeners after worker initialization
   */
  private setupLifecycleEventListeners(): void {
    // Listen for MEMORY_FADED events
    const unfade = this.workerManager.on(
      MessageTypeConst.MEMORY_FADED,
      (payload: unknown) => {
        const memory = payload as MemoryDTO;
        // Notify all registered handlers
        for (const handler of this.fadedHandlers) {
          handler(memory);
        }
      },
    );
    this.lifecycleUnsubscribers.push(unfade);

    // Listen for MEMORY_DELETED events
    const undelete = this.workerManager.on(
      MessageTypeConst.MEMORY_DELETED,
      (payload: unknown) => {
        const data = payload as { memoryId: string };
        // Notify all registered handlers
        for (const handler of this.deletedHandlers) {
          handler(data.memoryId);
        }
      },
    );
    this.lifecycleUnsubscribers.push(undelete);
  }

  /**
   * Initialize the worker and wait for completion
   * Reports progress through the onProgress callback if provided in config
   *
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.workerManager.initialize(
        {
          workerType: this.config.workerType,
          workerUrl:
            this.config.workerUrl ??
            // Default worker URL - points to built worker file
            new URL('./worker.mjs', import.meta.url).href,
          initTimeoutMs: this.config.initTimeoutMs,
          maxRetries: this.config.maxRetries,
          dbName: this.config.dbName,
          modelConfig: this.buildModelConfig(),
          lifecycleConfig: this.buildLifecycleConfig(),
        },
        this.config.onProgress,
      );

      // Set up lifecycle event listeners after initialization
      this.setupLifecycleEventListeners();

      this.isInitialized = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`LokulMem initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Request storage persistence explicitly
   * Note: This is NOT auto-called during initialize() per Phase 2 decisions
   * The user decides when to call this based on their UX flow
   *
   * @returns Promise that resolves with persistence status
   */
  async persistStorage(): Promise<PersistenceStatus> {
    return this.workerManager.persistStorage();
  }

  /**
   * Get the current worker type
   * @returns 'shared' | 'dedicated' | 'main-thread'
   */
  getWorkerType(): WorkerType {
    return this.workerManager.getWorkerType();
  }

  /**
   * Get the current persistence status
   * @returns PersistenceStatus or null if not requested
   */
  getPersistenceStatus(): PersistenceStatus | null {
    return this.workerManager.getPersistenceStatus();
  }

  /**
   * Check if initialization is complete
   * @returns true if ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Terminate the worker and clean up resources
   */
  terminate(): void {
    this.workerManager.terminate();
    this.isInitialized = false;
    // Clear lifecycle event handlers
    this.fadedHandlers = [];
    this.deletedHandlers = [];
    // Unsubscribe from lifecycle events
    for (const unsubscribe of this.lifecycleUnsubscribers) {
      unsubscribe();
    }
    this.lifecycleUnsubscribers = [];
  }

  /**
   * Register a callback for memory faded events
   *
   * Fired when a memory's strength drops below the faded threshold.
   * The memory is marked as faded and will be deleted after 30 days.
   *
   * @param handler - Callback function that receives the faded memory
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = lokul.onMemoryFaded((memory) => {
   *   console.log('Memory faded:', memory.content);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  onMemoryFaded(handler: (memory: MemoryDTO) => void): () => void {
    this.fadedHandlers.push(handler);
    // Return unsubscribe function
    return () => {
      const index = this.fadedHandlers.indexOf(handler);
      if (index > -1) {
        this.fadedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Register a callback for memory deleted events
   *
   * Fired when a memory is permanently deleted from storage.
   * This happens 30 days after a memory is marked as faded.
   *
   * @param handler - Callback function that receives the deleted memory ID
   * @returns Unsubscribe function to remove the handler
   *
   * @example
   * ```typescript
   * const unsubscribe = lokul.onMemoryDeleted((memoryId) => {
   *   console.log('Memory deleted:', memoryId);
   * });
   *
   * // Later, to stop listening:
   * unsubscribe();
   * ```
   */
  onMemoryDeleted(handler: (memoryId: string) => void): () => void {
    this.deletedHandlers.push(handler);
    // Return unsubscribe function
    return () => {
      const index = this.deletedHandlers.indexOf(handler);
      if (index > -1) {
        this.deletedHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Get the worker client for making requests
   * Used internally for operations that need worker communication
   *
   * @returns WorkerClient or null if not initialized
   * @internal
   */
  getClient(): WorkerClient | null {
    return this.workerManager.getClient();
  }
}

/**
 * Factory function to create and initialize a LokulMem instance
 *
 * This is the recommended way to create a LokulMem instance as it
 * handles initialization automatically.
 *
 * @param config - Configuration options
 * @returns Promise that resolves with initialized LokulMem instance
 *
 * @example
 * ```typescript
 * const lokul = await createLokulMem({
 *   dbName: 'my-chat-app',
 *   onProgress: (stage, progress) => {
 *     console.log(`${stage}: ${progress}%`);
 *   }
 * });
 * ```
 */
export async function createLokulMem(
  config?: LokulMemConfig,
): Promise<LokulMem> {
  const lokul = new LokulMem(config);
  await lokul.initialize();
  return lokul;
}
