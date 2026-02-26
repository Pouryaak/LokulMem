import type { FallbackLLMConfig } from '../types/api.js';
import {
  buildUserFactExtractionSystemPrompt,
  buildUserFactExtractionUserPrompt,
} from './FallbackPrompts.js';

export interface FallbackExtractionInput {
  source: string;
  conversationId: string;
}

export interface FallbackExtractionFact {
  text: string;
  confidence: number;
}

export interface FallbackExtractionResult {
  facts: FallbackExtractionFact[];
  provider: 'pattern' | 'webllm' | 'noop';
  model?: string;
  error?: string;
}

export interface FallbackExtractor {
  extract(input: FallbackExtractionInput): Promise<FallbackExtractionResult>;
}

export class ChainedFallbackExtractor implements FallbackExtractor {
  constructor(
    private readonly primary: FallbackExtractor,
    private readonly secondary: FallbackExtractor,
  ) {}

  async extract(
    input: FallbackExtractionInput,
  ): Promise<FallbackExtractionResult> {
    const primaryResult = await this.primary.extract(input);
    if (primaryResult.facts.length > 0) {
      return primaryResult;
    }

    const secondaryResult = await this.secondary.extract(input);
    if (secondaryResult.facts.length > 0) {
      const upstreamModel =
        primaryResult.provider === 'webllm' ? primaryResult.model : undefined;
      const upstreamError =
        primaryResult.error ??
        (primaryResult.provider === 'webllm' ? 'no_facts' : undefined);
      return {
        ...secondaryResult,
        ...(upstreamModel !== undefined && { model: upstreamModel }),
        ...(upstreamError !== undefined && {
          error: `upstream:${upstreamError}`,
        }),
      };
    }

    if (primaryResult.provider === 'webllm') {
      return {
        ...primaryResult,
        ...(primaryResult.error === undefined && { error: 'no_facts' }),
      };
    }

    return primaryResult.error ? primaryResult : secondaryResult;
  }
}

interface WebLLMChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null | Array<{ type?: string; text?: string }>;
    };
  }>;
}

export class PatternFallbackExtractor implements FallbackExtractor {
  async extract(
    input: FallbackExtractionInput,
  ): Promise<FallbackExtractionResult> {
    const source = input.source.trim();
    if (source.length === 0) {
      return { facts: [], provider: 'pattern' };
    }

    const candidates: FallbackExtractionFact[] = [];

    const nameMatch = source.match(
      /(?:my\s+name\s+is|i\s+go\s+by|call\s+me)\s+([^.!?,]+)/i,
    );
    if (nameMatch?.[1]) {
      candidates.push({
        text: `My name is ${nameMatch[1].trim()}`,
        confidence: 0.86,
      });
    }

    const locationMatch = source.match(
      /(?:i\s+live\s+in|i\s+moved\s+to|i\s+am\s+based\s+in)\s+([^.!?,]+)/i,
    );
    if (locationMatch?.[1]) {
      candidates.push({
        text: `I live in ${locationMatch[1].trim()}`,
        confidence: 0.82,
      });
    }

    const preferenceMatch = source.match(
      /(?:my\s+favorite\s+[^\s]+\s+is|i\s+prefer)\s+([^.!?,]+)/i,
    );
    if (preferenceMatch?.[1]) {
      candidates.push({
        text: `I prefer ${preferenceMatch[1].trim()}`,
        confidence: 0.78,
      });
    }

    const professionMatch = source.match(
      /(?:i\s+work\s+as|i\s+am\s+a|i\s+work\s+at)\s+([^.!?,]+)/i,
    );
    if (professionMatch?.[1]) {
      candidates.push({
        text: `I work as ${professionMatch[1].trim()}`,
        confidence: 0.75,
      });
    }

    return { facts: dedupeFacts(candidates), provider: 'pattern' };
  }
}

interface WebLLMEngineLike {
  chat: {
    completions: {
      create(payload: {
        messages: Array<{ role: 'system' | 'user'; content: string }>;
        temperature?: number;
        max_tokens?: number;
        top_p?: number;
      }): Promise<WebLLMChatCompletionResponse>;
    };
  };
}

type CreateEngine = (
  config: FallbackLLMConfig,
) => Promise<WebLLMEngineLike | null>;

export class WebLLMFallbackExtractor implements FallbackExtractor {
  private enginePromise: Promise<WebLLMEngineLike | null> | null = null;
  private engineInitError: string | undefined;

  constructor(
    private readonly config: FallbackLLMConfig,
    private readonly createEngine: CreateEngine = createWebLLMEngine,
  ) {}

