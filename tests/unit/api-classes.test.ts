/**
 * Unit tests for LokulMem API classes
 */

import { describe, expect, it, vi } from 'vitest';

describe('EventManager', () => {
  it('should register event handlers and return unsubscribe function', async () => {
    const { EventManager } = await import('../../src/api/EventManager.js');
    const eventManager = new EventManager();

    const handler = vi.fn();
    const unsubscribe = eventManager.on('MEMORY_ADDED', handler);

    expect(typeof unsubscribe).toBe('function');

    // Emit event
    eventManager.emit('MEMORY_ADDED', { memoryId: 'test' });

    expect(handler).toHaveBeenCalledWith({ memoryId: 'test' });

    // Unsubscribe
    unsubscribe();

    // Handler should not be called after unsubscribe
    handler.mockClear();
    eventManager.emit('MEMORY_ADDED', { memoryId: 'test2' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple handlers for same event', async () => {
    const { EventManager } = await import('../../src/api/EventManager.js');
    const eventManager = new EventManager();

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventManager.on('MEMORY_ADDED', handler1);
    eventManager.on('MEMORY_ADDED', handler2);

    eventManager.emit('MEMORY_ADDED', { memoryId: 'test' });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('should create IDs-only memory event payload by default', async () => {
    const { EventManager } = await import('../../src/api/EventManager.js');
    const eventManager = new EventManager();

    const memory = {
      id: 'mem-123',
      content: 'User prefers dark mode',
      types: ['preference'],
      status: 'active',
      createdAt: Date.now(),
      entities: [],
      pinned: false,
      currentStrength: 1.0,
      baseStrength: 1.0,
      mentionCount: 0,
      lastAccessedAt: Date.now(),
      updatedAt: Date.now(),
      validFrom: Date.now(),
      validTo: null,
      clusterId: null,
      sourceConversationIds: [],
      supersededBy: null,
      supersededAt: null,
      fadedAt: null,
      metadata: {},
    };

    const payload = eventManager.createMemoryEvent(memory);

    expect(payload.memoryId).toBe('mem-123');
    expect(payload.type).toBe('preference');
    expect(payload.status).toBe('active');
    expect(payload.content).toBeUndefined(); // No content in IDs-only mode
    expect(payload.metadata).toBeUndefined();
  });

  it('should create verbose memory event payload when enabled', async () => {
    const { EventManager } = await import('../../src/api/EventManager.js');
    const eventManager = new EventManager({ verboseEvents: true });

    const memory = {
      id: 'mem-123',
      content: 'User prefers dark mode',
      types: ['preference'],
      status: 'active',
      createdAt: Date.now(),
      entities: [],
      pinned: false,
      currentStrength: 1.0,
      baseStrength: 1.0,
      mentionCount: 0,
      lastAccessedAt: Date.now(),
      updatedAt: Date.now(),
      validFrom: Date.now(),
      validTo: null,
      clusterId: null,
      sourceConversationIds: [],
      supersededBy: null,
      supersededAt: null,
      fadedAt: null,
      metadata: { source: 'chat' },
    };

    const payload = eventManager.createMemoryEvent(memory);

    expect(payload.memoryId).toBe('mem-123');
    expect(payload.content).toBe('User prefers dark mode');
    expect(payload.metadata).toEqual({ source: 'chat' });
  });

  it('should handle handler errors without breaking emission', async () => {
    const { EventManager } = await import('../../src/api/EventManager.js');
    const eventManager = new EventManager();

    const errorHandler = vi.fn(() => {
      throw new Error('Handler error');
    });
    const normalHandler = vi.fn();

    eventManager.on('MEMORY_ADDED', errorHandler);
    eventManager.on('MEMORY_ADDED', normalHandler);

    // Emit should not throw despite error in errorHandler
    expect(() => {
      eventManager.emit('MEMORY_ADDED', { memoryId: 'test' });
    }).not.toThrow();

    // Normal handler should still be called
    expect(normalHandler).toHaveBeenCalled();
  });

  it('should provide handler count', async () => {
    const { EventManager } = await import('../../src/api/EventManager.js');
    const eventManager = new EventManager();

    expect(eventManager.handlerCount('MEMORY_ADDED')).toBe(0);

    eventManager.on('MEMORY_ADDED', vi.fn());
    eventManager.on('MEMORY_ADDED', vi.fn());

    expect(eventManager.handlerCount('MEMORY_ADDED')).toBe(2);
  });

  it('should clear all handlers', async () => {
    const { EventManager } = await import('../../src/api/EventManager.js');
    const eventManager = new EventManager();

    eventManager.on('MEMORY_ADDED', vi.fn());
    eventManager.on('MEMORY_UPDATED', vi.fn());

    expect(eventManager.handlerCount('MEMORY_ADDED')).toBe(1);
    expect(eventManager.handlerCount('MEMORY_UPDATED')).toBe(1);

    eventManager.removeAll();

    expect(eventManager.handlerCount('MEMORY_ADDED')).toBe(0);
    expect(eventManager.handlerCount('MEMORY_UPDATED')).toBe(0);
  });
});

describe('Augmenter - Structure', () => {
  it('should export Augmenter class', async () => {
    const { Augmenter } = await import('../../src/api/Augmenter.js');

    expect(Augmenter).toBeDefined();
    expect(typeof Augmenter).toBe('function');
  });

  it('should have augment method', async () => {
    const { Augmenter } = await import('../../src/api/Augmenter.js');

    // We can't fully test without dependencies, but we can check the class structure
    expect(Augmenter.prototype).toBeDefined();

    // The augment method should exist
    expect(typeof Augmenter.prototype.augment).toBe('function');
  });
});

describe('Learner - Structure', () => {
  it('should export Learner class', async () => {
    const { Learner } = await import('../../src/api/Learner.js');

    expect(Learner).toBeDefined();
    expect(typeof Learner).toBe('function');
  });

  it('should have learn method', async () => {
    const { Learner } = await import('../../src/api/Learner.js');

    expect(Learner.prototype).toBeDefined();
    expect(typeof Learner.prototype.learn).toBe('function');
  });
});

describe('Manager - Structure', () => {
  it('should export Manager class', async () => {
    const { Manager } = await import('../../src/api/Manager.js');

    expect(Manager).toBeDefined();
    expect(typeof Manager).toBe('function');
  });

  it('should have all 16+ required methods', async () => {
    const { Manager } = await import('../../src/api/Manager.js');

    const prototype = Manager.prototype;

    // Single operations
    expect(typeof prototype.update).toBe('function');
    expect(typeof prototype.pin).toBe('function');
    expect(typeof prototype.unpin).toBe('function');
    expect(typeof prototype.archive).toBe('function');
    expect(typeof prototype.unarchive).toBe('function');
    expect(typeof prototype.delete).toBe('function');

    // Bulk operations
    expect(typeof prototype.deleteMany).toBe('function');
    expect(typeof prototype.pinMany).toBe('function');
    expect(typeof prototype.unpinMany).toBe('function');
    expect(typeof prototype.archiveMany).toBe('function');
    expect(typeof prototype.unarchiveMany).toBe('function');

    // Management
    expect(typeof prototype.clear).toBe('function');
    expect(typeof prototype.stats).toBe('function');

    // Export/Import
    expect(typeof prototype.export).toBe('function');
    expect(typeof prototype.import).toBe('function');

    // Query methods
    expect(typeof prototype.list).toBe('function');
    expect(typeof prototype.get).toBe('function');
    expect(typeof prototype.getByConversation).toBe('function');
    expect(typeof prototype.getRecent).toBe('function');
    expect(typeof prototype.getTop).toBe('function');
    expect(typeof prototype.getPinned).toBe('function');
    expect(typeof prototype.search).toBe('function');
    expect(typeof prototype.semanticSearch).toBe('function');
    expect(typeof prototype.getTimeline).toBe('function');
    expect(typeof prototype.getGrouped).toBe('function');
    expect(typeof prototype.getInjectionPreview).toBe('function');
  });
});

describe('API Barrel Exports', () => {
  it('should re-export all classes from _index.ts', async () => {
    const apiModule = await import('../../src/api/_index.js');

    expect(apiModule.Augmenter).toBeDefined();
    expect(apiModule.Learner).toBeDefined();
    expect(apiModule.Manager).toBeDefined();
    expect(apiModule.EventManager).toBeDefined();
  });

  it('should have all classes as constructor functions', async () => {
    const apiModule = await import('../../src/api/_index.js');

    expect(typeof apiModule.Augmenter).toBe('function');
    expect(typeof apiModule.Learner).toBe('function');
    expect(typeof apiModule.Manager).toBe('function');
    expect(typeof apiModule.EventManager).toBe('function');
  });

  it('should verify module export structure', async () => {
    const apiModule = await import('../../src/api/_index.js');

    const exports = Object.keys(apiModule);

    // All four main API classes should be exported
    expect(exports).toContain('Augmenter');
    expect(exports).toContain('Learner');
    expect(exports).toContain('Manager');
    expect(exports).toContain('EventManager');
  });
});
