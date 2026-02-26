import { describe, expect, it, vi } from 'vitest';

import { Learner } from '../../src/api/Learner.js';
import { SpecificityNER } from '../../src/extraction/SpecificityNER.js';
import type { MemoryInternal } from '../../src/internal/types.js';

function buildMemory(overrides: Partial<MemoryInternal> = {}): MemoryInternal {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    content: 'seed memory',
    types: ['preference'],
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
    sourceConversationIds: ['seed'],
    supersededBy: null,
    supersededAt: null,
    fadedAt: null,
    embedding: new Float32Array([0.1, 0.2, 0.3]),
    conflictDomain: 'preference',
    metadata: {
      canonical: {
        key: 'seed-key',
        predicate: 'prefers',
        object: 'seed-object',
        temporalBucket: 'current',
      },
    },
    ...overrides,
  };
}

function createLearnerHarness(seed: MemoryInternal[] = []) {
  const stored = [...seed];

  const vectorSearch = {
    add: vi.fn(),
    delete: vi.fn(),
  };

  const repository = {
    bulkCreate: vi.fn(async (memories: MemoryInternal[]) => {
      stored.push(...memories);
    }),
    findByStatus: vi.fn(async (status: MemoryInternal['status']) =>
      stored.filter((memory) => memory.status === status),
    ),
    getById: vi.fn(
      async (id: string) => stored.find((memory) => memory.id === id) ?? null,
    ),
  };

  const qualityScorer = {
    score: vi.fn(async () => ({
      score: 0.82,
      novelty: 0.75,
      specificity: 0.8,
      recurrence: 0.0,
      meetsThreshold: true,
      threshold: 0.45,
    })),
  };

  const contradictionDetector = {
    detect: vi.fn(async () => []),
  };

  const supersessionManager = {
    applySupersession: vi.fn(
      async (event: { conflictingMemoryId: string; newMemoryId: string }) => {
        const oldMemory = stored.find(
          (memory) => memory.id === event.conflictingMemoryId,
        );
        if (oldMemory) {
          oldMemory.status = 'superseded';
        }
        return {
          oldMemoryId: event.conflictingMemoryId,
          newMemoryId: event.newMemoryId,
          timestamp: Date.now(),
        };
      },
    ),
  };

  const embeddingEngine = {
    embed: vi.fn(async () => new Float32Array([0.2, 0.4, 0.6])),
  };

  const eventManager = {
    emit: vi.fn(),
    createMemoryEvent: vi.fn((memory: { id: string }) => ({
      memoryId: memory.id,
    })),
  };

  const learner = new Learner(
    {} as never,
    vectorSearch as never,
    repository as never,
    qualityScorer as never,
    contradictionDetector as never,
    supersessionManager as never,
    null,
    new SpecificityNER(),
    {} as never,
    {} as never,
    embeddingEngine as never,
    eventManager as never,
    { extractionThreshold: 0.45 },
  );

  return {
    learner,
    qualityScorer,
    vectorSearch,
    supersessionManager,
    repository,
    stored,
  };
}

describe('Learner normalization and policy integration', () => {
  it('uses extraction-safe normalization, preserves source text, and emits timings', async () => {
    const { learner, qualityScorer } = createLearnerHarness();

    const result = await learner.learn(
      { role: 'user', content: 'im Alice' },
      { role: 'assistant', content: 'Nice to meet you' },
      { conversationId: 'conv-normalize', verbose: true },
    );

    expect(qualityScorer.score).toHaveBeenCalledWith(
      expect.objectContaining({ content: "i'm Alice" }),
    );

    expect(result.extracted).toHaveLength(1);
    const extracted = result.extracted[0];
    expect(extracted?.content).toBe('im Alice');

    const metadata = (extracted?.metadata ?? {}) as {
      normalizedContent?: string;
      extractionNormalizedContent?: string;
      canonical?: { key?: string };
    };
    expect(metadata.normalizedContent).toBe("i'm alice");
    expect(metadata.extractionNormalizedContent).toBe("i'm Alice");
    expect(metadata.canonical?.key).toBeDefined();

    expect(result.timings?.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timings?.perSourceMs).toHaveLength(1);
    expect(result.diagnostics?.[0]?.policyAction).toBe('ADD');
  });

  it('ignores canonical duplicates on repeated equivalent messages', async () => {
    const { learner } = createLearnerHarness();

    const first = await learner.learn(
      { role: 'user', content: 'im Alice' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-dup' },
    );

    const second = await learner.learn(
      { role: 'user', content: 'i m Alice' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-dup', verbose: true },
    );

    expect(first.extracted).toHaveLength(1);
    expect(second.extracted).toHaveLength(0);
    expect(second.diagnostics?.[0]?.policyAction).toBe('IGNORE');
    expect(second.diagnostics?.[0]?.policyReasonCodes).toContain(
      'EXACT_CANONICAL_DUPLICATE',
    );
  });

  it('applies deterministic supersession on transitional replacement', async () => {
    const seed = buildMemory({
      id: 'old-location',
      types: ['location'],
      conflictDomain: 'location',
      metadata: {
        canonical: {
          key: 'old-key',
          predicate: 'lives_in',
          object: 'place:denver',
          temporalBucket: 'current',
        },
      },
    });
    const { learner, supersessionManager, vectorSearch } = createLearnerHarness(
      [seed],
    );

    const result = await learner.learn(
      {
        role: 'user',
        content: 'I used to live in Denver but now I live in Austin',
      },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-transition', verbose: true },
    );

    expect(result.extracted).toHaveLength(1);
    expect(result.diagnostics?.[0]?.policyAction).toBe('SUPERSEDE');
    expect(result.diagnostics?.[0]?.policyTargetMemoryId).toBe('old-location');
    expect(supersessionManager.applySupersession).toHaveBeenCalledTimes(1);
    expect(vectorSearch.delete).toHaveBeenCalledWith('old-location');
  });

  it('rejects repetitive noise via risk validation even with high score', async () => {
    const { learner } = createLearnerHarness();

    const result = await learner.learn(
      { role: 'user', content: 'pizza pizza pizza pizza' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-risk', verbose: true },
    );

    expect(result.extracted).toHaveLength(0);
    expect(result.diagnostics?.[0]?.accepted).toBe(false);
    expect(result.diagnostics?.[0]?.riskSignals).toContain('REPETITIVE_NOISE');
  });
});
