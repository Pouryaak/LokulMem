/**
 * LokulMem - Browser-Native LLM Memory Management Library
 *
 * Provides persistent, privacy-preserving memory for LLM applications
 * with three core APIs: augment(), learn(), and manage()
 */

// Worker URL import for bundler compatibility
// @ts-expect-error - Vite-specific import syntax
import WorkerUrl from './worker/index.ts?worker&url'

/**
 * Library version
 */
export const VERSION = '0.1.0'

/**
 * Worker URL for advanced use cases (e.g., custom worker instantiation)
 */
export { WorkerUrl }

/**
 * Memory types supported by the library
 */
export type MemoryType =
  | 'identity'
  | 'location'
  | 'profession'
  | 'preference'
  | 'project'
  | 'temporal'
  | 'relational'
  | 'emotional'

/**
 * Memory status lifecycle
 */
export type MemoryStatus = 'active' | 'faded' | 'superseded' | 'archived'

/**
 * Base memory interface (DTO pattern - embeddings excluded from public API)
 */
export interface Memory {
  id: string
  content: string
  type: MemoryType
  status: MemoryStatus
  createdAt: Date
  updatedAt: Date
  lastAccessedAt: Date
  baseStrength: number
  currentStrength: number
  mentionCount: number
  pinned: boolean
  validFrom: Date
  validTo: Date | null
  clusterId: string | null
  entities: string[]
  conversationIds: string[]
}

/**
 * Memory without system fields (for creation)
 */
export interface MemoryInput {
  content: string
  type: MemoryType
  entities?: string[]
  conversationIds?: string[]
}

/**
 * Options for memory augmentation
 */
export interface AugmentOptions {
  maxTokens?: number
  contextWindow?: number
  minRelevanceScore?: number
  debug?: boolean
}

/**
 * Options for learning from conversations
 */
export interface LearnOptions {
  extractionThreshold?: number
  enableContradictionDetection?: boolean
}

/**
 * Options for memory management
 */
export interface ManageOptions {
  limit?: number
  offset?: number
  filter?: {
    types?: MemoryType[]
    status?: MemoryStatus
    pinned?: boolean
  }
  sort?: {
    field: keyof Memory
    direction: 'asc' | 'desc'
  }
}
