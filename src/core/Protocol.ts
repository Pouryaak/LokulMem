/**
 * Message protocol types for worker communication
 * Defines the message format for request/response correlation and progress reporting
 */

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
} as const;

/**
 * Type alias for message type values
 */
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/**
 * Payload for initialization request
 */
export interface InitPayload {
  /** Database name for IndexedDB */
  dbName: string;
  /** Whether storage persistence was granted */
  persistenceGranted: boolean;
  /** Optional model configuration */
  modelConfig?: unknown;
}
