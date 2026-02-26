import type { Entity } from '../../types/memory.js';
import {
  KNOWN_COMPANY_TOKENS,
  RELATIONAL_IDIOM_BLOCKLIST,
  RELATIONAL_NAME_BLOCKLIST,
  RELATIONAL_PATTERNS,
  RELATION_TERMS,
  type RelationalPatternKind,
} from '../patterns/relationalPatterns.js';

export interface RelationalSignal {
  kind: RelationalPatternKind;
  relation: string;
  confidence: number;
  name?: string;
  count?: number;
}

export function extractRelationalSignals(
  content: string,
  isLikelyNameCandidate: (value: string) => boolean,
): {
  signals: RelationalSignal[];
  entities: Entity[];
} {
  const signals: RelationalSignal[] = [];
  const entities: Entity[] = [];
  const seenSignals = new Set<string>();
  const seenNames = new Set<string>();

  for (const relationalPattern of RELATIONAL_PATTERNS) {
    const matches = content.matchAll(relationalPattern.pattern);
    for (const match of matches) {
      const relationRaw =
        (relationalPattern.relationGroup !== undefined
          ? match[relationalPattern.relationGroup]
          : relationalPattern.relationValue) ?? '';
      const relation = normalizeRelation(relationRaw);
      if (!isValidRelation(relation, match[0] ?? '')) continue;

      const nameRaw =
        relationalPattern.nameGroup !== undefined
          ? (match[relationalPattern.nameGroup] ?? '').trim()
          : '';
      const name =
        nameRaw.length > 0 &&
        isLikelyNameCandidate(nameRaw) &&
        isValidRelationalName(nameRaw)
          ? nameRaw
          : undefined;

      const countRaw =
        relationalPattern.countGroup !== undefined
          ? (match[relationalPattern.countGroup] ?? '').trim()
          : '';
      const count =
        countRaw.length > 0 && /^\d{1,2}$/.test(countRaw)
          ? Number(countRaw)
          : undefined;
      if (
        count !== undefined &&
        (!Number.isInteger(count) || count < 0 || count > 20)
      )
        continue;

      const key = `${relationalPattern.kind}:${relation}:${name ?? ''}:${count ?? ''}`;
      if (seenSignals.has(key)) continue;

      seenSignals.add(key);
      signals.push({
        kind: relationalPattern.kind,
        relation,
        ...(name !== undefined && { name }),
        ...(count !== undefined && { count }),
        confidence: relationalPattern.confidence,
      });

      if (name !== undefined) {
        const nameKey = name.toLowerCase();
        if (!seenNames.has(nameKey)) {
          seenNames.add(nameKey);
          entities.push({
            type: 'person',
            value: nameKey,
            raw: name,
            count: 1,
            confidence: relationalPattern.confidence,
          });
        }
      }
    }
  }

  return { signals, entities };
}

function normalizeRelation(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['’]s$/, '')
    .replace(/\b(children|kids)\b/g, 'child')
    .replace(/\b(brothers)\b/g, 'brother')
    .replace(/\b(sisters)\b/g, 'sister')
    .trim();
}

function isValidRelation(relation: string, fullMatch: string): boolean {
  if (!relation) return false;

  const allowed = new Set<string>(RELATION_TERMS);
  const statusAllowed = new Set([
    'married',
    'single',
    'divorced',
    'widowed',
    'engaged',
    'in a relationship',
    'dating',
    'spouse',
  ]);
  if (!allowed.has(relation) && !statusAllowed.has(relation)) return false;

  const lower = fullMatch.toLowerCase();
  if (
    RELATIONAL_IDIOM_BLOCKLIST.some((idiom) => lower.includes(idiom)) ||
    /\bsingle[-\s]handedly\b/.test(lower)
  ) {
    return false;
  }

  return true;
}

function isValidRelationalName(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  if (!normalized) return false;
  if (RELATIONAL_NAME_BLOCKLIST.includes(normalized as never)) return false;
  if (KNOWN_COMPANY_TOKENS.includes(normalized as never)) return false;
  return !/\b(?:inc|llc|ltd|corp|corporation|company)\b/.test(normalized);
}
