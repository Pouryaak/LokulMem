import { describe, expect, it } from 'vitest';

import { RiskValidator } from '../../src/extraction/RiskValidator.js';

describe('RiskValidator', () => {
  it('rejects highly repetitive noise', () => {
    const validator = new RiskValidator();

    const result = validator.validate({
      content: 'pizza pizza pizza pizza',
      score: 0.9,
      threshold: 0.45,
      memoryTypes: ['preference'],
      entities: [],
      canonicalization: {
        key: 'ck_1',
        subject: 'user',
        predicate: 'prefers',
        object: 'pizza',
        temporalBucket: 'unspecified',
        entities: [],
      },
    });

    expect(result.accepted).toBe(false);
    expect(result.signals).toContain('REPETITIVE_NOISE');
  });

  it('accepts structured signal with clear temporal interpretation', () => {
    const validator = new RiskValidator();

    const result = validator.validate({
      content: 'I used to live in Denver but now I live in Austin',
      score: 0.8,
      threshold: 0.45,
      memoryTypes: ['location', 'temporal'],
      entities: [
        {
          type: 'place',
          value: 'austin',
          raw: 'Austin',
          count: 1,
          canonicalId: 'ent_place_austin',
          linkReason: 'new',
        },
      ],
      canonicalization: {
        key: 'ck_2',
        subject: 'user',
        predicate: 'lives_in',
        object: 'ent_place_austin',
        temporalBucket: 'transition',
        entities: [],
      },
    });

    expect(result.accepted).toBe(true);
    expect(result.signals).toEqual([]);
  });
});
