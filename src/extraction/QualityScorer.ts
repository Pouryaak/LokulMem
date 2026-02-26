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

    try {
      // DEBUG: Log config
      console.log(
        '[QualityScorer] Starting score for:',
        content.substring(0, 30),
      );
      console.log('[QualityScorer] Config:', {
        threshold: this.config.threshold,
        minNovelty: this.config.minNovelty,
        noveltyWeight: this.config.noveltyWeight,
        specificityWeight: this.config.specificityWeight,
        recurrenceWeight: this.config.recurrenceWeight,
      });

      // Compute specificity
      const specificityResult = this.specificityNER.analyze(content);
      const specificity = specificityResult.score;

      console.log('[QualityScorer] Specificity result:', {
        score: specificity.toFixed(3),
        memoryTypes: specificityResult.memoryTypes,
        entities: specificityResult.entities.length,
      });

      // Compute novelty (requires vector search)
      console.log('[QualityScorer] About to compute novelty...');
      const novelty = await this.noveltyCalculator.compute(content);
      console.log('[QualityScorer] Novelty computed:', novelty.toFixed(3));

      // Compute recurrence (session-based)
      const recurrence = this.recurrenceTracker.checkRecurrence(
        content,
        embedding,
        this.config.recurrenceThreshold ?? 0.85,
      );

      // Track in session
      this.recurrenceTracker.track(content, embedding);

      console.log('[QualityScorer] Recurrence:', recurrence.toFixed(3));

      // Compute weighted E(s)
      const score =
        (this.config.noveltyWeight ?? 0.35) * novelty +
        (this.config.specificityWeight ?? 0.45) * specificity +
        (this.config.recurrenceWeight ?? 0.2) * recurrence;

      console.log('[QualityScorer] Weighted score:', score.toFixed(3), {
        novelty: novelty.toFixed(3),
        specificity: specificity.toFixed(3),
        recurrence: recurrence.toFixed(3),
      });

      // Check threshold - use base threshold when no types detected
      // CRITICAL: Don't default to 'preference' when memoryTypes is empty
      // This prevents poisoning contradiction domains
      const memoryType = specificityResult.memoryTypes[0];
      const threshold =
        memoryType !== undefined
          ? (this.config.thresholdsByType?.[memoryType] ??
            this.config.threshold)
          : this.config.threshold;

      const minNoveltyCheck = novelty >= (this.config.minNovelty ?? 0.15);
      const scoreCheck = score >= threshold;

      console.log('[QualityScorer] Threshold check:', {
        score: score.toFixed(3),
        threshold: threshold.toFixed(3),
        scorePass: scoreCheck,
        novelty: novelty.toFixed(3),
        minNovelty: (this.config.minNovelty ?? 0.15).toFixed(3),
        noveltyPass: minNoveltyCheck,
        meetsThreshold: scoreCheck && minNoveltyCheck,
      });

      const meetsThreshold = scoreCheck && minNoveltyCheck;

      console.log('[QualityScorer] ✓ Score complete, returning');

      return {
        score,
        novelty,
        specificity,
        recurrence,
        meetsThreshold,
      };
    } catch (error) {
      console.error('[QualityScorer] ERROR during scoring:', error);
      throw error;
    }
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
