import type { MemoryType } from '../types/memory.js';

export type AmbiguityReason =
  | 'GRAY_ZONE_SCORE'
  | 'PRONOUN_RELATION_AMBIGUITY'
  | 'UNRESOLVED_TEMPORAL_SHIFT';

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
