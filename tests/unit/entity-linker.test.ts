import { describe, expect, it } from 'vitest';

import { EntityLinker } from '../../src/extraction/EntityLinker.js';

describe('EntityLinker', () => {
  it('reuses canonical ID for exact mention matches', () => {
    const linker = new EntityLinker();

    const first = linker.resolve(
      [
        {
          type: 'person',
          value: 'alice',
          raw: 'Alice',
          count: 1,
        },
      ],
      { conversationId: 'conv-1' },
    );

    const second = linker.resolve(
      [
        {
          type: 'person',
          value: 'alice',
          raw: 'alice',
          count: 1,
        },
      ],
      { conversationId: 'conv-1' },
    );

    expect(first[0]?.canonicalId).toBe(second[0]?.canonicalId);
    expect(second[0]?.linkReason).toBe('exact');
  });

  it('matches minor typo variations using fuzzy linking', () => {
    const linker = new EntityLinker();

    const first = linker.resolve(
      [
        {
          type: 'person',
          value: 'sarah',
          raw: 'Sarah',
          count: 1,
        },
      ],
      { conversationId: 'conv-2' },
    );

    const second = linker.resolve(
      [
        {
          type: 'person',
          value: 'sarha',
          raw: 'Sarha',
          count: 1,
        },
      ],
      { conversationId: 'conv-2' },
    );

    expect(first[0]?.canonicalId).toBe(second[0]?.canonicalId);
    expect(second[0]?.linkReason).toBe('fuzzy');
  });
});
