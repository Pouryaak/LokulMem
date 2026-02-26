import { describe, expect, it } from 'vitest';

import { Normalizer } from '../../src/extraction/Normalizer.js';

describe('Normalizer', () => {
  it('normalizes common contraction variants for matching', () => {
    const normalizer = new Normalizer();

    expect(normalizer.normalizeForMatching('im Alice')).toBe("i'm alice");
    expect(normalizer.normalizeForMatching('i m Alice')).toBe("i'm alice");
    expect(normalizer.normalizeForMatching("I'm Alice")).toBe("i'm alice");
  });

  it('returns metadata with operation trace', () => {
    const normalizer = new Normalizer();

    const metadata = normalizer.buildNormalizationMetadata('  Im  Alice  ');

    expect(metadata.normalized).toBe("i'm alice");
    expect(metadata.extractionNormalized).toBe("I'm Alice");
    expect(metadata.operations).toContain('whitespace_collapsed');
    expect(metadata.operations).toContain('lowercased');
    expect(metadata.operations).toContain('contractions_normalized');
  });

  it('keeps case in extraction normalization to preserve regex heuristics', () => {
    const normalizer = new Normalizer();

    expect(normalizer.normalizeForExtraction('Im Alice')).toBe("I'm Alice");
    expect(normalizer.normalizeForExtraction('i m Alice')).toBe("i'm Alice");
  });
});
