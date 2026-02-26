/**
 * Unit tests for LokulMem API types
 */

import { describe, expect, it } from 'vitest';

describe('API Types - Augment', () => {
  it('should have ChatMessage interface with required fields', async () => {
    // Import types to verify they exist
    const typesModule = await import('../../src/api/types.js');

    const message: typesModule.ChatMessage = {
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: Date.now(),
    };

    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello, how are you?');
    expect(message.timestamp).toBeDefined();
  });

  it('should support all message roles', async () => {
    const typesModule = await import('../../src/api/types.js');

    const userMessage: typesModule.ChatMessage = {
      role: 'user',
      content: 'test',
    };
    const assistantMessage: typesModule.ChatMessage = {
      role: 'assistant',
      content: 'test',
    };
    const systemMessage: typesModule.ChatMessage = {
      role: 'system',
      content: 'test',
    };

    expect(userMessage.role).toBe('user');
    expect(assistantMessage.role).toBe('assistant');
    expect(systemMessage.role).toBe('system');
  });

  it('should have AugmentOptions with correct fields', async () => {
    const typesModule = await import('../../src/api/types.js');

    const options: typesModule.AugmentOptions = {
      contextWindowTokens: 8192,
      reservedForResponseTokens: 512,
      maxTokens: 4000,
      debug: true,
    };

    expect(options.contextWindowTokens).toBe(8192);
    expect(options.reservedForResponseTokens).toBe(512);
    expect(options.maxTokens).toBe(4000);
    expect(options.debug).toBe(true);
  });

  it('should have AugmentResult with metadata structure', async () => {
    const typesModule = await import('../../src/api/types.js');

    const result: typesModule.AugmentResult = {
      messages: [
        { role: 'system', content: 'Memory context' },
        { role: 'user', content: 'Hello' },
      ],
      metadata: {
        injectedCount: 3,
        noMemoriesFound: false,
        usedTokensBeforeInjection: 100,
        injectionTokens: 200,
        remainingTokensAfterInjection: 7500,
      },
    };

    expect(result.messages).toHaveLength(2);
    expect(result.metadata.injectedCount).toBe(3);
    expect(result.metadata.noMemoriesFound).toBe(false);
  });

  it('should have LokulMemDebug interface with all fields', async () => {
    const typesModule = await import('../../src/api/types.js');

    const debug: typesModule.LokulMemDebug = {
      injectedMemories: [],
      scores: [],
      excludedCandidates: [],
      tokenUsage: {
        prompt: 1000,
        completion: 500,
        total: 1500,
      },
      latencyMs: 150,
    };

    expect(debug.tokenUsage.total).toBe(1500);
    expect(debug.latencyMs).toBe(150);
  });
});

describe('API Types - Learn', () => {
  it('should have LearnOptions with all configuration options', async () => {
    const typesModule = await import('../../src/api/types.js');

    const options: typesModule.LearnOptions = {
      conversationId: 'conv-123',
      extractFrom: 'both',
      runMaintenance: true,
      learnThreshold: 0.6,
      autoAssociate: true,
      storeResponse: true,
      verbose: true,
    };

    expect(options.conversationId).toBe('conv-123');
    expect(options.extractFrom).toBe('both');
    expect(options.runMaintenance).toBe(true);
  });

  it('should have LearnResult with extraction data', async () => {
    const typesModule = await import('../../src/api/types.js');

    const result: typesModule.LearnResult = {
      extracted: [],
      contradictions: [],
      maintenance: {
        faded: 0,
        deleted: 0,
      },
      conversationId: 'conv-123',
    };

    expect(result.extracted).toEqual([]);
    expect(result.contradictions).toEqual([]);
    expect(result.conversationId).toBe('conv-123');
  });
});

describe('API Types - Management', () => {
  it('should have BulkOperationResult interface', async () => {
    const typesModule = await import('../../src/api/types.js');

    const result: typesModule.BulkOperationResult = {
      succeeded: ['id1', 'id2'],
      failed: [{ id: 'id3', error: 'Not found' }],
      total: 3,
      counts: {
        succeeded: 2,
        failed: 1,
      },
    };

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.total).toBe(3);
  });

  it('should have SingleOperationResult interface', async () => {
    const typesModule = await import('../../src/api/types.js');

    const result: typesModule.SingleOperationResult = {
      id: 'mem-123',
      status: 'updated',
    };

    expect(result.id).toBe('mem-123');
    expect(result.status).toBe('updated');
  });

  it('should have ExportFormat and ImportMode types', async () => {
    const typesModule = await import('../../src/api/types.js');

    const jsonFormat: typesModule.ExportFormat = 'json';
    const markdownFormat: typesModule.ExportFormat = 'markdown';

    const replaceMode: typesModule.ImportMode = 'replace';
    const mergeMode: typesModule.ImportMode = 'merge';

    expect(jsonFormat).toBe('json');
    expect(markdownFormat).toBe('markdown');
    expect(replaceMode).toBe('replace');
    expect(mergeMode).toBe('merge');
  });

  it('should have ImportResult interface', async () => {
    const typesModule = await import('../../src/api/types.js');

    const result: typesModule.ImportResult = {
      imported: 10,
      skipped: 2,
      errors: 0,
    };

    expect(result.imported).toBe(10);
    expect(result.skipped).toBe(2);
    expect(result.errors).toBe(0);
  });

  it('should have ClearResult interface', async () => {
    const typesModule = await import('../../src/api/types.js');

    const result: typesModule.ClearResult = {
      status: 'cleared',
      count: 42,
    };

    expect(result.status).toBe('cleared');
    expect(result.count).toBe(42);
  });
});

