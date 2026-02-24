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
import type { WorkerClient } from './MessagePort.js';
import type { ModelConfig } from './Protocol.js';
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
  };
  private isInitialized = false;

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
