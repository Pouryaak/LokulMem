/**
 * EmbeddingEngine - Handles embedding computation with Transformers.js
 *
 * This module manages:
 * - ONNX Runtime WASM path configuration
 * - Model loading (CDN or airgapped)
 * - Embedding computation with LRU caching
 * - Promise queue for concurrency control
 */

import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { env, pipeline } from '@huggingface/transformers';
import type { ModelConfig } from '../core/Protocol.js';
import { type CacheStats, LRUCache, PromiseQueue } from './LRUCache.js';

/**
 * Configuration for the embedding engine
 */
export interface EmbeddingConfig {
  /** Model name (e.g., 'Xenova/all-MiniLM-L6-v2') */
  modelName: string;
  /** Base URL for local model files (airgap mode) */
  localModelBaseUrl?: string | undefined;
  /** Embedding dimensions (default: 384 for MiniLM-L6-v2) */
  embeddingDims: number;
  /** Custom ONNX Runtime WASM paths */
  onnxPaths?: string | Record<string, string> | undefined;
  /** Cache size for LRU embedding cache */
  cacheSize?: number | undefined;
  /** Enable embedding cache */
  enableCache?: boolean | undefined;
}

/**
 * Model loading error with recovery hints
 */
export class ModelLoadError extends Error {
  constructor(
    message: string,
    public readonly recoveryHint: string,
  ) {
    super(message);
    this.name = 'ModelLoadError';
  }
}

/**
 * Dimension mismatch error for unexpected embedding dimensions
 */
export class DimensionMismatchError extends Error {
  constructor(expected: number, actual: number) {
    super(`Expected embedding dimensions ${expected}, got ${actual}`);
    this.name = 'DimensionMismatchError';
  }
}

/**
 * Type for pipeline result data
 */
interface PipelineResult {
  data: number[] | Float32Array;
}

/**
 * Progress info from Transformers.js
 */
interface ProgressInfo {
  status: string;
  progress?: number;
  file?: string;
  loaded?: number;
  total?: number;
}

/**
 * EmbeddingEngine singleton for managing embedding computation
 */
export class EmbeddingEngine {
  private static instance: EmbeddingEngine | null = null;
  private config: EmbeddingConfig | null = null;
  private isInitialized = false;
  private featurePipeline: FeatureExtractionPipeline | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private embeddingDims = 384;
  private cache: LRUCache | null = null;
  private queue: PromiseQueue;
  private cacheEnabled = true;

  /**
   * Get the singleton instance
   */
  static getInstance(): EmbeddingEngine {
    if (!EmbeddingEngine.instance) {
      EmbeddingEngine.instance = new EmbeddingEngine();
    }
    return EmbeddingEngine.instance;
  }

  private constructor() {
    this.queue = new PromiseQueue();
  }

  /**
   * Initialize the embedding engine with configuration
   *
   * @param config - Model configuration from InitPayload
   * @param onProgress - Progress callback for model loading stages
   */
  async initialize(
    config?: ModelConfig,
    onProgress?: (stage: string, progress: number) => void,
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Build embedding config from ModelConfig
    this.config = this.buildConfig(config);
    this.modelName = this.config.modelName;
    this.embeddingDims = this.config.embeddingDims;

    // Create LRU cache with configurable size and dims
    const cacheSize = this.config.cacheSize ?? 1000;
    this.cache = new LRUCache(cacheSize, this.embeddingDims);
    this.cacheEnabled = this.config.enableCache ?? true;

    // Configure ONNX WASM paths if explicitly provided
    if (config?.onnxPaths) {
      // @ts-expect-error - ONNX env typing is internal
      env.backends.onnx.wasm.wasmPaths = config.onnxPaths;
    }

    // Configure model loading mode (airgap vs CDN)
    if (this.config.localModelBaseUrl) {
      // Airgap mode: local models only, no network calls
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      // Ensure localModelBaseUrl ends with proper path separator
      const baseUrl = this.config.localModelBaseUrl.endsWith('/')
        ? this.config.localModelBaseUrl
        : `${this.config.localModelBaseUrl}/`;
      env.localModelPath = baseUrl;
    } else {
      // CDN mode: remote models with Cache API persistence
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.useBrowserCache = true; // Explicitly enable Cache API
    }

    try {
      // Load the model with progress reporting
      // Progress stages: "Downloading tokenizer" (0-30%), "Loading model weights" (30-80%), "Compiling WASM" (80-100%)
      const progressCallback = (progressInfo: ProgressInfo) => {
        if (onProgress) {
          let stageProgress = 0;
          const progress = progressInfo.progress ?? 0;
          if (progressInfo.status === 'download') {
            // Tokenizer/model download: 0-80%
            stageProgress = Math.round(progress * 0.8);
          } else if (progressInfo.status === 'init') {
            // WASM compilation: 80-100%
            stageProgress = 80 + Math.round(progress * 0.2);
          } else if (progressInfo.status === 'ready') {
            stageProgress = 100;
          }
          onProgress(progressInfo.status, stageProgress);
        }
      };

      // Use type assertion to handle complex pipeline types
      this.featurePipeline = await (
        pipeline as unknown as (
          task: string,
          model: string,
          options: {
            dtype: string;
            progress_callback: (info: ProgressInfo) => void;
          },
        ) => Promise<FeatureExtractionPipeline>
      )('feature-extraction', this.modelName, {
        dtype: 'q8', // Use q8 quantization (new API, not quantized: true)
        progress_callback: progressCallback,
      });

      this.isInitialized = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const recoveryHint = this.config.localModelBaseUrl
        ? 'Check localModelBaseUrl path and ensure model files exist with proper HuggingFace structure'
        : 'Check network connectivity and CDN availability';
      throw new ModelLoadError(
        `Failed to load model: ${errorMessage}`,
        recoveryHint,
      );
    }
  }

