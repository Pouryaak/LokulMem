/**
 * Core type definitions for worker management
 */

import type { LifecycleConfig } from '../lifecycle/types.js';
import type { ModelConfig } from './Protocol.js';

/**
 * Worker type - indicates which execution mode is active
 */
export type WorkerType = 'shared' | 'dedicated' | 'main-thread';

/**
 * Configuration options for worker initialization
 */
export interface WorkerConfig {
  /** Worker type preference - 'auto' tries SharedWorker → DedicatedWorker → main thread */
  workerType: 'auto' | 'shared' | 'dedicated' | 'main';
  /** URL to the worker script */
  workerUrl: string;
  /** Initialization timeout in milliseconds (default: 10000) */
  initTimeoutMs: number;
  /** Maximum retry attempts for initialization (default: 1) */
  maxRetries: number;
  /** Database name for IndexedDB storage */
  dbName: string;
  /** Model configuration */
  modelConfig?: ModelConfig | undefined;
  /** Lifecycle configuration */
  lifecycleConfig?: LifecycleConfig | undefined;
  /** Per-operation timeout in milliseconds (default: 5000) */
  requestTimeoutMs?: number;
}

/**
 * PortLike interface - adapter for Worker/MessagePort uniform interface
 * Wraps both MessagePort (SharedWorker) and Worker (DedicatedWorker)
 */
export interface PortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  close?: () => void;
  start?: () => void;
  /** Standard event listener API (supported by Worker and MessagePort) */
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  /** Standard event listener API (supported by Worker and MessagePort) */
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: EventListenerOptions | boolean,
  ): void;
}

/**
 * Persistence status result from navigator.storage.persist()
 */
export interface PersistenceStatus {
  /** Whether persistence was granted */
  persisted: boolean;
  /** Reason for the persistence result */
  reason: 'granted' | 'denied' | 'not-supported' | 'error';
  /** Timestamp of the last persistence attempt */
  lastAttempt: number;
  /** Error message if reason is 'error' */
  error?: string;
}

/**
 * Worker manager state - exposed via status API
 */
export interface WorkerManagerState {
  /** Current worker type in use */
  workerType: WorkerType;
  /** Whether initialization is complete */
  isReady: boolean;
  /** Current persistence status */
  persistence: PersistenceStatus;
}

/**
 * Initialization stages for progress reporting
 */
export type InitStage =
  | 'worker'
  | 'model'
  | 'storage'
  | 'maintenance'
  | 'ready';

/**
 * Progress callback function type
 */
export type ProgressCallback = (
  stage: InitStage,
  stageProgress: number,
  overallProgress: number,
  message?: string,
) => void;
