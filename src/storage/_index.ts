/**
 * Storage layer internal exports
 * These are for internal use only - NOT exported publicly
 */

// Export types from Database
export type { DbClusterRow, DbMemoryRow } from './Database.js';
// Database
export { LokulDatabase } from './Database.js';
// Embedding utilities
export {
  type ClusterInternal,
  clusterFromDb,
  clusterToDb,
  EXPECTED_EMBEDDING_DIM,
  fromDbFormat,
  memoryFromDb,
  memoryToDb,
  toDbFormat,
} from './embeddingStorage.js';
// Export types from MemoryRepository
export type { MemoryFilter } from './MemoryRepository.js';
// Repository
export { MemoryRepository } from './MemoryRepository.js';
// Storage Manager
export { StorageManager } from './StorageManager.js';
