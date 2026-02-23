/**
 * Storage layer internal exports
 * These are for internal use only - NOT exported publicly
 */

// Database
export { LokulDatabase } from './Database.js';

// Storage Manager
export { StorageManager } from './StorageManager.js';

// Repository
export { MemoryRepository } from './MemoryRepository.js';

// Embedding utilities
export {
  toDbFormat,
  fromDbFormat,
  memoryToDb,
  memoryFromDb,
  clusterToDb,
  clusterFromDb,
  EXPECTED_EMBEDDING_DIM,
  type ClusterInternal,
} from './embeddingStorage.js';

// Export types from Database
export type { DbMemoryRow, DbClusterRow } from './Database.js';

// Export types from MemoryRepository
export type { MemoryFilter } from './MemoryRepository.js';
