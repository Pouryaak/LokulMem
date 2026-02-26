/**
 * Public API exports for LokulMem
 *
 * Exports all types and classes for the augment/learn/manage API surface.
 */

// Augment API
export { Augmenter } from './Augmenter.js';
export type {
  AugmentOptions,
  AugmentResult,
  ChatMessage,
  LokulMemDebug,
} from './types.js';

// Learn API
export { Learner } from './Learner.js';
export type { LearnOptions, LearnResult } from './types.js';

// Manage API
export { Manager } from './Manager.js';
export type {
  BulkOperationResult,
  ClearResult,
  ExportFormat,
  ImportMode,
  ImportResult,
  InjectionPreviewResult,
  ListOptions,
  LokulMemExport,
  MemoryUpdate,
  PaginatedResult,
  SemanticSearchOptions,
  SingleOperationResult,
  TimelineResult,
  GroupedResult,
} from './types.js';

// Event API
export { EventManager } from './EventManager.js';
export type {
  EventConfig,
  MemoryEventPayload,
  StatsChangedPayload,
  EventType,
} from './types.js';
