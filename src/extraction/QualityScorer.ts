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
  private config: ExtractionConfig;

  constructor(
    private specificityNER: SpecificityNER,
    private noveltyCalculator: NoveltyCalculator,
    private recurrenceTracker: RecurrenceTracker,
    config: ExtractionConfig,
  ) {
    // Set default values for extraction config
    this.config = {
      threshold: config.threshold ?? 0.55,
      minNovelty: config.minNovelty ?? 0.15,
      noveltyWeight: config.noveltyWeight ?? 0.35,
      specificityWeight: config.specificityWeight ?? 0.45,
      recurrenceWeight: config.recurrenceWeight ?? 0.2,
      recurrenceThreshold: config.recurrenceThreshold ?? 0.85,
      ...(config.thresholdsByType !== undefined && {
        thresholdsByType: config.thresholdsByType,
      }),
    };
  }

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
      this.config.recurrenceThreshold ?? 0.85,
    );

    // Track in session
    this.recurrenceTracker.track(content, embedding);

    // Compute weighted E(s)
    const score =
      (this.config.noveltyWeight ?? 0.35) * novelty +
      (this.config.specificityWeight ?? 0.45) * specificity +
      (this.config.recurrenceWeight ?? 0.2) * recurrence;

    // Check threshold - use base threshold when no types detected
    // CRITICAL: Don't default to 'preference' when memoryTypes is empty
    // This prevents poisoning contradiction domains
    const thresholds = specificityResult.memoryTypes.map(
      (type) => this.config.thresholdsByType?.[type] ?? this.config.threshold,
    );
    const threshold =
      thresholds.length > 0 ? Math.min(...thresholds) : this.config.threshold;

    const minNoveltyCheck = novelty >= (this.config.minNovelty ?? 0.15);
    const scoreCheck = score >= threshold;
    const meetsThreshold = scoreCheck && minNoveltyCheck;

    return {
      score,
      novelty,
      specificity,
      recurrence,
      meetsThreshold,
      threshold,
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
