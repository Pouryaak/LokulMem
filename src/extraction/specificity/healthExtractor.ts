import type { Entity } from '../../types/memory.js';
import {
  HEALTH_PATTERNS,
  HEALTH_VALIDATION,
  type HealthPatternKind,
} from '../patterns/healthPatterns.js';

export interface HealthSignal {
  kind: HealthPatternKind;
  confidence: number;
  sensitive: boolean;
  critical?: boolean;
  term?: string;
  value?: number;
  unit?: string;
  relation?: string;
  providerType?: string;
}

export function extractHealthSignals(content: string): {
  signals: HealthSignal[];
  entities: Entity[];
} {
  const signals: HealthSignal[] = [];
  const entities: Entity[] = [];
  const seenSignals = new Set<string>();
  const seenEntities = new Set<string>();

  for (const healthPattern of HEALTH_PATTERNS) {
    for (const match of content.matchAll(healthPattern.pattern)) {
      const raw = (match[0] ?? '').trim();
      if (!raw) continue;

      const captures = (healthPattern.groups ?? [])
        .map((index) => (match[index] ?? '').trim())
        .filter((value) => value.length > 0);

      const primary = normalizeTerm(captures[0] ?? '');
      const secondary = normalizeTerm(captures[1] ?? '');

      const parsed = parseByKind(healthPattern.kind, primary, secondary, raw);
      if (!parsed.valid) continue;

      const confidence = adjustConfidence(
        healthPattern.confidence,
        healthPattern.kind,
        parsed.term,
      );

      const signalKey = `${healthPattern.kind}:${parsed.term ?? ''}:${parsed.value ?? ''}:${parsed.unit ?? ''}:${parsed.relation ?? ''}:${parsed.providerType ?? ''}`;
      if (seenSignals.has(signalKey)) continue;
      seenSignals.add(signalKey);

      signals.push({
        kind: healthPattern.kind,
        confidence,
        sensitive: healthPattern.sensitive,
        ...(healthPattern.critical === true && { critical: true }),
        ...(parsed.term !== undefined && { term: parsed.term }),
        ...(parsed.value !== undefined && { value: parsed.value }),
        ...(parsed.unit !== undefined && { unit: parsed.unit }),
        ...(parsed.relation !== undefined && { relation: parsed.relation }),
        ...(parsed.providerType !== undefined && {
          providerType: parsed.providerType,
        }),
      });

      if (parsed.entity !== undefined) {
        const entityKey = `${parsed.entity.type}:${parsed.entity.value}`;
        if (!seenEntities.has(entityKey)) {
          seenEntities.add(entityKey);
          entities.push({ ...parsed.entity, confidence });
        }
      }
    }
  }

  return { signals, entities };
}

