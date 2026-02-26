import type { MemoryType } from '../types/memory.js';

export type AmbiguityReason =
  | 'GRAY_ZONE_SCORE'
  | 'PRONOUN_RELATION_AMBIGUITY'
  | 'UNRESOLVED_TEMPORAL_SHIFT'
  | 'PERSONAL_FACT_CUE';

export interface AmbiguityInput {
  content: string;
  score: number;
  threshold: number;
  memoryTypes: MemoryType[];
  entityCount: number;
  temporalBucket: 'current' | 'past' | 'future' | 'transition' | 'unspecified';
}

export interface AmbiguityDecision {
  shouldTriggerFallback: boolean;
  reasons: AmbiguityReason[];
}

export class AmbiguityTrigger {
  evaluate(input: AmbiguityInput): AmbiguityDecision {
    const reasons: AmbiguityReason[] = [];
    const lower = input.content.toLowerCase();

    const distance = Math.abs(input.score - input.threshold);
    if (distance <= 0.08) {
      reasons.push('GRAY_ZONE_SCORE');
    }

    const hasFirstPersonSubject =
      /(?:\bi\b|\bim\b|\bi'm\b|\bi\s+am\b|\bmy\b|\bwe\b|\bour\b)/.test(lower);
    const hasPersonalFactCue =
      /(?:\bname\s+is\b|\bcall\s+me\b|\bi(?:'m|\s+am|m)\b|\bmarried\b|\bsingle\b|\bwife\b|\bhusband\b|\bpartner\b|\blive\s+in\b|\bfrom\b|\bstudy\b|\bstudied\b|\bwork\s+as\b|\bwork\s+at\b|\blove\b|\blike\b|\bprefer\b|\bfavorite\b|\bplan\b|\bplanning\b|\bgoing\s+to\b|\bgonna\b|\bwill\b|\bstart\b|\bgym\b|\bfitness\b)/.test(
        lower,
      );
    const weakDeterministicSignal =
      input.score < input.threshold ||
      input.memoryTypes.length === 0 ||
      input.entityCount === 0;
    if (
      hasFirstPersonSubject &&
      hasPersonalFactCue &&
      weakDeterministicSignal
    ) {
      reasons.push('PERSONAL_FACT_CUE');
    }

    const hasPronoun = /\b(he|she|they|him|her|them|their|his|hers)\b/.test(
      lower,
    );
    const hasRelationalType = input.memoryTypes.includes('relational');
    if (hasPronoun && (input.entityCount === 0 || hasRelationalType)) {
      reasons.push('PRONOUN_RELATION_AMBIGUITY');
    }

    const hasTemporalMarker =
      /(used to|no longer|not anymore|formerly|previously|currently|now|last\s+week|next\s+week)/.test(
        lower,
      );
    if (hasTemporalMarker && input.temporalBucket === 'unspecified') {
      reasons.push('UNRESOLVED_TEMPORAL_SHIFT');
    }

    return {
      shouldTriggerFallback: reasons.length > 0,
      reasons,
    };
  }
}
