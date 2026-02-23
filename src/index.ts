/**
 * LokulMem - Browser-Native LLM Memory Management Library
 *
 * Provides persistent, privacy-preserving memory for LLM applications
 * with three core APIs: augment(), learn(), and manage()
 */

// Worker URL import for bundler compatibility
// @ts-expect-error - Vite-specific import syntax
import WorkerUrl from './worker/index.ts?worker&url';

/**
 * Library version
 */
export const VERSION = '0.1.0';

/**
 * Worker URL for advanced use cases (e.g., custom worker instantiation)
 */
export { WorkerUrl };

// Public type re-exports from src/types/
// Internal types (src/internal/) are NOT exported - they stay internal
export type {
  // Memory types
  MemoryDTO,
  MemoryType,
  MemoryStatus,
  // API types
  LokulMemConfig,
  InitStage,
  AugmentOptions,
  LearnOptions,
  LokulMemDebug,
  // Event types
  MemoryStats,
  MemoryCallback,
  MemoryIdCallback,
  StatsCallback,
  ContradictionCallback,
  Unsubscribe,
} from './types/index.js';
