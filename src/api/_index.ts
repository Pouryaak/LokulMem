/**
 * Public API exports for LokulMem
 *
 * Exports all public classes and types for the manage() namespace API.
 * This barrel file provides a clean import interface for consumers.
 */

// Public API classes
export { Augmenter } from './Augmenter.js';
export { Learner } from './Learner.js';
export { Manager } from './Manager.js';

// Public API types
export type {
  // Augment/Learn types
  AugmentOptions,
  AugmentResult,
  ChatMessage,
  LearnOptions,
  LearnResult,
  LokulMemDebug,
  // Management types
  BulkOperationResult,
  ClearResult,
  ExportFormat,
  ImportMode,
  ImportResult,
  SingleOperationResult,
  LokulMemExport,
  MemoryUpdate,
  ListOptions,
  PaginatedResult,
  SemanticSearchOptions,
  TimelineResult,
  GroupedResult,
  InjectionPreviewResult,
} from './types.js';
