import type { MemoryType } from '../types/memory.js';
import type { CanonicalizationResult } from './Canonicalizer.js';
import type { LinkedEntity } from './EntityLinker.js';

export type RiskSignal =
  | 'REPETITIVE_NOISE'
  | 'LOW_STRUCTURE_HIGH_SCORE'
  | 'AMBIGUOUS_TEMPORAL';

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

  private hasTemporalMarker(content: string): boolean {
    const lower = content.toLowerCase();
    return /(used to|no longer|not anymore|formerly|previously|currently|today|yesterday|tomorrow|last\s+week|next\s+week|now)/.test(
      lower,
    );
  }
}
