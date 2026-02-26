import { describe, expect, it, vi } from 'vitest';

import { Learner } from '../../src/api/Learner.js';
import type { FallbackExtractor } from '../../src/extraction/FallbackExtractor.js';
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

function createLearnerHarness(options?: {
  seed?: MemoryInternal[];
  fallbackExtractor?: FallbackExtractor;
  scoreImpl?: (content: string) => {
    score: number;
    novelty: number;
    specificity: number;
    recurrence: number;
    meetsThreshold: boolean;
    threshold: number;
  };
}) {
  const seed = options?.seed ?? [];
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
    score: vi.fn(
      async ({ content }: { content: string }) =>
        options?.scoreImpl?.(content) ?? {
          score: 0.82,
          novelty: 0.75,
          specificity: 0.8,
          recurrence: 0.0,
          meetsThreshold: true,
          threshold: 0.45,
        },
    ),
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
    {
      extractionThreshold: 0.45,
      ...(options?.fallbackExtractor !== undefined && {
        fallbackExtractor: options.fallbackExtractor,
      }),
    },
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
      {
        seed: [seed],
      },
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

  it('records phase3 ambiguity diagnostics and fallback invocation', async () => {
    const { learner } = createLearnerHarness();

    const result = await learner.learn(
      { role: 'user', content: 'She might move next week' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-phase3', verbose: true },
    );

    expect(result.diagnostics?.length).toBeGreaterThan(0);
    const first = result.diagnostics?.[0];
    expect(first?.ambiguityTriggered).toBe(true);
    expect(first?.fallbackInvoked).toBe(true);
    expect(first?.ambiguityReasons).toContain('UNRESOLVED_TEMPORAL_SHIFT');
  });

  it('accepts LLM fallback fact when deterministic candidate is below threshold', async () => {
    const fallbackExtractor: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [{ text: 'My name is Alice', confidence: 0.8 }],
        provider: 'webllm' as const,
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      })),
    };

    const { learner } = createLearnerHarness({
      fallbackExtractor,
      scoreImpl: (content) => {
        if (content.includes('name is Alice')) {
          return {
            score: 0.74,
            novelty: 0.8,
            specificity: 0.7,
            recurrence: 0,
            meetsThreshold: true,
            threshold: 0.45,
          };
        }

        return {
          score: 0.43,
          novelty: 0.4,
          specificity: 0.4,
          recurrence: 0,
          meetsThreshold: false,
          threshold: 0.45,
        };
      },
    });

    const result = await learner.learn(
      { role: 'user', content: 'Call me Alice' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-phase31', verbose: true },
    );

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]?.content).toBe('My name is Alice');
    expect(
      result.diagnostics?.some((item) => item.extractionMode === 'fallback'),
    ).toBe(true);
    const fallbackDiagnostic = result.diagnostics?.find(
      (item) => item.extractionMode === 'fallback',
    );
    expect(fallbackDiagnostic?.fallbackProvider).toBe('webllm');
    expect(fallbackDiagnostic?.fallbackModel).toBe(
      'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    );
  });

  it('uses fallback confidence to accept same-text gray-zone facts', async () => {
    const fallbackExtractor: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [{ text: 'I live in Denmark', confidence: 0.86 }],
        provider: 'webllm' as const,
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      })),
    };

    const { learner } = createLearnerHarness({
      fallbackExtractor,
      scoreImpl: (content) => ({
        score: content.toLowerCase().includes('denmark') ? 0.4 : 0.2,
        novelty: 0.8,
        specificity: 0.3,
        recurrence: 0,
        meetsThreshold: false,
        threshold: 0.45,
      }),
    });

    const result = await learner.learn(
      { role: 'user', content: 'I live in Denmark' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-denmark', verbose: true },
    );

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]?.content).toBe('I live in Denmark');
    const fallbackDiagnostic = result.diagnostics?.find(
      (item) => item.extractionMode === 'fallback',
    );
    expect(fallbackDiagnostic?.fallbackFactCount).toBe(1);
    expect(fallbackDiagnostic?.accepted).toBe(true);
  });

  it('routes weak personal cues to fallback and records reason', async () => {
    const fallbackExtractor: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [{ text: 'My name is Pourya', confidence: 0.86 }],
        provider: 'webllm' as const,
        model: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      })),
    };

    const { learner } = createLearnerHarness({
      fallbackExtractor,
      scoreImpl: (content) => {
        if (content.includes('name is Pourya')) {
          return {
            score: 0.72,
            novelty: 0.8,
            specificity: 0.7,
            recurrence: 0,
            meetsThreshold: true,
            threshold: 0.45,
          };
        }

        return {
          score: 0.31,
          novelty: 0.7,
          specificity: 0,
          recurrence: 0,
          meetsThreshold: false,
          threshold: 0.45,
        };
      },
    });

    const result = await learner.learn(
      { role: 'user', content: 'Im Pourya' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-personal-cue', verbose: true },
    );

    expect(fallbackExtractor.extract).toHaveBeenCalledTimes(1);
    const deterministic = result.diagnostics?.find(
      (item) => item.extractionMode === 'deterministic',
    );
    expect(deterministic?.fallbackInvoked).toBe(true);
    expect(deterministic?.ambiguityReasons).toContain('PERSONAL_FACT_CUE');
    expect(deterministic?.fallbackProvider).toBe('webllm');
  });

  it('handles adversarial multi-fact chunks through fallback extraction', async () => {
    const fallbackExtractor: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [
          { text: 'My name is Pourya', confidence: 0.9 },
          { text: 'I live in Copenhagen', confidence: 0.88 },
          { text: 'I love Nutella', confidence: 0.85 },
        ],
        provider: 'webllm' as const,
        model: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      })),
    };

    const { learner } = createLearnerHarness({
      fallbackExtractor,
      scoreImpl: (content) => {
        const lower = content.toLowerCase();
        if (
          lower.includes('name is pourya') ||
          lower.includes('live in copenhagen') ||
          lower.includes('love nutella')
        ) {
          return {
            score: 0.74,
            novelty: 0.82,
            specificity: 0.7,
            recurrence: 0,
            meetsThreshold: true,
            threshold: 0.45,
          };
        }

        return {
          score: 0.43,
          novelty: 0.6,
          specificity: 0.1,
          recurrence: 0,
          meetsThreshold: false,
          threshold: 0.45,
        };
      },
    });

    const result = await learner.learn(
      {
        role: 'user',
        content:
          'She might move next week. I live in copenhagen, I love nutella, and random noise 12345 ???',
      },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-adversarial-chunk', verbose: true },
    );

    expect(fallbackExtractor.extract).toHaveBeenCalledTimes(1);
    expect(result.extracted.length).toBeGreaterThan(0);
    const deterministicDiagnostic = result.diagnostics?.find(
      (item) => item.extractionMode === 'deterministic',
    );
    expect(deterministicDiagnostic?.fallbackInvoked).toBe(true);
    expect(
      result.diagnostics?.some((item) => item.extractionMode === 'fallback'),
    ).toBe(true);
  });

  it('accepts fallback relational fact near threshold when confidence is high', async () => {
    const fallbackExtractor: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [{ text: "My wife's name is Parastoo", confidence: 0.74 }],
        provider: 'webllm' as const,
        model: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      })),
    };

    const { learner } = createLearnerHarness({
      fallbackExtractor,
      scoreImpl: (content) => {
        if (content.toLowerCase().includes("wife's name is parastoo")) {
          return {
            score: 0.32,
            novelty: 0.78,
            specificity: 0.1,
            recurrence: 0,
            meetsThreshold: false,
            threshold: 0.36,
          };
        }

        return {
          score: 0.29,
          novelty: 0.7,
          specificity: 0,
          recurrence: 0,
          meetsThreshold: false,
          threshold: 0.36,
        };
      },
    });

    const result = await learner.learn(
      { role: 'user', content: "Im married and my wife's name is Parastoo" },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-relational-fallback', verbose: true },
    );

    expect(result.extracted.map((item) => item.content)).toContain(
      "My wife's name is Parastoo",
    );
    const fallbackDiagnostic = result.diagnostics?.find(
      (item) =>
        item.extractionMode === 'fallback' &&
        item.source.includes("wife's name"),
    );
    expect(fallbackDiagnostic?.accepted).toBe(true);
  });
});
