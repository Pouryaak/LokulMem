/**
 * LokulMem - Browser-Native LLM Memory Management Library
 *
 * Provides persistent, privacy-preserving memory for LLM applications
 * with three core APIs: augment(), learn(), and manage()
 */

const WorkerUrl = new URL('./worker.mjs', import.meta.url).href;

/**
 * Library version
 */
export const VERSION = '0.1.0';

/**
 * Worker URL for advanced use cases (e.g., custom worker instantiation)
 */
export { WorkerUrl };

// Main API exports
export { createLokulMem, LokulMem } from './core/LokulMem.js';

// Public type re-exports from src/types/
// Internal types (src/core/, src/internal/) are NOT exported - they stay internal
export type {
  AugmentOptions,
  // API types
  ChatMessage,
  ContradictionCallback,
  FallbackLLMConfig,
  InitStage,
  LearnOptions,
  LokulMemConfig,
  LokulMemDebug,
  MemoryCallback,
  // Memory types
  MemoryDTO,
  MemoryIdCallback,
  // Event types
  MemoryStats,
  MemoryStatus,
  MemoryType,
  StatsCallback,
  StorageError,
  StorageErrorType,
  // Storage types (for error handling and monitoring)
  StorageStatus,
  Unsubscribe,
} from './types/index.js';
