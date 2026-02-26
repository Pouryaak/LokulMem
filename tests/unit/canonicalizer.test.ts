import { describe, expect, it } from 'vitest';

import { Canonicalizer } from '../../src/extraction/Canonicalizer.js';

describe('Canonicalizer', () => {
  it('produces stable key regardless of entity order', () => {
    const canonicalizer = new Canonicalizer();

    const a = canonicalizer.canonicalize({
      content: "i'm alice in austin",
      entities: [
        { type: 'place', value: 'Austin' },
        { type: 'person', value: 'Alice' },
      ],
      memoryTypes: ['identity'],
      scope: { conversationId: 'conv-1' },
    });

    const b = canonicalizer.canonicalize({
      content: "i'm alice in austin",
      entities: [
        { type: 'person', value: 'Alice' },
        { type: 'place', value: 'Austin' },
      ],
      memoryTypes: ['identity'],
      scope: { conversationId: 'conv-1' },
    });

    expect(a.key).toBe(b.key);
  });

  it('uses all entities for canonical object signature', () => {
    const canonicalizer = new Canonicalizer();

    const result = canonicalizer.canonicalize({
      content: 'I live in Sydney, Australia',
      entities: [
        { type: 'place', value: 'Sydney' },
        { type: 'place', value: 'Australia' },
      ],
      memoryTypes: ['location'],
      scope: { conversationId: 'conv-places' },
    });

    expect(result.object).toContain('place:sydney');
    expect(result.object).toContain('place:australia');
  });

  it('prefers linked canonical IDs in object signature', () => {
    const canonicalizer = new Canonicalizer();

    const result = canonicalizer.canonicalize({
      content: 'Sarah likes tea',
      entities: [
        {
          type: 'person',
          value: 'Sarah',
          canonicalId: 'ent_person_abc',
        },
      ],
      memoryTypes: ['preference'],
      scope: { conversationId: 'conv-link' },
    });

    expect(result.object).toBe('ent_person_abc');
  });

  it('infers transition temporal bucket from temporal change phrasing', () => {
    const canonicalizer = new Canonicalizer();
    const result = canonicalizer.canonicalize({
      content: 'i used to live in denver but now i live in austin',
      entities: [],
      memoryTypes: ['location'],
    });

    expect(result.temporalBucket).toBe('transition');
  });

  it('infers future temporal bucket for planned statements', () => {
    const canonicalizer = new Canonicalizer();
    const result = canonicalizer.canonicalize({
      content: 'I am planning to move to Berlin next month',
      entities: [],
      memoryTypes: ['location'],
    });

    expect(result.temporalBucket).toBe('future');
  });
});
