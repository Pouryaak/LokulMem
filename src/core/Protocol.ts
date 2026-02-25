/**
 * Message protocol types for worker communication
 * Defines the message format for request/response correlation and progress reporting
 */

import type { LifecycleConfig } from '../lifecycle/types.js';
import type { InitStage } from '../types/api.js';

/**
 * Request message sent from main thread to worker
 * Uses UUID for request/response correlation
 */
export interface RequestMessage {
  /** Unique identifier for correlation (UUID) */
  id: string;
  /** Message type for routing */
  type: string;
  /** Payload data */
  payload: unknown;
}

/**
 * Response message sent from worker to main thread
 * Includes the request ID for correlation
 */
export interface ResponseMessage {
  /** Matches the request ID */
  id: string;
  /** Message type */
  type: string;
  /** Response payload */
  payload: unknown;
  /** Error details if the request failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Progress message for initialization stage reporting
 * Reports both stage-specific and overall progress
 */
export interface ProgressMessage {
  /** Fixed type for progress messages */
  type: 'progress';
  /** Current initialization stage */
  stage: InitStage;
  /** Progress within current stage (0-100) */
  stageProgress: number;
  /** Overall progress across all stages (0-100) */
  overallProgress: number;
  /** Optional human-readable message */
  message?: string;
}

/**
 * Union type for all worker messages
 */
export type WorkerMessage = RequestMessage | ResponseMessage | ProgressMessage;

/**
 * Message type constants
 * Using as const object instead of const enum for better build tool compatibility
 */
export const MessageType = {
  INIT: 'init',
  PROGRESS: 'progress',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  EMBED: 'embed',
  EMBED_BATCH: 'embed_batch',
  LIST: 'list',
  GET: 'get',
  SEARCH: 'search',
  SEMANTIC_SEARCH: 'semantic_search',
} as const;

/**
 * Type alias for message type values
 */
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/**
 * Model configuration for initialization
 */
export interface ModelConfig {
  /** Model name (e.g., 'Xenova/all-MiniLM-L6-v2') */
  modelName?: string;
  /** Base URL for local model files (airgap mode) */
  localModelBaseUrl?: string;
  /** Embedding dimensions (default: 384 for MiniLM-L6-v2) */
  embeddingDims?: number;
  /** Cache size for LRU embedding cache */
  cacheSize?: number;
  /** Enable embedding cache */
  enableCache?: boolean;
  /** Custom ONNX Runtime WASM paths */
  onnxPaths?: string | Record<string, string>;
}

/**
 * Payload for initialization request
 */
export interface InitPayload {
  /** Database name for IndexedDB */
  dbName: string;
  /** Whether storage persistence was granted */
  persistenceGranted: boolean;
  /** Model configuration */
  modelConfig?: ModelConfig | undefined;
  /** Lifecycle configuration */
  lifecycleConfig?: LifecycleConfig | undefined;
  /** Custom worker URL (passed through for reference) */
  workerUrl?: string | undefined;
}

/**
 * Payload for single text embedding request
 */
export interface EmbedPayload {
  /** Text to embed */
  text: string;
}

/**
 * Payload for batch embedding request
 */
export interface EmbedBatchPayload {
  /** Array of texts to embed */
  texts: string[];
}

/**
 * Response payload for single embedding request
 */
export interface EmbedResponsePayload {
  /** Embedding as array of floats (serialized from Float32Array) */
  embedding: number[];
  /** Dimensions of the embedding */
  dimensions: number;
}

/**
 * Response payload for batch embedding request
 */
export interface EmbedBatchResponsePayload {
  /** Array of embeddings (each as array of floats) */
  embeddings: number[][];
  /** Dimensions of each embedding */
  dimensions: number;
}
