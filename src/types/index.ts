/**
 * Public type exports for LokulMem
 * All public API types are re-exported from this module
 */

// API types
// Storage types (for error handling and monitoring)
export type {
  AugmentOptions,
  ChatMessage,
  FallbackLLMConfig,
  InitStage,
  LearnOptions,
  LokulMemConfig,
  LokulMemDebug,
  StorageError,
  StorageErrorType,
  StorageStatus,
} from './api.js';

// Event types
export type {
  ContradictionCallback,
  MemoryCallback,
  MemoryIdCallback,
  MemoryStats,
  StatsCallback,
  Unsubscribe,
} from './events.js';
// Memory types (DTO pattern - embeddings excluded)
export type { MemoryDTO, MemoryStatus, MemoryType } from './memory.js';
