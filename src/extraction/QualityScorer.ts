import type { ExtractionConfig, ExtractionScore } from '../types/memory.js';
import type { NoveltyCalculator } from './NoveltyCalculator.js';
import type { RecurrenceTracker } from './RecurrenceTracker.js';
import type { SpecificityNER } from './SpecificityNER.js';

export interface QualityInput {
  content: string;
  embedding: Float32Array;
}

/**
 * QualityScorer - Extraction quality scoring pipeline
 *
 * Computes E(s) = 0.35×novelty + 0.45×specificity + 0.20×recurrence
 *
 * This quality score determines what's worth remembering from conversations.
 * The system uses three signals:
 * - Novelty: How different this is from existing memories (via vector search)
 * - Specificity: How much structured information is present (via NER)
 * - Recurrence: How often this has been mentioned in the current session
 *
 * Threshold filtering ensures only high-quality content is stored.
 */
export class QualityScorer {
  constructor(
    private specificityNER: SpecificityNER,
    private noveltyCalculator: NoveltyCalculator,
    private recurrenceTracker: RecurrenceTracker,
    private config: ExtractionConfig,
  ) {}

  /**
   * Compute extraction quality score E(s)
   * E(s) = 0.35×novelty + 0.45×specificity + 0.20×recurrence
   *
   * @param input - Content and embedding to score
   * @returns Extraction score with breakdown
   */
  async score(input: QualityInput): Promise<ExtractionScore> {
    const { content, embedding } = input;

    // Compute specificity
    const specificityResult = this.specificityNER.analyze(content);
    const specificity = specificityResult.score;

    // Compute novelty (requires vector search)
    const novelty = await this.noveltyCalculator.compute(content);

    // Compute recurrence (session-based)
    const recurrence = this.recurrenceTracker.checkRecurrence(
      content,
      embedding,
      this.config.recurrenceThreshold,
    );

    // Track in session
    this.recurrenceTracker.track(content, embedding);

    // Compute weighted E(s)
    const score =
      this.config.noveltyWeight * novelty +
      this.config.specificityWeight * specificity +
      this.config.recurrenceWeight * recurrence;

    // Check threshold - use base threshold when no types detected
    // CRITICAL: Don't default to 'preference' when memoryTypes is empty
    // This prevents poisoning contradiction domains
    const memoryType = specificityResult.memoryTypes[0];
    const threshold =
      memoryType !== undefined
        ? (this.config.thresholdsByType?.[memoryType] ?? this.config.threshold)
        : this.config.threshold;

    const meetsThreshold =
      score >= threshold && novelty >= this.config.minNovelty;

    return {
      score,
      novelty,
      specificity,
      recurrence,
      meetsThreshold,
    };
  }

  /**
   * Batch score multiple contents
   * @param inputs - Array of quality inputs
   * @returns Array of extraction scores
   */
  async scoreBatch(inputs: QualityInput[]): Promise<ExtractionScore[]> {
    return Promise.all(inputs.map((i) => this.score(i)));
  }
}
