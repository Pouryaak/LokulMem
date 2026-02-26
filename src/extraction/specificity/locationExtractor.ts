import type { Entity } from '../../types/memory.js';
import {
  LOCATION_COMPANY_BLOCKLIST,
  LOCATION_IDIOM_BLOCKLIST,
  LOCATION_KNOWN_TERMS,
  LOCATION_PATTERNS,
  type LocationPatternKind,
} from '../patterns/locationPatterns.js';
import { normalizeLocationValue } from './commonTokens.js';

export function extractPlaces(
  content: string,
  isCommonWord: (word: string) => boolean,
  isTemporalToken: (word: string) => boolean,
): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  for (const locationPattern of LOCATION_PATTERNS) {
    const matches = content.matchAll(locationPattern.pattern);
    for (const match of matches) {
      const primary = (match[locationPattern.primaryGroup] ?? '').trim();
      if (
        primary &&
        isValidLocationCandidate(
          primary,
          locationPattern.kind,
          match[0] ?? '',
          isCommonWord,
          isTemporalToken,
        )
      ) {
        const normalizedPrimary = normalizeLocationValue(primary);
        if (!seen.has(normalizedPrimary)) {
          seen.add(normalizedPrimary);
          entities.push({
            type: 'place',
            value: normalizedPrimary,
            raw: primary,
            count: 1,
            confidence: locationPattern.confidence,
          });
        }
      }

      const secondary =
        locationPattern.secondaryGroup !== undefined
          ? (match[locationPattern.secondaryGroup] ?? '').trim()
          : '';
      if (
        secondary &&
        isValidLocationCandidate(
          secondary,
          locationPattern.kind,
          match[0] ?? '',
          isCommonWord,
          isTemporalToken,
        )
      ) {
        const normalizedSecondary = normalizeLocationValue(secondary);
        if (!seen.has(normalizedSecondary)) {
          seen.add(normalizedSecondary);
          entities.push({
            type: 'place',
            value: normalizedSecondary,
            raw: secondary,
            count: 1,
            confidence: Math.max(0.72, locationPattern.confidence - 0.06),
          });
        }
      }
    }
  }

  return entities;
}

function isValidLocationCandidate(
  value: string,
  kind: LocationPatternKind,
  fullMatch: string,
  isCommonWord: (word: string) => boolean,
  isTemporalToken: (word: string) => boolean,
): boolean {
  const normalized = normalizeLocationValue(value);
  if (!normalized) return false;
  if (normalized.length < 2 || normalized.length > 40) return false;

  if (
    isCommonWord(normalized) ||
    isTemporalToken(normalized) ||
    LOCATION_COMPANY_BLOCKLIST.has(normalized)
  ) {
    return false;
  }

  const idioms = LOCATION_IDIOM_BLOCKLIST[kind];
  if (idioms.some((token) => normalized === token)) return false;

  const loweredFullMatch = fullMatch.toLowerCase();
  if (
    kind === 'workLocation' &&
    /\b(work\s+in\s+tech|work\s+in\s+finance|work\s+in\s+sales|work\s+in\s+marketing)\b/.test(
      loweredFullMatch,
    )
  ) {
    return false;
  }

  if (LOCATION_KNOWN_TERMS.has(normalized)) return true;
  return /^[a-z][a-z\s'-]{1,40}$/.test(normalized);
}