function parseByKind(
  kind: HealthPatternKind,
  primary: string,
  secondary: string,
  fullMatch: string,
): {
  valid: boolean;
  term?: string;
  value?: number;
  unit?: string;
  relation?: string;
  providerType?: string;
  entity?: Omit<Entity, 'confidence'>;
} {
  if (kind === 'bloodPressure') {
    const systolic = Number.parseInt(primary, 10);
    const diastolic = Number.parseInt(secondary, 10);
    if (!isValidBloodPressure(systolic, diastolic)) return { valid: false };

    return {
      valid: true,
      term: 'blood pressure',
      value: systolic,
      unit: `${systolic}/${diastolic}`,
      entity: {
        type: 'number',
        value: `${systolic}/${diastolic}`,
        raw: fullMatch,
        count: 1,
      },
    };
  }

  if (kind === 'bloodSugar') {
    const value = Number.parseInt(primary, 10);
    if (!isValidBloodSugar(value)) return { valid: false };
    return {
      valid: true,
      term: 'blood sugar',
      value,
      entity: {
        type: 'number',
        value: String(value),
        raw: fullMatch,
        count: 1,
      },
    };
  }

  if (kind === 'weight') {
    const value = Number.parseFloat(primary);
    const unit = secondary;
    if (!isValidWeight(value, unit)) return { valid: false };
    return {
      valid: true,
      term: 'weight',
      value,
      unit,
      entity: {
        type: 'number',
        value: `${value}${unit}`,
        raw: fullMatch,
        count: 1,
      },
    };
  }

  if (kind === 'height') {
    if (/^\d+$/.test(primary) && /^\d{1,2}$/.test(secondary)) {
      const feet = Number.parseInt(primary, 10);
      const inches = Number.parseInt(secondary, 10);
      const feetValue = feet + inches / 12;
      if (!isValidHeight(feetValue, 'ft')) return { valid: false };
      return {
        valid: true,
        term: 'height',
        value: feetValue,
        unit: 'ft',
        entity: {
          type: 'number',
          value: `${feet}'${inches}`,
          raw: fullMatch,
          count: 1,
        },
      };
    }

    const value = Number.parseFloat(primary);
    const unit = secondary;
    if (!isValidHeight(value, unit)) return { valid: false };
    return {
      valid: true,
      term: 'height',
      value,
      unit,
      entity: {
        type: 'number',
        value: `${value}${unit}`,
        raw: fullMatch,
        count: 1,
      },
    };
  }

  if (kind === 'bmi') {
    const value = Number.parseFloat(primary);
    if (!Number.isFinite(value) || value < 10 || value > 60)
      return { valid: false };
    return {
      valid: true,
      term: 'bmi',
      value,
      entity: {
        type: 'number',
        value: String(value),
        raw: fullMatch,
        count: 1,
      },
    };
  }

  if (kind === 'heartRate') {
    const value = Number.parseInt(primary, 10);
    if (!Number.isInteger(value) || value < 30 || value > 220) {
      return { valid: false };
    }
    return {
      valid: true,
      term: 'heart rate',
      value,
      entity: {
        type: 'number',
        value: `${value}bpm`,
        raw: fullMatch,
        count: 1,
      },
    };
  }

  if (kind === 'healthcareProvider') {
    if (!primary || !secondary) return { valid: false };
    if (!/^[a-z][a-z\s-]{1,40}$/.test(secondary)) return { valid: false };

    return {
      valid: true,
      providerType: primary,
      term: secondary,
      entity: {
        type: 'organization',
        value: secondary,
        raw: fullMatch,
        count: 1,
      },
    };
  }

  if (kind === 'familyHistory') {
    if (!primary || !secondary) return { valid: false };
    if (!isValidConditionOrSymptom(secondary)) return { valid: false };
    return {
      valid: true,
      relation: primary,
      term: secondary,
      entity: {
        type: 'preference',
        value: `${primary}:${secondary}`,
        raw: fullMatch,
        count: 1,
      },
    };
  }

  const term = primary;
  if (!term) return { valid: false };
  if (!isValidTermForKind(kind, term)) return { valid: false };

  return {
    valid: true,
    term,
    entity: {
      type: 'preference',
      value: term,
      raw: fullMatch,
      count: 1,
    },
  };
}

function isValidTermForKind(kind: HealthPatternKind, term: string): boolean {
  if (!term || HEALTH_VALIDATION.invalidTerms.has(term)) return false;

  if (kind.includes('allergy')) {
    return isValidAllergen(term);
  }

  if (kind.includes('medication')) {
    return isValidMedication(term);
  }

  if (kind === 'symptom' || kind === 'painLocation') {
    return isValidSymptom(term);
  }

  if (
    kind === 'medicalCondition' ||
    kind === 'medicalHistory' ||
    kind === 'mentalHealthCondition'
  ) {
    return isValidCondition(term);
  }

  if (kind === 'therapy' || kind === 'mentalHealthProvider') {
    return true;
  }

  if (kind === 'healthcareVisit' || kind === 'medicalAppointment') {
    return true;
  }

  if (
    kind === 'medicalProcedure' ||
    kind === 'scheduledProcedure' ||
    kind === 'treatment'
  ) {
    return /^[a-z][a-z0-9\s-]{2,40}$/.test(term);
  }

  return true;
}

