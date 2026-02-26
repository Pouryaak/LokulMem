import type { Entity } from '../../types/memory.js';
import {
  PROFESSION_KEYWORDS,
  PROFESSION_PATTERNS,
  type ProfessionPatternKind,
} from '../patterns/professionPatterns.js';

export function isProfessionPhrase(value: string): boolean {
  return new RegExp(`\\b(${PROFESSION_KEYWORDS.join('|')})\\b`).test(value);
}

export function extractJobs(content: string): Entity[] {
  const entities: Entity[] = [];
  const seen = new Set<string>();

  for (const { pattern, group, kind, confidence } of PROFESSION_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const captured = (match[group] ?? '').trim();
      if (!captured) continue;

      const normalized = captured
        .replace(/\s+/g, ' ')
        .replace(/^(?:a|an|the)\s+/i, '')
        .trim()
        .toLowerCase();

      if (!isLikelyWorkValue(normalized, kind)) continue;
      if (seen.has(normalized)) continue;

      seen.add(normalized);
      entities.push({
        type: 'organization',
        value: normalized,
        raw: captured,
        count: 1,
        confidence,
      });
    }
  }

  return entities;
}

function isLikelyWorkValue(
  value: string,
  kind: ProfessionPatternKind,
): boolean {
  if (value.length < 2 || value.length > 60) return false;
  if (/^(?:married|single|engaged|divorced)$/.test(value.trim())) return false;

  if (
    /\b(wife|husband|partner|mother|father|friend|family|pizza|steak|gym)\b/.test(
      value,
    )
  ) {
    return false;
  }

  if (kind === 'role') {
    return (
      isProfessionPhrase(value) ||
      /^(?:senior|junior|lead|principal|staff)\s+[a-z][a-z\s-]+$/.test(value)
    );
  }

  if (kind === 'industry') return /[a-z]{3,}/.test(value);
  if (kind === 'workMode')
    return /\b(remote|remotely|home|office|anywhere)\b/.test(value);
  if (kind === 'company' || kind === 'selfEmployment')
    return !/^(?:my|our|the)\s+/.test(value);
  return false;
}
