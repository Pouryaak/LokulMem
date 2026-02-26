import {
  IDENTITY_PATTERNS,
  type IdentityPatternKind,
  LANGUAGE_ALLOWLIST,
} from '../patterns/identityPatterns.js';

export interface IdentitySignal {
  kind: IdentityPatternKind;
  value: string;
  confidence: number;
}

export function extractIdentitySignals(content: string): IdentitySignal[] {
  const signals: IdentitySignal[] = [];
  const seen = new Set<string>();

  for (const { pattern, group, kind, confidence } of IDENTITY_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const captured = (match[group] ?? '').trim();
      if (!captured) continue;

      const normalized = captured.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!isValidIdentitySignal(kind, normalized, match[0] ?? '')) continue;

      const key = `${kind}:${normalized}`;
      if (seen.has(key)) continue;
      seen.add(key);

      signals.push({ kind, value: normalized, confidence });
    }
  }

  return signals;
}

function isValidIdentitySignal(
  kind: IdentityPatternKind,
  value: string,
  fullMatch: string,
): boolean {
  if (!value) return false;

  if (kind === 'age') {
    const age = Number(value);
    return Number.isInteger(age) && age >= 5 && age <= 120;
  }

  if (kind === 'childrenCount') {
    const count = Number(value);
    return Number.isInteger(count) && count >= 0 && count <= 20;
  }

  if (kind === 'relationshipStatus') {
    return !/married\s+to\s+(?:my\s+)?work/.test(fullMatch.toLowerCase());
  }

  if (kind === 'parentalStatus') {
    return !/\b(?:figure|hen)\b/.test(value);
  }

  if (kind === 'nativeLanguage') {
    return LANGUAGE_ALLOWLIST.has(value);
  }

  return kind === 'pronouns' || kind === 'ageRange';
}
