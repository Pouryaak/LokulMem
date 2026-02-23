/**
 * EmbeddingEngine - Handles embedding computation with Transformers.js
 *
 * This module manages:
 * - ONNX Runtime WASM path configuration
 * - Model loading (CDN or airgapped)
 * - Embedding computation with LRU caching
 */

import type { ModelConfig } from '../core/Protocol.js';

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
 * EmbeddingEngine singleton for managing embedding computation
 */
export class EmbeddingEngine {
  private static instance: EmbeddingEngine | null = null;
  private config: EmbeddingConfig | null = null;
  private isInitialized = false;

  /**
   * Get the singleton instance
   */
  static getInstance(): EmbeddingEngine {
    if (!EmbeddingEngine.instance) {
      EmbeddingEngine.instance = new EmbeddingEngine();
    }
    return EmbeddingEngine.instance;
  }

  /**
   * Initialize the embedding engine with configuration
   *
   * @param config - Model configuration from InitPayload
   */
  async initialize(config?: ModelConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Build embedding config from ModelConfig
    this.config = this.buildConfig(config);

    // Configure ONNX WASM paths if explicitly provided
    // Note: This will be fully implemented when @huggingface/transformers is installed in 04-01
    if (config?.onnxPaths) {
      // Store for later use when Transformers.js is available
      // The actual env.backends.onnx.wasm.wasmPaths configuration
      // will happen in 04-01 after the dependency is installed
    }

    // Full initialization will be completed in 04-01
    this.isInitialized = true;
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
