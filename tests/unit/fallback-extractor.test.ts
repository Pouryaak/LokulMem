import { describe, expect, it, vi } from 'vitest';

import {
  ChainedFallbackExtractor,
  type FallbackExtractor,
  PatternFallbackExtractor,
  WebLLMFallbackExtractor,
} from '../../src/extraction/FallbackExtractor.js';

describe('PatternFallbackExtractor', () => {
  it('extracts structured fallback facts from weakly phrased input', async () => {
    const extractor = new PatternFallbackExtractor();

    const result = await extractor.extract({
      source: 'Call me Alice. I moved to Berlin and I work as designer.',
      conversationId: 'conv-fallback',
    });

    const texts = result.facts.map((fact) => fact.text);
    expect(result.provider).toBe('pattern');
    expect(texts).toContain('My name is Alice');
    expect(texts).toContain('I live in Berlin and I work as designer');
    expect(texts).toContain('I work as designer');
  });

  it('deduplicates equivalent extracted facts', async () => {
    const extractor = new PatternFallbackExtractor();

    const result = await extractor.extract({
      source: 'Call me Alice, my name is Alice',
      conversationId: 'conv-dedupe',
    });

    const names = result.facts.filter((fact) =>
      fact.text.toLowerCase().includes('my name is alice'),
    );
    expect(names).toHaveLength(1);
    expect(result.provider).toBe('pattern');
  });
});

describe('WebLLMFallbackExtractor', () => {
  it('parses strict json response into fallback facts', async () => {
    const createEngine = vi.fn(async () => ({
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [
              {
                message: {
                  content: '{"facts":["Name is Alice","Lives in Austin"]}',
                },
              },
            ],
          })),
        },
      },
    }));

    const extractor = new WebLLMFallbackExtractor(
      {
        enabled: true,
        provider: 'webllm',
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      },
      createEngine,
    );

    const result = await extractor.extract({
      source: 'Call me Alice and I live in Austin',
      conversationId: 'conv-llm',
    });

    expect(createEngine).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('webllm');
    expect(result.facts.map((fact) => fact.text)).toEqual([
      'Name is Alice',
      'Lives in Austin',
    ]);
  });

  it('handles fenced json output robustly', async () => {
    const createEngine = vi.fn(async () => ({
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [
              {
                message: {
                  content:
                    '```json\n{"facts":["Prefers tea","Works as designer"]}\n```',
                },
              },
            ],
          })),
        },
      },
    }));

    const extractor = new WebLLMFallbackExtractor(
      {
        enabled: true,
        provider: 'webllm',
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      },
      createEngine,
    );

    const result = await extractor.extract({
      source: 'I prefer tea and I work as designer',
      conversationId: 'conv-llm-fenced',
    });

    expect(result.facts.map((fact) => fact.text)).toEqual([
      'Prefers tea',
      'Works as designer',
    ]);
    expect(result.provider).toBe('webllm');
  });

  it('extracts json object from noisy model output', async () => {
    const createEngine = vi.fn(async () => ({
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [
              {
                message: {
                  content:
                    'Sure, here you go: {"facts":["My name is Pourya","I am married"]} Thanks!',
                },
              },
            ],
          })),
        },
      },
    }));

    const extractor = new WebLLMFallbackExtractor(
      {
        enabled: true,
        provider: 'webllm',
        model: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
      },
      createEngine,
    );

    const result = await extractor.extract({
      source: 'Im Pourya and I am married',
      conversationId: 'conv-llm-noisy',
    });

    expect(result.provider).toBe('webllm');
    expect(result.error).toBeUndefined();
    expect(result.facts.map((fact) => fact.text)).toEqual([
      'My name is Pourya',
      'I am married',
    ]);
  });

  it('returns empty facts when engine creation fails', async () => {
    const extractor = new WebLLMFallbackExtractor(
      {
        enabled: true,
        provider: 'webllm',
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      },
      async () => null,
    );

    const result = await extractor.extract({
      source: 'Call me Alice',
      conversationId: 'conv-engine-fail',
    });

    expect(result.facts).toEqual([]);
    expect(result.provider).toBe('webllm');
    expect(result.error).toBe('engine_unavailable');
  });

  it('surfaces engine creation error details', async () => {
    const extractor = new WebLLMFallbackExtractor(
      {
        enabled: true,
        provider: 'webllm',
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      },
      async () => {
        throw new Error('failed to resolve module specifier');
      },
    );

    const result = await extractor.extract({
      source: 'Call me Alice',
      conversationId: 'conv-engine-throw',
    });

    expect(result.facts).toEqual([]);
    expect(result.provider).toBe('webllm');
    expect(result.error).toBe(
      'engine_unavailable:failed to resolve module specifier',
    );
  });
});

describe('ChainedFallbackExtractor', () => {
  it('falls back to pattern extraction when webllm is unavailable', async () => {
    const primary = new WebLLMFallbackExtractor(
      {
        enabled: true,
        provider: 'webllm',
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      },
      async () => null,
    );
    const chained = new ChainedFallbackExtractor(
      primary,
      new PatternFallbackExtractor(),
    );

    const result = await chained.extract({
      source: 'Call me Alice',
      conversationId: 'conv-chain',
    });

    expect(result.provider).toBe('pattern');
    expect(result.facts.map((fact) => fact.text)).toContain('My name is Alice');
    expect(result.error).toContain('upstream:engine_unavailable');
  });

  it('preserves upstream webllm context when webllm returns no facts', async () => {
    const primary: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [],
        provider: 'webllm' as const,
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      })),
    };

    const chained = new ChainedFallbackExtractor(
      primary,
      new PatternFallbackExtractor(),
    );

    const result = await chained.extract({
      source: 'Call me Alice',
      conversationId: 'conv-chain-empty-webllm',
    });

    expect(result.provider).toBe('pattern');
    expect(result.model).toBe('Llama-3.2-1B-Instruct-q4f32_1-MLC');
    expect(result.error).toBe('upstream:no_facts');
  });

  it('returns webllm no_facts when both extractors return empty', async () => {
    const primary: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [],
        provider: 'webllm' as const,
        model: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
      })),
    };
    const secondary: FallbackExtractor = {
      extract: vi.fn(async () => ({
        facts: [],
        provider: 'pattern' as const,
      })),
    };

    const chained = new ChainedFallbackExtractor(primary, secondary);
    const result = await chained.extract({
      source: 'I am happy',
      conversationId: 'conv-chain-both-empty',
    });

    expect(result.provider).toBe('webllm');
    expect(result.model).toBe('Llama-3.2-1B-Instruct-q4f32_1-MLC');
    expect(result.error).toBe('no_facts');
  });
});
