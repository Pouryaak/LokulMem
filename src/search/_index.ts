/**
 * Search module barrel file
 *
 * Provides clean imports for internal use and keeps the search module organized.
 */

// Core search classes
export { VectorSearch } from './VectorSearch.js';
export { Scoring, DEFAULT_SCORING_CONFIG } from './Scoring.js';

// Search types
export type {
  SearchResult,
  SearchOptions,
  ScoringConfig,
  ScoringWeights,
  ScoreBreakdown,
} from './types.js';
