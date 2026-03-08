import type { MemoryType } from '../types/memory.js';
import type { CanonicalizationResult } from './Canonicalizer.js';
import type { LinkedEntity } from './EntityLinker.js';

export type RiskSignal =
  | 'REPETITIVE_NOISE'
  | 'LOW_STRUCTURE_HIGH_SCORE'
  | 'AMBIGUOUS_TEMPORAL'
  | 'INTERROGATIVE_ONLY';

export interface RiskValidationInput {
  content: string;
  score: number;
  threshold: number;
  memoryTypes: MemoryType[];
  entities: LinkedEntity[];
  canonicalization: CanonicalizationResult;
}

export interface RiskValidationResult {
  accepted: boolean;
  signals: RiskSignal[];
}

export class RiskValidator {
  validate(input: RiskValidationInput): RiskValidationResult {
    const {
      content,
      score,
      threshold,
      memoryTypes,
      entities,
      canonicalization,
    } = input;
    const signals: RiskSignal[] = [];

    if (this.isInterrogativeOnly(content)) {
      signals.push('INTERROGATIVE_ONLY');
    }

    if (this.isRepetitiveNoise(content)) {
      signals.push('REPETITIVE_NOISE');
    }

    if (
      score >= threshold &&
      entities.length === 0 &&
      memoryTypes.length === 0
    ) {
      signals.push('LOW_STRUCTURE_HIGH_SCORE');
    }

    if (
      this.hasTemporalMarker(content) &&
      canonicalization.temporalBucket === 'unspecified'
    ) {
      signals.push('AMBIGUOUS_TEMPORAL');
    }

    return {
      accepted: signals.length === 0,
      signals,
    };
  }

  private isRepetitiveNoise(content: string): boolean {
    const tokens = content
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9'@.-]/g, ''))
      .filter((token) => token.length > 0);

    if (tokens.length < 4) {
      return false;
    }

    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }

    const maxCount = Math.max(...counts.values());
    const repetitionRatio = maxCount / tokens.length;
    return repetitionRatio >= 0.6;
  }

  /**
   * Detect content that is purely a question with no factual statement.
   * Questions like "What is your wife's name?" or "did I tell you my name?"
   * should not be stored as memories.
   */
  private isInterrogativeOnly(content: string): boolean {
    const trimmed = content.trim();
    const lower = trimmed.toLowerCase();

    // Starts with a question word — strong interrogative signal
    const startsWithQuestion =
      /^(what|where|when|who|why|how|which|do\s+you|did\s+you|did\s+i|can\s+you|could\s+you|would\s+you|is\s+there|are\s+there|have\s+you|does\b|will\b)/;

    if (startsWithQuestion.test(lower)) {
      return true;
    }

    // Ends with question mark but doesn't start with a question word
    if (trimmed.endsWith('?')) {
      // Allow tag questions on factual statements:
      // "My name is John, right?" or "I live in Paris, remember?"
      // These start with a first-person declarative assertion.
      const startsWithAssertion =
        /^(i\s+am|i'm|my\s+|i\s+live|i\s+work|i\s+have|i\s+prefer|i\s+like|i\s+love|i\s+hate|i\s+moved|i\s+started|i\s+quit|i\s+got)\b/;
      if (startsWithAssertion.test(lower)) {
        return false;
      }
      return true;
    }

    return false;
  }

  private hasTemporalMarker(content: string): boolean {
    const lower = content.toLowerCase();
    return /(used to|no longer|not anymore|formerly|previously|currently|today|yesterday|tomorrow|last\s+week|next\s+week|now)/.test(
      lower,
    );
  }
}