  /**
   * Generate embedding for a single text
   *
   * Uses LRU cache for deduplication and PromiseQueue to prevent
   * concurrent embedding calls.
   *
   * @param text - Text to embed
   * @returns Float32Array of embedding dimensions
   * @throws Error if not initialized
   * @throws DimensionMismatchError if embedding dimensions don't match config
   */
  async embed(text: string): Promise<Float32Array> {
    if (!this.isInitialized || !this.featurePipeline) {
      throw new Error(
        'EmbeddingEngine not initialized. Call initialize() first.',
      );
    }

    // Check cache first (outside queue for speed)
    if (this.cacheEnabled && this.cache) {
      const cached = this.cache.get(text);
      if (cached) return cached;
    }

    // Use queue to prevent concurrent calls
    return this.queue.add(async () => {
      // Double-check cache after queue (another call may have populated it)
      if (this.cacheEnabled && this.cache) {
        const cached = this.cache.get(text);
        if (cached) return cached;
      }

      // Compute embedding - direct pipeline call
      // featurePipeline is checked above, safe to use
      const pipeline = this.featurePipeline;
      if (!pipeline) {
        throw new Error(
          'EmbeddingEngine not initialized. Call initialize() first.',
        );
      }
      const result = (await pipeline(text, {
        pooling: 'mean',
        normalize: true,
      })) as PipelineResult;

      // Extract the embedding data
      const embeddingData = result.data;
      const embedding =
        embeddingData instanceof Float32Array
          ? embeddingData
          : new Float32Array(embeddingData);

      // Validate dimensions
      if (embedding.length !== this.embeddingDims) {
        throw new DimensionMismatchError(this.embeddingDims, embedding.length);
      }

      // Store in cache
      if (this.cacheEnabled && this.cache) {
        this.cache.set(text, embedding);
      }

      return embedding;
    });
  }