  async extract(
    input: FallbackExtractionInput,
  ): Promise<FallbackExtractionResult> {
    if (this.config.enabled === false) {
      return { facts: [], provider: 'webllm', model: this.config.model };
    }

    if (!this.config.model.trim()) {
      return {
        facts: [],
        provider: 'webllm',
        model: this.config.model,
        error: 'missing_model',
      };
    }

    const engine = await this.getEngine();
    if (!engine) {
      return {
        facts: [],
        provider: 'webllm',
        model: this.config.model,
        error: this.engineInitError ?? 'engine_unavailable',
      };
    }

    try {
      const response = await withTimeout(
        engine.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: buildUserFactExtractionSystemPrompt(),
            },
            {
              role: 'user',
              content: buildUserFactExtractionUserPrompt(input.source),
            },
          ],
          temperature: this.config.temperature ?? 0,
          ...(this.config.maxTokens !== undefined && {
            max_tokens: this.config.maxTokens,
          }),
          ...(this.config.topP !== undefined && {
            top_p: this.config.topP,
          }),
        }),
        this.config.timeoutMs ?? 12000,
      );

      const content = normalizeMessageContent(
        response.choices?.[0]?.message?.content,
      );
      if (!content) {
        return {
          facts: [],
          provider: 'webllm',
          model: this.config.model,
          error: 'empty_response',
        };
      }

      const parsedFacts = extractFactsFromContent(content);
      return {
        facts: dedupeFacts(
          parsedFacts.map((text) => ({
            text,
            confidence: 0.74,
          })),
        ),
        provider: 'webllm',
        model: this.config.model,
      };
    } catch (error) {
      return {
        facts: [],
        provider: 'webllm',
        model: this.config.model,
        error: error instanceof Error ? error.message : 'fallback_failed',
      };
    }
  }

  private async getEngine(): Promise<WebLLMEngineLike | null> {
    if (!this.enginePromise) {
      this.enginePromise = this.createEngine(this.config);
    }
    try {
      const engine = await this.enginePromise;
      if (!engine && !this.engineInitError) {
        this.engineInitError = 'engine_unavailable';
      }
      return engine;
    } catch (error) {
      this.engineInitError =
        error instanceof Error
          ? `engine_unavailable:${error.message}`
          : 'engine_unavailable';
      return null;
    }
  }
}

export class NoopFallbackExtractor implements FallbackExtractor {
  async extract(): Promise<FallbackExtractionResult> {
    return { facts: [], provider: 'noop' };
  }
}

function dedupeFacts(
  facts: FallbackExtractionFact[],
): FallbackExtractionFact[] {
  if (facts.length === 0) {
    return [];
  }

  const deduped = new Map<string, FallbackExtractionFact>();
  for (const fact of facts) {
    const normalized = fact.text.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || fact.confidence > existing.confidence) {
      deduped.set(key, {
        text: normalized,
        confidence: fact.confidence,
      });
    }
  }

  return Array.from(deduped.values());
}

function extractFactsFromContent(content: string): string[] {
  const withoutFences = stripCodeFences(content);

  const direct = safeParseFacts(withoutFences);
  if (direct) {
    return direct;
  }

  const extractedJson = extractFirstJsonObject(withoutFences);
  if (!extractedJson) {
    return [];
  }

  return safeParseFacts(extractedJson) ?? [];
}

function normalizeMessageContent(
  content: string | null | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (!content) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((item) => item.text ?? '')
    .join('\n')
    .trim();
}

function safeParseFacts(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw) as { facts?: unknown };
    if (!Array.isArray(parsed.facts)) {
      return [];
    }
    return parsed.facts
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return null;
  }
}

function stripCodeFences(value: string): string {
  return value
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function extractFirstJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return value.slice(start, end + 1);
}

async function createWebLLMEngine(
  config: FallbackLLMConfig,
): Promise<WebLLMEngineLike | null> {
  if (typeof navigator !== 'undefined' && !('gpu' in navigator)) {
    throw new Error('webgpu_unavailable');
  }

  const model = config.model.trim();
  if (!model) {
    throw new Error('missing_model');
  }

  const mod = (await import('@mlc-ai/web-llm')) as {
    CreateMLCEngine?: (
      model: string,
      options?: { appConfig?: unknown },
    ) => Promise<WebLLMEngineLike>;
  };

  if (!mod.CreateMLCEngine) {
    throw new Error('create_engine_unavailable');
  }

  return await mod.CreateMLCEngine(model, {
    ...(config.appConfig !== undefined && { appConfig: config.appConfig }),
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('fallback timeout')),
      timeoutMs,
    );
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}
