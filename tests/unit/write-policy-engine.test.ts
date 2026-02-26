import { describe, expect, it } from 'vitest';

import type { MemoryInternal } from '../../src/internal/types.js';
import { WritePolicyEngine } from '../../src/policy/WritePolicyEngine.js';

function memoryWithCanonical(
  id: string,
  canonical: {
    key: string;
    predicate: string;
    object: string;
    temporalBucket: string;
  },
): MemoryInternal {
  const now = Date.now();
  return {
    id,
    content: 'memory',
    types: ['location'],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    validFrom: now,
    validTo: null,
    baseStrength: 1,
    currentStrength: 1,
    pinned: false,
    mentionCount: 0,
    lastAccessedAt: now,
    clusterId: null,
    entities: [],
    sourceConversationIds: ['conv'],
    supersededBy: null,
    supersededAt: null,
    fadedAt: null,
    embedding: new Float32Array([0.1, 0.2]),
    conflictDomain: 'location',
    metadata: { canonical },
  };
}

describe('WritePolicyEngine', () => {
  it('returns IGNORE for exact canonical duplicates', () => {
    const engine = new WritePolicyEngine();
    const existing = memoryWithCanonical('m1', {
      key: 'same-key',
      predicate: 'lives_in',
      object: 'place:austin',
      temporalBucket: 'current',
    });
    const candidate = memoryWithCanonical('m2', {
      key: 'same-key',
      predicate: 'lives_in',
      object: 'place:austin',
      temporalBucket: 'current',
    });

    const decision = engine.decide(candidate, [existing]);

    expect(decision.action).toBe('IGNORE');
    expect(decision.targetMemoryId).toBe('m1');
    expect(decision.reasonCodes).toContain('EXACT_CANONICAL_DUPLICATE');
  });

  it('returns SUPERSEDE for transitional replacement on same predicate', () => {
    const engine = new WritePolicyEngine();
    const existing = memoryWithCanonical('m1', {
      key: 'old-key',
      predicate: 'lives_in',
      object: 'place:denver',
      temporalBucket: 'current',
    });
    const candidate = memoryWithCanonical('m2', {
      key: 'new-key',
      predicate: 'lives_in',
      object: 'place:austin',
      temporalBucket: 'transition',
    });

    const decision = engine.decide(candidate, [existing]);

    expect(decision.action).toBe('SUPERSEDE');
    expect(decision.targetMemoryId).toBe('m1');
    expect(decision.reasonCodes).toContain('TRANSITIONAL_REPLACEMENT');
  });

  it('returns UPDATE for same predicate but new object value', () => {
    const engine = new WritePolicyEngine();
    const existing = memoryWithCanonical('m1', {
      key: 'old-key',
      predicate: 'works_as',
      object: 'role:designer',
      temporalBucket: 'current',
    });
    const candidate = memoryWithCanonical('m2', {
      key: 'new-key',
      predicate: 'works_as',
      object: 'role:staff_designer',
      temporalBucket: 'current',
    });

    const decision = engine.decide(candidate, [existing]);

    expect(decision.action).toBe('UPDATE');
    expect(decision.targetMemoryId).toBe('m1');
    expect(decision.reasonCodes).toContain('SAME_PREDICATE_NEW_VALUE');
  });
});
