export interface NormalizationMetadata {
  normalized: string;
  extractionNormalized: string;
  operations: string[];
}

/**
 * Normalizer applies conservative normalization with two paths:
 * - extraction path: preserves case to avoid breaking regex heuristics
 * - matching path: lowercases for robust dedupe/classification
 */
export class Normalizer {
  normalizeForMatching(text: string): string {
    return this.normalizeInternal(text, true).normalized;
  }

  normalizeForExtraction(text: string): string {
    return this.normalizeInternal(text, false).normalized;
  }

  buildNormalizationMetadata(text: string): NormalizationMetadata {
    const extraction = this.normalizeInternal(text, false);
    const matching = this.normalizeInternal(text, true);

    return {
      normalized: matching.normalized,
      extractionNormalized: extraction.normalized,
      operations: Array.from(
        new Set([...extraction.operations, ...matching.operations]),
      ),
    };
  }

  private normalizeInternal(
    text: string,
    lowerCase: boolean,
  ): { normalized: string; operations: string[] } {
    const operations: string[] = [];
    let normalized = text;

    const nfkc = normalized.normalize('NFKC');
    if (nfkc !== normalized) {
      operations.push('unicode_nfkc');
      normalized = nfkc;
    }

    const apostropheNormalized = normalized.replace(/['`\u2018\u2019]/g, "'");
    if (apostropheNormalized !== normalized) {
      operations.push('apostrophe_normalized');
      normalized = apostropheNormalized;
    }

    const whitespaceCollapsed = normalized.replace(/\s+/g, ' ').trim();
    if (whitespaceCollapsed !== normalized) {
      operations.push('whitespace_collapsed');
      normalized = whitespaceCollapsed;
    }

    if (lowerCase) {
      const lowerCased = normalized.toLowerCase();
      if (lowerCased !== normalized) {
        operations.push('lowercased');
        normalized = lowerCased;
      }
    }

    const contractionResult = this.normalizeContractions(normalized, lowerCase);
    if (contractionResult.changed) {
      operations.push('contractions_normalized');
      normalized = contractionResult.text;
    }

    return {
      normalized,
      operations,
    };
  }

  private normalizeContractions(
    text: string,
    lowerCase: boolean,
  ): { text: string; changed: boolean } {
    const patterns: Array<[RegExp, string]> = [
      [/\bi\s*m\b/gi, "i'm"],
      [/\bdont\b/gi, "don't"],
      [/\bcant\b/gi, "can't"],
      [/\bwont\b/gi, "won't"],
      [/\bdoesnt\b/gi, "doesn't"],
      [/\bdidnt\b/gi, "didn't"],
      [/\bim\b/gi, "i'm"],
      [/\bive\b/gi, "i've"],
      [/\bill\b/gi, "i'll"],
    ];

    let changed = false;
    let normalized = text;

    for (const [pattern, replacement] of patterns) {
      const next = normalized.replace(pattern, (matched) =>
        lowerCase ? replacement : this.matchCase(replacement, matched),
      );

      if (next !== normalized) {
        changed = true;
        normalized = next;
      }
    }

    return { text: normalized, changed };
  }

  private matchCase(replacement: string, original: string): string {
    if (original === original.toUpperCase()) {
      return replacement.toUpperCase();
    }

    if (original[0] === original[0]?.toUpperCase()) {
      return `${replacement[0]?.toUpperCase() ?? ''}${replacement.slice(1)}`;
    }

    return replacement;
  }
}
