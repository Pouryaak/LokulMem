/**
 * LokulMem - Main class for browser-native LLM memory management
 *
 * This is the primary entry point that users interact with.
 * It orchestrates worker initialization, progress reporting, and provides
 * the base for augment/learn/manage APIs in later phases.
 */

import type { LokulMemConfig, PersistenceStatus } from '../types/api.js';
import type { WorkerClient } from './MessagePort.js';
import { WorkerManager } from './WorkerManager.js';
import type { WorkerType } from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<
  Omit<LokulMemConfig, 'localModelBaseUrl' | 'workerUrl' | 'onProgress'>
> & {
  workerType: 'auto' | 'shared' | 'dedicated' | 'main';
  initTimeoutMs: number;
  maxRetries: number;
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
  private config: Required<LokulMemConfig> & {
    workerType: 'auto' | 'shared' | 'dedicated' | 'main';
    initTimeoutMs: number;
    maxRetries: number;
  };
  private isInitialized = false;

  /**
   * Creates a new LokulMem instance
   * @param config - Configuration options
   */
  constructor(config: LokulMemConfig = {}) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      localModelBaseUrl: config.localModelBaseUrl,
      workerUrl: config.workerUrl,
      onProgress: config.onProgress,
    };

    // Create WorkerManager instance
    this.workerManager = new WorkerManager();
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
            // Default worker URL - will be resolved by bundler
            new URL('../worker/index.ts', import.meta.url).href,
          initTimeoutMs: this.config.initTimeoutMs,
          maxRetries: this.config.maxRetries,
          dbName: this.config.dbName,
          modelConfig: this.config.localModelBaseUrl
            ? { baseUrl: this.config.localModelBaseUrl }
            : undefined,
        },
        this.config.onProgress,
      );

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
