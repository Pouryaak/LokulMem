import { describe, expect, it, vi } from 'vitest';

import { Learner } from '../../src/api/Learner.js';
import { SpecificityNER } from '../../src/extraction/SpecificityNER.js';

function createLearnerHarness() {
  const vectorSearch = {
    add: vi.fn(),
    delete: vi.fn(),
  };

  const repository = {
    bulkCreate: vi.fn(async () => undefined),
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
    applySupersession: vi.fn(async () => ({
      oldMemoryId: 'a',
      newMemoryId: 'b',
    })),
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
  };
}

describe('Learner normalization integration', () => {
  it('uses normalized matching content while preserving original stored content', async () => {
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
    expect(extracted?.types).toContain('identity');

    const metadata = (extracted?.metadata ?? {}) as {
      normalizedContent?: string;
      extractionNormalizedContent?: string;
      canonical?: { key?: string };
    };
    expect(metadata.normalizedContent).toBe("i'm alice");
    expect(metadata.extractionNormalizedContent).toBe("i'm Alice");
    expect(metadata.canonical?.key).toBeDefined();

    expect(result.diagnostics?.[0]?.normalizedSource).toBe("i'm alice");
    expect(result.diagnostics?.[0]?.extractionSource).toBe("i'm Alice");
    expect(result.diagnostics?.[0]?.canonicalKey).toBeDefined();
    expect(result.diagnostics?.[0]?.riskSignals).toEqual([]);
  });

  it('produces same canonical key for equivalent contraction variants', async () => {
    const { learner } = createLearnerHarness();

    const first = await learner.learn(
      { role: 'user', content: 'im Alice' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-key' },
    );

    const second = await learner.learn(
      { role: 'user', content: 'i m Alice' },
      { role: 'assistant', content: 'ok' },
      { conversationId: 'conv-key' },
    );

    const firstKey = (
      first.extracted[0]?.metadata as { canonical?: { key?: string } }
    )?.canonical?.key;
    const secondKey = (
      second.extracted[0]?.metadata as { canonical?: { key?: string } }
    )?.canonical?.key;

    expect(firstKey).toBeDefined();
    expect(secondKey).toBeDefined();
    expect(firstKey).toBe(secondKey);
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
