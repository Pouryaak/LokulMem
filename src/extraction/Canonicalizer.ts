import type { Entity, MemoryType } from '../types/memory.js';

export interface CanonicalizationEntity {
  type: Entity['type'];
  value: string;
  canonicalId?: string;
}

export interface CanonicalEntity {
  type: Entity['type'];
  value: string;
  canonicalId?: string;
}

export interface CanonicalScope {
  conversationId?: string;
}

export interface CanonicalizationInput {
  content: string;
  entities: CanonicalizationEntity[];
  memoryTypes: MemoryType[];
  subject?: string;
  scope?: CanonicalScope;
}

export interface CanonicalizationResult {
  key: string;
  subject: string;
  predicate: string;
  object: string;
  temporalBucket: 'current' | 'past' | 'future' | 'transition' | 'unspecified';
  entities: CanonicalEntity[];
}

export class Canonicalizer {
  canonicalize(input: CanonicalizationInput): CanonicalizationResult {
    const { content, entities, memoryTypes, subject, scope } = input;

    const canonicalEntities = entities
      .map((entity) => {
        const canonicalEntity: CanonicalEntity = {
          type: entity.type,
          value: this.canonicalizeToken(entity.value),
        };

        if (entity.canonicalId !== undefined) {
          canonicalEntity.canonicalId = this.canonicalizeToken(
            entity.canonicalId,
          );
        }

        return canonicalEntity;
      })
      .filter((entity) => entity.value.length > 0)
      .sort((a, b) =>
        this.entitySignature(a).localeCompare(this.entitySignature(b)),
      );

    const canonicalSubject = this.canonicalizeToken(subject ?? 'user');
    const predicate = this.canonicalizePredicate(memoryTypes);
    const temporalBucket = this.inferTemporalBucket(content);
    const objectFromEntities = canonicalEntities.map((entity) =>
      this.entitySignature(entity),
    );
    const canonicalObject =
      objectFromEntities.length > 0
        ? objectFromEntities.join('+')
        : this.canonicalizeToken(content);
    const scopeKey = this.canonicalizeToken(scope?.conversationId ?? 'global');

    const keyMaterial = [
      scopeKey,
      canonicalSubject,
      predicate,
      canonicalObject,
      temporalBucket,
    ].join('|');

    return {
      key: this.hashStable(keyMaterial),
      subject: canonicalSubject,
      predicate,
      object: canonicalObject,
      temporalBucket,
      entities: canonicalEntities,
    };
  }

  private canonicalizePredicate(memoryTypes: MemoryType[]): string {
    const primaryType = memoryTypes[0] ?? 'preference';
    const mapping: Record<MemoryType, string> = {
      identity: 'is',
      location: 'lives_in',
      profession: 'works_as',
      preference: 'prefers',
      project: 'works_on',
      temporal: 'time_state',
      relational: 'related_to',
      emotional: 'feels',
    };

    return mapping[primaryType];
  }

  private inferTemporalBucket(
    content: string,
  ): 'current' | 'past' | 'future' | 'transition' | 'unspecified' {
    const lower = content.toLowerCase();

    if (/(used to|no longer|not anymore|but now|now i)/.test(lower)) {
      return 'transition';
    }
    if (
      /(planning to|going to|will|intend to|next\s+month|next\s+year)/.test(
        lower,
      )
    ) {
      return 'future';
    }
    if (/(formerly|previously|ago|last\s+week|yesterday)/.test(lower)) {
      return 'past';
    }
    if (/(today|currently|now|this\s+week)/.test(lower)) {
      return 'current';
    }
    return 'unspecified';
  }

  private canonicalizeToken(value: string): string {
    return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private entitySignature(entity: CanonicalEntity): string {
    return entity.canonicalId ?? `${entity.type}:${entity.value}`;
  }

  private hashStable(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) + hash + value.charCodeAt(i);
      hash |= 0;
    }
    return `ck_${Math.abs(hash).toString(36)}`;
  }
}
