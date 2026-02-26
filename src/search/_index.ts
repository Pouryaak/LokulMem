/**
 * Search module barrel file
 *
 * Provides clean imports for internal use and keeps the search module organized.
 */

export { QueryEngine } from './QueryEngine.js';
export { DEFAULT_SCORING_CONFIG, Scoring } from './Scoring.js';
// Search types
export type {
  FullTextSearchOptions,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
  ScoreBreakdown,
  ScoringConfig,
  ScoringWeights,
  SearchOptions,
  SearchResult,
  SemanticSearchOptions,
  TimelineGroup,
  TypeGroup,
} from './types.js';
// Core search classes
export { VectorSearch } from './VectorSearch.js';
