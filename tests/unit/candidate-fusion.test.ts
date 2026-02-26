import { describe, expect, it } from 'vitest';

import { CandidateFusion } from '../../src/extraction/CandidateFusion.js';

describe('CandidateFusion', () => {
  it('keeps deterministic candidate on agreement', () => {
    const fusion = new CandidateFusion();

    const decisions = fusion.calibrate([
      {
        source: 'deterministic',
        canonicalKey: 'ck_1',
        score: 0.5,
        threshold: 0.45,
        accepted: true,
      },
      {
        source: 'fallback',
        canonicalKey: 'ck_1',
        score: 0.52,
        threshold: 0.45,
        accepted: true,
      },
    ]);

    expect(decisions).toEqual([
      {
        canonicalKey: 'ck_1',
        accepted: true,
        source: 'deterministic',
        agreement: true,
      },
    ]);
  });

  it('requires stricter threshold for fallback-only candidates', () => {
    const fusion = new CandidateFusion();

    const conservative = fusion.calibrate([
      {
        source: 'fallback',
        canonicalKey: 'ck_2',
        score: 0.5,
        threshold: 0.45,
        accepted: true,
      },
    ]);
    const accepted = fusion.calibrate([
      {
        source: 'fallback',
        canonicalKey: 'ck_3',
        score: 0.57,
        threshold: 0.45,
        accepted: true,
      },
    ]);

    expect(conservative[0]?.accepted).toBe(false);
    expect(accepted[0]?.accepted).toBe(true);
  });
});