function isValidCondition(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (HEALTH_VALIDATION.invalidTerms.has(lower)) return false;
  if (HEALTH_VALIDATION.medicalConditions.has(lower)) return true;

  if (/\b(disease|disorder|syndrome|condition)\b/.test(lower)) return true;
  if (/\b(itis|osis|emia|pathy|algia)\b/.test(lower)) return true;
  return false;
}

function isValidSymptom(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (HEALTH_VALIDATION.invalidTerms.has(lower)) return false;
  if (/\b(happy|sad|fun|excited|angry|great|good)\b/.test(lower)) return false;
  if (HEALTH_VALIDATION.symptoms.has(lower)) return true;
  if (/\b(pain|ache|sore|nause|dizz|fatigue|weak|fever|cough)\b/.test(lower)) {
    return true;
  }
  return false;
}

function isValidMedication(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (HEALTH_VALIDATION.invalidTerms.has(lower)) return false;
  if (/\b(break|vacation|trip|nap|rest)\b/.test(lower)) return false;
  if (HEALTH_VALIDATION.medications.has(lower)) return true;
  return /\b(medication|medicine|pill|tablet|capsule|drug|inhaler)\b/.test(
    lower,
  );
}

function isValidAllergen(value: string): boolean {
  const chunks = value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (chunks.length === 0) return false;
  return chunks.every(
    (chunk) =>
      HEALTH_VALIDATION.allergens.has(chunk) ||
      /^[a-z][a-z\s-]{2,30}$/.test(chunk),
  );
}

function isValidConditionOrSymptom(value: string): boolean {
  return isValidCondition(value) || isValidSymptom(value);
}

function isValidBloodPressure(systolic: number, diastolic: number): boolean {
  return (
    Number.isInteger(systolic) &&
    Number.isInteger(diastolic) &&
    systolic >= 60 &&
    systolic <= 250 &&
    diastolic >= 40 &&
    diastolic <= 150
  );
}

function isValidBloodSugar(value: number): boolean {
  return Number.isInteger(value) && value >= 20 && value <= 600;
}

function isValidWeight(value: number, unit: string): boolean {
  const lower = unit.toLowerCase();
  if (lower.includes('lb') || lower.includes('pound')) {
    return value >= 50 && value <= 500;
  }
  if (lower.includes('kg') || lower.includes('kilogram')) {
    return value >= 20 && value <= 250;
  }
  return false;
}

function isValidHeight(value: number, unit: string): boolean {
  const lower = unit.toLowerCase();
  if (lower.includes('cm')) return value >= 100 && value <= 250;
  if (lower === 'm' || lower.includes('meter'))
    return value >= 1 && value <= 2.5;
  if (lower.includes('ft') || lower.includes('feet'))
    return value >= 3 && value <= 8;
  return false;
}

function adjustConfidence(
  baseConfidence: number,
  kind: HealthPatternKind,
  extracted: string | undefined,
): number {
  let confidence = baseConfidence;
  if (!extracted) return Math.max(0.5, confidence - 0.2);

  const lower = extracted.toLowerCase();
  if (
    kind.includes('Condition') &&
    HEALTH_VALIDATION.medicalConditions.has(lower)
  ) {
    confidence += 0.05;
  }
  if (
    (kind === 'symptom' || kind === 'painLocation') &&
    HEALTH_VALIDATION.symptoms.has(lower)
  ) {
    confidence += 0.05;
  }
  if (kind.includes('medication') && HEALTH_VALIDATION.medications.has(lower)) {
    confidence += 0.05;
  }
  if (kind.includes('allergy') && HEALTH_VALIDATION.allergens.has(lower)) {
    confidence += 0.05;
  }
  if (HEALTH_VALIDATION.invalidTerms.has(lower)) {
    confidence -= 0.3;
  }

  return Math.max(0.5, Math.min(0.98, confidence));
}

function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/^(?:a|an|the)\s+/, '')
    .replace(/\s+(?:condition|disease|disorder|syndrome)$/, '')
    .replace(/\s+(?:and|but)\s+.*$/, '')
    .replace(/\s+(?:daily|every\s+day|twice\s+a\s+day|once\s+a\s+day)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