  /**
   * Generate embeddings for multiple texts in batches
   *
   * Uses cache to avoid redundant computation and internally chunks
   * into batches of 32 items max for memory efficiency.
   *
   * @param texts - Array of texts to embed
   * @returns Array of Float32Array embeddings in original order
   * @throws Error if not initialized
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.isInitialized || !this.featurePipeline) {
      throw new Error(
        'EmbeddingEngine not initialized. Call initialize() first.',
      );
    }

    return this.queue.add(async () => {
      const results: Float32Array[] = new Array(texts.length);
      const cacheMisses: { text: string; index: number }[] = [];

      // Check cache for each text
      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        if (!text) continue;
        if (this.cacheEnabled && this.cache) {
          const cached = this.cache.get(text);
          if (cached) {
            results[i] = cached;
            continue;
          }
        }
        cacheMisses.push({ text, index: i });
      }

      // If all cached, return immediately
      if (cacheMisses.length === 0) {
        return results;
      }

      // Process cache misses in chunks of 32
      const MAX_BATCH_SIZE = 32;
      // featurePipeline is checked above, safe to use
      const pipeline = this.featurePipeline;
      if (!pipeline) {
        throw new Error(
          'EmbeddingEngine not initialized. Call initialize() first.',
        );
      }
      for (let i = 0; i < cacheMisses.length; i += MAX_BATCH_SIZE) {
        const chunk = cacheMisses.slice(i, i + MAX_BATCH_SIZE);
        const chunkTexts = chunk.map((item) => item.text);

        // Compute embeddings for this chunk
        const batchResult = (await pipeline(chunkTexts, {
          pooling: 'mean',
          normalize: true,
        })) as PipelineResult | PipelineResult[];

        // Extract embeddings from batch result
        let embeddings: Float32Array[];
        if (Array.isArray(batchResult)) {
          embeddings = batchResult.map((r: PipelineResult) => {
            const data = r.data;
            return data instanceof Float32Array ? data : new Float32Array(data);
          });
        } else {
          const data = batchResult.data;
          embeddings = [
            data instanceof Float32Array ? data : new Float32Array(data),
          ];
        }

        // Validate dimensions and store results
        for (let j = 0; j < chunk.length; j++) {
          const chunkItem = chunk[j];
          const embedding = embeddings[j];
          if (!chunkItem || !embedding) continue;
          if (embedding.length !== this.embeddingDims) {
            throw new DimensionMismatchError(
              this.embeddingDims,
              embedding.length,
            );
          }

          results[chunkItem.index] = embedding;

          // Store in cache
          if (this.cacheEnabled && this.cache) {
            this.cache.set(chunkItem.text, embedding);
          }
        }
      }

      return results;
    });
  }

  /**
   * Get cache statistics for debugging
   *
   * @returns CacheStats with hit rate, memory usage, etc.
   * @throws Error if cache is not enabled or initialized
   */
  getCacheStats(): CacheStats {
    if (!this.cache) {
      throw new Error('Cache not initialized');
    }
    if (!this.cacheEnabled) {
      throw new Error('Cache is disabled');
    }

    const stats = this.cache.getStats();

    // Log memory warnings per CONTEXT.md
    const MB = 1024 * 1024;
    if (stats.estimatedMemoryBytes > 50 * MB) {
      console.warn(
        `[LokulMem] CRITICAL: Embedding cache using ${(stats.estimatedMemoryBytes / MB).toFixed(1)}MB. Consider reducing cache size.`,
      );
    } else if (stats.estimatedMemoryBytes > 10 * MB) {
      console.warn(
        `[LokulMem] WARNING: Embedding cache using ${(stats.estimatedMemoryBytes / MB).toFixed(1)}MB.`,
      );
    }

    return stats;
  }

  /**
   * Get current model metadata
   *
   * @returns Object with modelName, embeddingDims, and initialized status
   */
  getModelInfo(): {
    modelName: string;
    embeddingDims: number;
    initialized: boolean;
  } {
    return {
      modelName: this.modelName,
      embeddingDims: this.embeddingDims,
      initialized: this.isInitialized,
    };
  }

  /**
   * Check if the engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingConfig | null {
    return this.config;
  }

  /**
   * Reset the engine (for testing)
   */
  reset(): void {
    this.config = null;
    this.isInitialized = false;
    this.featurePipeline = null;
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
    this.embeddingDims = 384;
    this.cache = null;
    this.cacheEnabled = true;
    EmbeddingEngine.instance = null;
  }

  /**
   * Build EmbeddingConfig from ModelConfig
   */
  private buildConfig(modelConfig?: ModelConfig): EmbeddingConfig {
    return {
      modelName: modelConfig?.modelName ?? 'Xenova/all-MiniLM-L6-v2',
      localModelBaseUrl: modelConfig?.localModelBaseUrl,
      embeddingDims: modelConfig?.embeddingDims ?? 384,
      onnxPaths: modelConfig?.onnxPaths,
      cacheSize: modelConfig?.cacheSize ?? 1000,
      enableCache: modelConfig?.enableCache ?? true,
    };
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getEmbeddingEngine(): EmbeddingEngine {
  return EmbeddingEngine.getInstance();
}

// Re-export types for convenience
export type { CacheStats };
