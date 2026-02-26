import type { MemoryInternal } from '../internal/types.js';

export type WriteAction = 'ADD' | 'UPDATE' | 'SUPERSEDE' | 'IGNORE';

export type WriteReasonCode =
  | 'NO_ACTIVE_MATCH'
  | 'EXACT_CANONICAL_DUPLICATE'
  | 'TRANSITIONAL_REPLACEMENT'
  | 'SAME_PREDICATE_NEW_VALUE'
  | 'LOW_CONFIDENCE_MATCH';

export interface WritePolicyDecision {
  action: WriteAction;
  reasonCodes: WriteReasonCode[];
  targetMemoryId?: string;
}

export class WritePolicyEngine {
  decide(
    candidate: MemoryInternal,
    activeMemories: MemoryInternal[],
  ): WritePolicyDecision {
    const candidateCanonical = this.getCanonical(candidate);
    if (!candidateCanonical) {
      return {
        action: 'ADD',
        reasonCodes: ['NO_ACTIVE_MATCH'],
      };
    }

    const comparable = activeMemories
      .map((memory) => ({
        memory,
        canonical: this.getCanonical(memory),
      }))
      .filter(
        (
          item,
        ): item is {
          memory: MemoryInternal;
          canonical: {
            key: string;
            predicate: string;
            object: string;
            temporalBucket: string;
          };
        } => item.canonical !== null,
      );

    const exactMatch = comparable.find(
      (item) => item.canonical.key === candidateCanonical.key,
    );
    if (exactMatch) {
      return {
        action: 'IGNORE',
        reasonCodes: ['EXACT_CANONICAL_DUPLICATE'],
        targetMemoryId: exactMatch.memory.id,
      };
    }

    const samePredicate = comparable
      .filter(
        (item) => item.canonical.predicate === candidateCanonical.predicate,
      )
      .sort((a, b) => b.memory.updatedAt - a.memory.updatedAt);

    const best = samePredicate[0];
    if (!best) {
      return {
        action: 'ADD',
        reasonCodes: ['NO_ACTIVE_MATCH'],
      };
    }

    if (
      candidateCanonical.temporalBucket === 'transition' ||
      candidateCanonical.temporalBucket === 'past'
    ) {
      return {
        action: 'SUPERSEDE',
        reasonCodes: ['TRANSITIONAL_REPLACEMENT'],
        targetMemoryId: best.memory.id,
      };
    }

    if (best.canonical.object !== candidateCanonical.object) {
      return {
        action: 'UPDATE',
        reasonCodes: ['SAME_PREDICATE_NEW_VALUE'],
        targetMemoryId: best.memory.id,
      };
    }

    return {
      action: 'ADD',
      reasonCodes: ['LOW_CONFIDENCE_MATCH'],
    };
  }

  private getCanonical(memory: MemoryInternal): {
    key: string;
    predicate: string;
    object: string;
    temporalBucket: string;
  } | null {
    const metadata = memory.metadata as {
      canonical?: {
        key?: string;
        predicate?: string;
        object?: string;
        temporalBucket?: string;
      };
    };
    const canonical = metadata.canonical;
    if (
      !canonical?.key ||
      !canonical.predicate ||
      !canonical.object ||
      !canonical.temporalBucket
    ) {
      return null;
    }

    return {
      key: canonical.key,
      predicate: canonical.predicate,
      object: canonical.object,
      temporalBucket: canonical.temporalBucket,
    };
  }
}
