import type { Entity } from '../../types/memory.js';
import {
  PREFERENCE_FALSE_POSITIVE_PATTERNS,
  PREFERENCE_INVALID_SUBJECTS,
  PREFERENCE_KNOWN_CATEGORIES,
  PREFERENCE_PATTERNS,
  type PreferencePatternKind,
  type PreferenceSentiment,
} from '../patterns/preferencePatterns.js';

export interface PreferenceSignal {
  kind: PreferencePatternKind;
  sentiment: PreferenceSentiment;
  subject: string;
  confidence: number;
  category?: string;
  compareAgainst?: string;
}

export function extractPreferenceSignals(content: string): {
  signals: PreferenceSignal[];
  preferenceEntities: Entity[];
  comparisonEntities: Entity[];
} {
  const signals: PreferenceSignal[] = [];
  const preferenceEntities: Entity[] = [];
  const comparisonEntities: Entity[] = [];
  const seenSignals = new Set<string>();
  const seenPreferenceEntities = new Set<string>();
  const seenComparisonEntities = new Set<string>();

  for (const preferencePattern of PREFERENCE_PATTERNS) {
    for (const match of content.matchAll(preferencePattern.pattern)) {
      const fullMatch = (match[0] ?? '').trim();
      if (!fullMatch) continue;

      if (isFalsePositive(fullMatch, preferencePattern.kind)) {
        continue;
      }

      const subjectRaw = (match[preferencePattern.subjectGroup] ?? '').trim();
      const subject = normalizeSubject(subjectRaw);
      if (!isValidSubject(subject)) continue;

      const compareAgainstRaw =
        preferencePattern.secondarySubjectGroup !== undefined
          ? (match[preferencePattern.secondarySubjectGroup] ?? '').trim()
          : '';
      const compareAgainst =
        compareAgainstRaw.length > 0
          ? normalizeSubject(compareAgainstRaw)
          : undefined;
      if (compareAgainst !== undefined && !isValidSubject(compareAgainst))
        continue;

      const category = categorizeSubject(subject);
      const confidence = adjustConfidence(
        preferencePattern.confidence,
        subject,
        preferencePattern.kind,
        fullMatch,
      );
      if (confidence <= 0) continue;

      const key = `${preferencePattern.kind}:${subject}:${compareAgainst ?? ''}`;
      if (seenSignals.has(key)) continue;
      seenSignals.add(key);

      signals.push({
        kind: preferencePattern.kind,
        sentiment: preferencePattern.sentiment,
        subject,
        confidence,
        ...(category !== null && { category }),
        ...(compareAgainst !== undefined && { compareAgainst }),
      });

      if (!seenPreferenceEntities.has(subject)) {
        seenPreferenceEntities.add(subject);
        preferenceEntities.push({
          type: 'preference',
          value: subject,
          raw: subjectRaw,
          count: 1,
          confidence,
        });
      }

      if (compareAgainst !== undefined) {
        const comparisonValue = `${subject} over ${compareAgainst}`;
        if (!seenComparisonEntities.has(comparisonValue)) {
          seenComparisonEntities.add(comparisonValue);
          comparisonEntities.push({
            type: 'preference',
            value: comparisonValue,
            raw: `${subjectRaw} over ${compareAgainstRaw}`,
            count: 1,
            confidence,
          });
        }
      }
    }
  }

  return { signals, preferenceEntities, comparisonEntities };
}

function isFalsePositive(
  fullText: string,
  kind: PreferencePatternKind,
): boolean {
  const patterns = PREFERENCE_FALSE_POSITIVE_PATTERNS[kind];
  if (!patterns || patterns.length === 0) return false;

  const lower = fullText.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function isValidSubject(subject: string): boolean {
  if (!subject) return false;
  if (PREFERENCE_INVALID_SUBJECTS.has(subject)) return false;
  if (subject.length < 2) return false;

  const words = subject.split(/\s+/);
  if (words.length > 8) return false;

  if (/^(?:to\s+think|to\s+say|to\s+mention|to\s+believe)$/.test(subject)) {
    return false;
  }

  return /^[a-z0-9&/+'#., -]+$/.test(subject);
}

function categorizeSubject(subject: string): string | null {
  for (const [category, subjects] of Object.entries(
    PREFERENCE_KNOWN_CATEGORIES,
  )) {
    if (subjects.has(subject)) return category;
  }

  if (subject.includes('food') || subject.includes('cuisine')) return 'food';
  if (subject.includes('music') || subject.includes('song')) return 'music';
  if (subject.includes('movie') || subject.includes('show'))
    return 'entertainment';
  if (subject.includes('sport') || subject.includes('exercise'))
    return 'sports';

  return null;
}

function adjustConfidence(
  baseConfidence: number,
  subject: string,
  kind: PreferencePatternKind,
  fullText: string,
): number {
  if (isFalsePositive(fullText, kind)) {
    return 0;
  }

  let confidence = baseConfidence;
  if (!isValidSubject(subject)) {
    confidence -= 0.2;
  }

  const category = categorizeSubject(subject);
  if (category !== null) {
    confidence += 0.05;
  }

  if (['things', 'stuff', 'everything', 'anything'].includes(subject)) {
    confidence -= 0.25;
  }

  return Math.max(0.5, Math.min(0.98, confidence));
}

function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^to\s+/, '')
    .replace(/[,.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
