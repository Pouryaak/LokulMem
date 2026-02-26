import type { Entity } from '../../types/memory.js';
import {
  EDUCATION_PATTERNS,
  EDUCATION_VALIDATION,
  type EducationPatternKind,
} from '../patterns/educationPatterns.js';

export interface EducationSignal {
  kind: EducationPatternKind;
  confidence: number;
  degree?: string;
  field?: string;
  institution?: string;
  status?: string;
  year?: number;
}

export function extractEducationSignals(content: string): {
  signals: EducationSignal[];
  entities: Entity[];
} {
  const signals: EducationSignal[] = [];
  const entities: Entity[] = [];
  const seenSignals = new Set<string>();
  const seenInstitutions = new Set<string>();

  for (const educationPattern of EDUCATION_PATTERNS) {
    for (const match of content.matchAll(educationPattern.pattern)) {
      const fullMatch = (match[0] ?? '').trim();
      if (containsEducationIdiom(fullMatch)) {
        continue;
      }

      const degreeRaw =
        educationPattern.degreeGroup !== undefined
          ? (match[educationPattern.degreeGroup] ?? '').trim()
          : '';
      const fieldRaw =
        educationPattern.fieldGroup !== undefined
          ? (match[educationPattern.fieldGroup] ?? '').trim()
          : '';
      const institutionRaw =
        educationPattern.institutionGroup !== undefined
          ? (match[educationPattern.institutionGroup] ?? '').trim()
          : '';
      const statusRaw =
        educationPattern.statusGroup !== undefined
          ? (match[educationPattern.statusGroup] ?? '').trim()
          : '';
      const yearRaw =
        educationPattern.yearGroup !== undefined
          ? (match[educationPattern.yearGroup] ?? '').trim()
          : '';

      const degree = normalizeDegree(degreeRaw);
      const field = normalizeField(fieldRaw);
      const institution = normalizeInstitution(institutionRaw);
      const status = normalizeStatus(statusRaw);
      const year = normalizeYear(yearRaw);

      if (degreeRaw && !isValidDegree(degreeRaw)) continue;
      if (fieldRaw && !isValidField(fieldRaw)) continue;
      if (institutionRaw && !isValidInstitution(institutionRaw)) continue;
      if (yearRaw && year === undefined) continue;

      if (!degree && !field && !institution && !status && year === undefined) {
        continue;
      }

      const key = `${educationPattern.kind}:${degree ?? ''}:${field ?? ''}:${institution ?? ''}:${status ?? ''}:${year ?? ''}`;
      if (seenSignals.has(key)) continue;
      seenSignals.add(key);

      const confidence = adjustConfidence(educationPattern.confidence, {
        degree,
        field,
        institution,
      });

      signals.push({
        kind: educationPattern.kind,
        confidence,
        ...(degree !== undefined && { degree }),
        ...(field !== undefined && { field }),
        ...(institution !== undefined && { institution }),
        ...(status !== undefined && { status }),
        ...(year !== undefined && { year }),
      });

      if (institution !== undefined && !seenInstitutions.has(institution)) {
        seenInstitutions.add(institution);
        entities.push({
          type: 'organization',
          value: institution,
          raw: institutionRaw,
          count: 1,
          confidence,
        });
      }
    }
  }

  return { signals, entities };
}

function normalizeDegree(value: string): string | undefined {
  const normalized = value
    .toLowerCase()
    .replace(/\s+degree$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return undefined;

  const map: Record<string, string> = {
    bachelor: "bachelor's",
    bachelors: "bachelor's",
    bs: 'bachelor of science',
    ba: 'bachelor of arts',
    bsc: 'bachelor of science',
    master: "master's",
    masters: "master's",
    ms: 'master of science',
    ma: 'master of arts',
    msc: 'master of science',
    phd: 'phd',
    doctorate: 'doctorate',
    doctoral: 'doctorate',
    mba: 'mba',
    md: 'md',
    jd: 'jd',
  };

  return map[normalized] ?? normalized;
}

function normalizeField(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized;
}

function normalizeInstitution(value: string): string | undefined {
  const normalized = value
    .toLowerCase()
    .replace(/\s+(?:university|college|school)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return undefined;
  return normalized;
}

function normalizeStatus(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized;
}

function normalizeYear(value: string): number | undefined {
  if (!/^\d{4}$/.test(value)) return undefined;
  const parsed = Number(value);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(parsed) || parsed < 1950 || parsed > currentYear + 10) {
    return undefined;
  }
  return parsed;
}

function isValidDegree(degree: string): boolean {
  const normalized = degree
    .toLowerCase()
    .replace(/\s+degree$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return EDUCATION_VALIDATION.degreeTypes.has(normalized);
}

function isValidField(field: string): boolean {
  const normalized = field.toLowerCase().replace(/\s+/g, ' ').trim();
  if (EDUCATION_VALIDATION.invalidFields.has(normalized)) return false;
  if (EDUCATION_VALIDATION.fieldsOfStudy.has(normalized)) return true;

  if (
    normalized.includes('engineering') ||
    normalized.includes('science') ||
    normalized.includes('studies')
  ) {
    return true;
  }

  const words = normalized.split(/\s+/);
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    /^[a-z0-9&/+' -]+$/.test(normalized)
  );
}

function isValidInstitution(institution: string): boolean {
  const normalized = institution
    .toLowerCase()
    .replace(/\s+(?:university|college|school)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  if (EDUCATION_VALIDATION.invalidInstitutions.has(normalized)) return false;

  const firstToken = normalized.split(/\s+/)[0];
  if (
    firstToken !== undefined &&
    EDUCATION_VALIDATION.invalidInstitutions.has(firstToken)
  ) {
    return false;
  }

  if (EDUCATION_VALIDATION.institutions.has(normalized)) return true;
  if (
    /\b(?:university|college|institute|academy|polytechnic)\b/.test(
      institution.toLowerCase(),
    )
  ) {
    return true;
  }

  return /^[a-z][a-z0-9&.' -]{1,50}$/.test(normalized);
}

function containsEducationIdiom(text: string): boolean {
  const lower = text.toLowerCase();
  return EDUCATION_VALIDATION.idioms.some((idiom) => lower.includes(idiom));
}

function adjustConfidence(
  baseConfidence: number,
  input: {
    degree?: string | undefined;
    field?: string | undefined;
    institution?: string | undefined;
  },
): number {
  let confidence = baseConfidence;

  if (input.degree && EDUCATION_VALIDATION.degreeTypes.has(input.degree)) {
    confidence += 0.03;
  }
  if (input.field && EDUCATION_VALIDATION.fieldsOfStudy.has(input.field)) {
    confidence += 0.03;
  }
  if (
    input.institution &&
    EDUCATION_VALIDATION.institutions.has(input.institution)
  ) {
    confidence += 0.04;
  }

  if (input.field && !isValidField(input.field)) {
    confidence -= 0.15;
  }
  if (input.institution && !isValidInstitution(input.institution)) {
    confidence -= 0.15;
  }

  return Math.max(0.5, Math.min(0.98, confidence));
}
