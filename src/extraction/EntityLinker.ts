import type { Entity } from '../types/memory.js';

export interface LinkedEntity extends Entity {
  canonicalId: string;
  linkReason: 'exact' | 'fuzzy' | 'pronoun' | 'new';
}

export interface EntityLinkContext {
  conversationId: string;
}

export class EntityLinker {
  private mentionToCanonical = new Map<string, string>();
  private canonicalByType = new Map<Entity['type'], Set<string>>();
  private canonicalValueById = new Map<string, string>();
  private lastSeenByConversation = new Map<
    string,
    Partial<Record<Entity['type'], string>>
  >();

  resolve(entities: Entity[], context: EntityLinkContext): LinkedEntity[] {
    return entities.map((entity) => this.resolveEntity(entity, context));
  }

  private resolveEntity(
    entity: Entity,
    context: EntityLinkContext,
  ): LinkedEntity {
    const normalizedMention = this.normalizeMention(entity.value, entity.type);
    const mentionKey = this.mentionKey(entity.type, normalizedMention);

    const pronounResolved = this.resolvePronoun(
      entity.type,
      normalizedMention,
      context,
    );
    if (pronounResolved) {
      this.remember(entity.type, normalizedMention, pronounResolved, context);
      return {
        ...entity,
        canonicalId: pronounResolved,
        linkReason: 'pronoun',
      };
    }

    const exact = this.mentionToCanonical.get(mentionKey);
    if (exact) {
      this.remember(entity.type, normalizedMention, exact, context);
      return {
        ...entity,
        canonicalId: exact,
        linkReason: 'exact',
      };
    }

    const fuzzy = this.findFuzzyMatch(entity.type, normalizedMention);
    if (fuzzy) {
      this.remember(entity.type, normalizedMention, fuzzy, context);
      return {
        ...entity,
        canonicalId: fuzzy,
        linkReason: 'fuzzy',
      };
    }

    const canonicalId = this.createCanonicalId(entity.type, normalizedMention);
    this.remember(entity.type, normalizedMention, canonicalId, context);
    return {
      ...entity,
      canonicalId,
      linkReason: 'new',
    };
  }

  private resolvePronoun(
    type: Entity['type'],
    mention: string,
    context: EntityLinkContext,
  ): string | null {
    if (!this.isPronoun(mention)) {
      return null;
    }

    const byType = this.lastSeenByConversation.get(context.conversationId);
    return byType?.[type] ?? null;
  }

  private remember(
    type: Entity['type'],
    mention: string,
    canonicalId: string,
    context: EntityLinkContext,
  ): void {
    this.mentionToCanonical.set(this.mentionKey(type, mention), canonicalId);
    this.canonicalValueById.set(canonicalId, mention);
    if (!this.canonicalByType.has(type)) {
      this.canonicalByType.set(type, new Set<string>());
    }
    this.canonicalByType.get(type)?.add(canonicalId);

    if (!this.lastSeenByConversation.has(context.conversationId)) {
      this.lastSeenByConversation.set(context.conversationId, {});
    }

    const byType = this.lastSeenByConversation.get(context.conversationId);
    if (byType) {
      byType[type] = canonicalId;
    }
  }

  private findFuzzyMatch(type: Entity['type'], mention: string): string | null {
    if (mention.length < 4) {
      return null;
    }

    const candidates = this.canonicalByType.get(type);
    if (!candidates || candidates.size === 0) {
      return null;
    }

    for (const canonicalId of candidates) {
      const candidateValue = this.canonicalValueById.get(canonicalId) ?? '';
      if (candidateValue.length < 4) {
        continue;
      }

      const distance = this.levenshtein(mention, candidateValue);
      if (distance <= 2) {
        return canonicalId;
      }
    }

    return null;
  }

  private normalizeMention(value: string, type: Entity['type']): string {
    let normalized = value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (type === 'person') {
      normalized = normalized.replace(
        /^(my|our)\s+(wife|husband|partner|friend)\s+/,
        '',
      );
    }

    return normalized;
  }

  private isPronoun(value: string): boolean {
    return [
      'he',
      'she',
      'they',
      'him',
      'her',
      'them',
      'his',
      'hers',
      'their',
    ].includes(value);
  }

  private mentionKey(type: Entity['type'], mention: string): string {
    return `${type}:${mention}`;
  }

  private createCanonicalId(type: Entity['type'], mention: string): string {
    return `ent_${type}_${this.hashStable(mention)}`;
  }

  private hashStable(value: string): string {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash +=
        (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0).toString(36);
  }

  private levenshtein(a: string, b: string): number {
    const previous = Array.from({ length: a.length + 1 }, (_, i) => i);
    const current = Array.from({ length: a.length + 1 }, () => 0);

    for (let i = 1; i <= b.length; i++) {
      current[0] = i;
      for (let j = 1; j <= a.length; j++) {
        const substitutionCost = b[i - 1] === a[j - 1] ? 0 : 1;
        const deletion = (previous[j] ?? 0) + 1;
        const insertion = (current[j - 1] ?? 0) + 1;
        const substitution = (previous[j - 1] ?? 0) + substitutionCost;
        current[j] = Math.min(deletion, insertion, substitution);
      }

      for (let j = 0; j <= a.length; j++) {
        previous[j] = current[j] ?? 0;
      }
    }

    return previous[a.length] ?? Math.max(a.length, b.length);
  }
}
