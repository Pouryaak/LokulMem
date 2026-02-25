/**
 * DecayCalculator - Ebbinghaus decay computation with per-category lambda values
 *
 * Implements the Ebbinghaus forgetting curve formula:
 *   strength(t) = base_strength × e^(-λ × Δt_hours)
 *
 * Key features:
 * - Per-category lambda values for different decay rates
 * - Pinned memories don't decay (lambda = 0)
 * - Uses lastAccessedAt with createdAt fallback for age calculation
 * - Validates all lambda values are non-negative at initialization
 * - Batch processing for efficient decay calculations
 */

import type { MemoryInternal } from '../internal/types.js';
import type { MemoryType } from '../types/memory.js';
import type { DecayConfig, DecayResult } from './types.js';

/**
 * Default lambda value for unknown categories
 * Represents moderate decay rate
 */
const DEFAULT_LAMBDA = 0.001;

/**
 * DecayCalculator - Computes memory strength decay using Ebbinghaus formula
 *
 * Memories decay over time based on their age and category-specific lambda values.
 * Pinned memories have lambda = 0 and never decay.
 */
export class DecayCalculator {
  private readonly config: DecayConfig;
  private readonly DEFAULT_LAMBDA = DEFAULT_LAMBDA;

  /**
   * Create a new DecayCalculator instance
   * @param config - Decay configuration with per-category lambda values
   * @throws Error if any lambda value is negative
   */
  constructor(config: DecayConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Calculate decay for a single memory
   * @param memory - Memory to calculate decay for
   * @param now - Current timestamp in milliseconds (defaults to Date.now())
   * @returns DecayResult with old and new strength values
   */
  calculateDecay(
    memory: MemoryInternal,
    now: number = Date.now(),
  ): DecayResult {
    const oldStrength = memory.currentStrength;

    // Determine lambda: 0 if pinned, otherwise get lambda for memory types
    const lambda = memory.pinned
      ? this.config.pinnedLambda
      : this.getLambdaForTypes(memory.types);

    // Calculate timestamp: lastAccessedAt with createdAt fallback
    const timestamp = memory.lastAccessedAt || memory.createdAt;

    // Calculate age in hours
    const ageHours = (now - timestamp) / (1000 * 60 * 60);

    // Compute decay factor using Ebbinghaus formula: e^(-λ × ageHours)
    const decayFactor = Math.exp(-lambda * ageHours);

    // Compute new strength: baseStrength × decayFactor
    const newStrength = memory.baseStrength * decayFactor;

    // Determine if memory has faded below threshold
    const isFaded = newStrength < this.config.fadedThreshold && !memory.pinned;

    return {
      memoryId: memory.id,
      oldStrength,
      newStrength,
      isFaded,
    };
  }

  /**
   * Calculate decay for multiple memories in batch
   * @param memories - Array of memories to calculate decay for
   * @param now - Current timestamp in milliseconds (defaults to Date.now())
   * @returns Array of DecayResult for each memory
   */
  calculateDecayBatch(
    memories: MemoryInternal[],
    now: number = Date.now(),
  ): DecayResult[] {
    return memories.map((memory) => this.calculateDecay(memory, now));
  }

  /**
   * Get lambda value for a memory with multiple types
   * Uses the minimum lambda (slowest decay) among all types
   * @param types - Array of memory types
   * @returns Lambda value (never negative)
   */
  private getLambdaForTypes(types: string[]): number {
    // Start with DEFAULT_LAMBDA
    let minLambda = this.DEFAULT_LAMBDA;

    // Iterate through types to find minimum lambda
    for (const type of types) {
      const lambda = this.config.lambdaByCategory[type as MemoryType];
      if (lambda !== undefined && lambda < minLambda) {
        minLambda = lambda;
      }
    }

    return minLambda;
  }

  /**
   * Validate all lambda values in the configuration
   * @throws Error if any lambda value is negative
   */
  private validateConfig(): void {
    // Validate pinned lambda
    this.validateLambda(this.config.pinnedLambda, 'pinnedLambda');

    // Validate all category lambdas
    for (const [category, lambda] of Object.entries(
      this.config.lambdaByCategory,
    )) {
      this.validateLambda(lambda, `lambdaByCategory.${category}`);
    }
  }

  /**
   * Validate a single lambda value
   * @param lambda - Lambda value to validate
   * @param name - Name of the lambda field (for error message)
   * @throws Error if lambda is negative
   */
  private validateLambda(lambda: number, name: string): void {
    if (lambda < 0) {
      throw new Error(
        `DecayCalculator: ${name} must be non-negative, got ${lambda}`,
      );
    }
  }
}

/**
 * Re-export DecayConfig and DecayResult for convenience
 */
export type { DecayConfig, DecayResult };
