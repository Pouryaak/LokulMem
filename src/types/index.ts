/**
 * Public type exports for LokulMem
 * All public API types are re-exported from this module
 */

// Memory types (DTO pattern - embeddings excluded)
export type { MemoryDTO, MemoryType, MemoryStatus } from './memory.js';

// API types
export type {
  ChatMessage,
  LokulMemConfig,
  InitStage,
  AugmentOptions,
  LearnOptions,
  LokulMemDebug,
} from './api.js';

// Event types
export type {
  MemoryStats,
  MemoryCallback,
  MemoryIdCallback,
  StatsCallback,
  ContradictionCallback,
  Unsubscribe,
} from './events.js';

// Storage types (for error handling and monitoring)
export type {
  StorageStatus,
  StorageError,
  StorageErrorType,
} from './api.js';