describe('API Types - Events', () => {
  it('should have EventConfig interface', async () => {
    const typesModule = await import('../../src/api/types.js');

    const config: typesModule.EventConfig = {
      verboseEvents: true,
    };

    expect(config.verboseEvents).toBe(true);
  });

  it('should have MemoryEventPayload with IDs-only fields', async () => {
    const typesModule = await import('../../src/api/types.js');

    const payload: typesModule.MemoryEventPayload = {
      memoryId: 'mem-123',
      timestamp: Date.now(),
      type: 'preference',
      status: 'active',
    };

    expect(payload.memoryId).toBe('mem-123');
    expect(payload.type).toBe('preference');
    expect(payload.status).toBe('active');
    // Note: embedding field should NOT exist (per CONTEXT decision)
    expect('embedding' in payload).toBe(false);
  });

  it('should have MemoryEventPayload with verbose fields', async () => {
    const typesModule = await import('../../src/api/types.js');

    const payload: typesModule.MemoryEventPayload = {
      memoryId: 'mem-123',
      timestamp: Date.now(),
      type: 'preference',
      status: 'active',
      content: 'User prefers dark mode',
      metadata: { source: 'chat' },
    };

    expect(payload.content).toBe('User prefers dark mode');
    expect(payload.metadata).toEqual({ source: 'chat' });
  });

  it('should have StatsChangedPayload interface', async () => {
    const typesModule = await import('../../src/api/types.js');

    const payload: typesModule.StatsChangedPayload = {
      stats: {
        totalMemories: 100,
        activeMemories: 80,
        fadedMemories: 20,
        pinnedMemories: 5,
        averageStrength: 0.75,
        oldestMemoryAt: Date.now() - 1000000,
        newestMemoryAt: Date.now(),
      },
      timestamp: Date.now(),
    };

    expect(payload.stats.totalMemories).toBe(100);
    expect(payload.stats.activeMemories).toBe(80);
  });

  it('should have EventType union with all 7 event types', async () => {
    const typesModule = await import('../../src/api/types.js');

    const eventTypes: typesModule.EventType[] = [
      'MEMORY_ADDED',
      'MEMORY_UPDATED',
      'MEMORY_DELETED',
      'MEMORY_FADED',
      'STATS_CHANGED',
      'CONTRADICTION_DETECTED',
      'MEMORY_SUPERSEDED',
    ];

    expect(eventTypes).toHaveLength(7);
    expect(eventTypes).toContain('MEMORY_ADDED');
    expect(eventTypes).toContain('STATS_CHANGED');
  });
});

describe('API Types - Type Exports', () => {
  it('should export all API classes from api/_index.ts', async () => {
    const apiModule = await import('../../src/api/_index.js');

    // Classes should be exported (not just types)
    expect(apiModule.Augmenter).toBeDefined();
    expect(apiModule.Learner).toBeDefined();
    expect(apiModule.Manager).toBeDefined();
    expect(apiModule.EventManager).toBeDefined();
  });

  it('should have all API classes as functions', async () => {
    const apiModule = await import('../../src/api/_index.js');

    // Classes are functions at runtime
    expect(typeof apiModule.Augmenter).toBe('function');
    expect(typeof apiModule.Learner).toBe('function');
    expect(typeof apiModule.Manager).toBe('function');
    expect(typeof apiModule.EventManager).toBe('function');
  });

  it('should verify API exports structure', async () => {
    const apiModule = await import('../../src/api/_index.js');

    // Check that the module has expected exports
    const exportKeys = Object.keys(apiModule);

    // Should have class exports
    expect(exportKeys).toContain('Augmenter');
    expect(exportKeys).toContain('Learner');
    expect(exportKeys).toContain('Manager');
    expect(exportKeys).toContain('EventManager');
  });
});
