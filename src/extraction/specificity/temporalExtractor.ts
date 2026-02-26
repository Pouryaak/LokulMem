import type { Entity } from '../../types/memory.js';
import {
  TEMPORAL_PATTERNS,
  type TemporalPatternKind,
} from '../patterns/temporalPatterns.js';

const MONTH_MAP: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const TIME_OF_DAY_MAP: Record<string, { hour: number; minute: number }> = {
  midnight: { hour: 0, minute: 0 },
  dawn: { hour: 6, minute: 0 },
  sunrise: { hour: 6, minute: 30 },
  morning: { hour: 9, minute: 0 },
  noon: { hour: 12, minute: 0 },
  afternoon: { hour: 15, minute: 0 },
  evening: { hour: 18, minute: 0 },
  dusk: { hour: 19, minute: 0 },
  sunset: { hour: 19, minute: 30 },
  night: { hour: 21, minute: 0 },
};

export interface TemporalSignal {
  kind: TemporalPatternKind;
  confidence: number;
  raw: string;
  normalized?: string;
}

export function extractTemporalSignals(content: string): {
  signals: TemporalSignal[];
  dateEntities: Entity[];
  changeEntities: Entity[];
} {
  const signals: TemporalSignal[] = [];
  const dateEntities: Entity[] = [];
  const changeEntities: Entity[] = [];
  const seenSignals = new Set<string>();
  const seenDateEntities = new Set<string>();
  const seenChangeEntities = new Set<string>();

  for (const temporalPattern of TEMPORAL_PATTERNS) {
    for (const match of content.matchAll(temporalPattern.pattern)) {
      const raw = (match[0] ?? '').trim();
      if (!raw) continue;

      if (temporalPattern.kind === 'timeOfDay' && /^good\s+/i.test(raw)) {
        continue;
      }

      const normalized = normalizeTemporal(temporalPattern.kind, match, raw);
      const confidence = adjustConfidence(
        temporalPattern.confidence,
        temporalPattern.kind,
        normalized,
      );

      const signalKey = `${temporalPattern.kind}:${normalized ?? raw.toLowerCase()}`;
      if (seenSignals.has(signalKey)) continue;
      seenSignals.add(signalKey);

      signals.push({
        kind: temporalPattern.kind,
        confidence,
        raw,
        ...(normalized !== undefined && { normalized }),
      });

      const value = normalized ?? raw.toLowerCase();
      if (isTemporalChangeKind(temporalPattern.kind)) {
        if (!seenChangeEntities.has(value)) {
          seenChangeEntities.add(value);
          changeEntities.push({
            type: 'date',
            value,
            raw,
            count: 1,
            confidence,
          });
        }
      } else if (!seenDateEntities.has(value)) {
        seenDateEntities.add(value);
        dateEntities.push({
          type: 'date',
          value,
          raw,
          count: 1,
          confidence,
        });
      }
    }
  }

  return { signals, dateEntities, changeEntities };
}

function isTemporalChangeKind(kind: TemporalPatternKind): boolean {
  return (
    kind === 'futurePlan' ||
    kind === 'pastEvent' ||
    kind === 'temporalRelationship'
  );
}

function normalizeTemporal(
  kind: TemporalPatternKind,
  match: RegExpMatchArray,
  raw: string,
): string | undefined {
  switch (kind) {
    case 'dateIso': {
      const year = toNumber(match[1]);
      const month = toNumber(match[2]);
      const day = toNumber(match[3]);
      return parseAbsoluteDate(day, month, year);
    }
    case 'absoluteDate': {
      const a = match[1] ?? '';
      const b = match[2] ?? '';
      const c = match[3] ?? '';

      if (/^\d{1,2}$/.test(a) && b) {
        return parseAbsoluteDate(
          toNumber(a),
          b,
          c.length > 0 ? toNumber(c) : undefined,
        );
      }
      if (a && /^\d{1,2}$/.test(b)) {
        return parseAbsoluteDate(
          toNumber(b),
          a,
          c.length > 0 ? toNumber(c) : undefined,
        );
      }
      return undefined;
    }
    case 'dateNumeric': {
      const m = toNumber(match[1]);
      const d = toNumber(match[2]);
      const yRaw = match[3] ?? '';
      const y = yRaw.length === 2 ? 2000 + toNumber(yRaw) : toNumber(yRaw);
      return parseAbsoluteDate(d, m, y);
    }
    case 'year': {
      const year = toNumber(match[1]);
      if (!isValidDate(year, undefined, undefined)) return undefined;
      return String(year);
    }
    case 'relativePresent':
    case 'relativePast':
    case 'relativeFuture': {
      return parseRelativeKeyword((match[1] ?? raw).toLowerCase());
    }
    case 'relativePeriod': {
      return parseRelativePeriod(
        (match[1] ?? '').toLowerCase(),
        (match[2] ?? '').toLowerCase(),
      );
    }
    case 'relativeCount': {
      const amount = toNumber(match[1]);
      const unit = (match[2] ?? '').toLowerCase();
      if (raw.toLowerCase().includes('ago')) {
        return calculatePastDate(amount, unit);
      }
      return calculateFutureDate(amount, unit);
    }
    case 'absoluteTime': {
      const hour = toNumber(match[1]);
      const minute = match[2] ? toNumber(match[2]) : 0;
      const period = (match[3] ?? '').toLowerCase();
      const parsed = parseTime(hour, minute, period);
      return parsed === null
        ? undefined
        : `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
    }
    case 'absoluteTime24h': {
      const hour = toNumber(match[1]);
      const minute = toNumber(match[2]);
      if (!isValidTime(hour, minute)) return undefined;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    case 'timeReference':
    case 'timeOfDay': {
      const token = (match[1] ?? '').toLowerCase();
      const mapped = TIME_OF_DAY_MAP[token];
      return mapped === undefined
        ? token || undefined
        : `${String(mapped.hour).padStart(2, '0')}:${String(mapped.minute).padStart(2, '0')}`;
    }
    case 'duration': {
      const amount = Number(match[1]);
      const unit = (match[2] ?? '').toLowerCase();
      const seconds = parseDuration(amount, unit);
      return seconds === null ? undefined : `${seconds}s`;
    }
    default:
      return raw.toLowerCase();
  }
}

function adjustConfidence(
  baseConfidence: number,
  kind: TemporalPatternKind,
  normalized: string | undefined,
): number {
  let confidence = baseConfidence;

  if (normalized !== undefined) {
    confidence += 0.05;
  } else {
    confidence -= 0.15;
  }

  if (kind.includes('absolute') || kind.includes('Iso') || kind === 'dateIso') {
    confidence += 0.03;
  }

  if (kind.includes('relative') && normalized === undefined) {
    confidence -= 0.1;
  }

  return Math.max(0.5, Math.min(0.98, confidence));
}

function toNumber(value: string | undefined): number {
  return Number.parseInt(value ?? '', 10);
}

function isValidDate(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined,
): boolean {
  const currentYear = new Date().getFullYear();

  if (
    year !== undefined &&
    (!Number.isInteger(year) || year < 1900 || year > currentYear + 100)
  ) {
    return false;
  }
  if (
    month !== undefined &&
    (!Number.isInteger(month) || month < 1 || month > 12)
  ) {
    return false;
  }

  if (day !== undefined && month !== undefined) {
    const referenceYear = year ?? currentYear;
    const daysInMonth = new Date(referenceYear, month, 0).getDate();
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
      return false;
    }
  }

  return true;
}

function isValidTime(hour: number, minute: number, period?: string): boolean {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;

  if (period !== undefined && period.length > 0) {
    if (hour < 1 || hour > 12) return false;
  } else if (hour < 0 || hour > 23) {
    return false;
  }

  return minute >= 0 && minute <= 59;
}

function normalizeMonth(month: string): number | null {
  return MONTH_MAP[month.toLowerCase().trim()] ?? null;
}

function parseAbsoluteDate(
  day: number,
  month: string | number,
  year?: number,
): string | undefined {
  const monthNum = typeof month === 'string' ? normalizeMonth(month) : month;
  if (monthNum === null || monthNum === undefined) return undefined;

  const yearNum = year ?? new Date().getFullYear();
  if (!isValidDate(yearNum, monthNum, day)) return undefined;

  return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseRelativeKeyword(keyword: string): string {
  const now = new Date();
  const date = new Date(now);

  if (keyword.includes('yesterday') || keyword.includes('last night')) {
    date.setDate(now.getDate() - 1);
  } else if (keyword.includes('tomorrow') || keyword.includes('tmrw')) {
    date.setDate(now.getDate() + 1);
  }

  return date.toISOString().split('T')[0] ?? '';
}

function parseRelativePeriod(
  modifier: string,
  period: string,
): string | undefined {
  const now = new Date();
  const target = new Date(now);

  const dayToken = period.replace(/s$/, '');
  const day = DAY_MAP[dayToken];

  if (day !== undefined) {
    let diff = day - now.getDay();
    if (modifier === 'last') diff -= 7;
    if (modifier === 'next') diff += 7;
    target.setDate(now.getDate() + diff);
    return target.toISOString().split('T')[0];
  }

  if (period === 'week') {
    if (modifier === 'last') target.setDate(now.getDate() - 7);
    if (modifier === 'next') target.setDate(now.getDate() + 7);
    return target.toISOString().split('T')[0];
  }
  if (period === 'month') {
    if (modifier === 'last') target.setMonth(now.getMonth() - 1);
    if (modifier === 'next') target.setMonth(now.getMonth() + 1);
    return target.toISOString().split('T')[0];
  }
  if (period === 'year') {
    if (modifier === 'last') target.setFullYear(now.getFullYear() - 1);
    if (modifier === 'next') target.setFullYear(now.getFullYear() + 1);
    return target.toISOString().split('T')[0];
  }

  return undefined;
}

function parseTime(
  hour: number,
  minute: number,
  period?: string,
): { hour: number; minute: number } | null {
  if (!isValidTime(hour, minute, period)) return null;
  if (period === undefined) return { hour, minute };

  const p = period.toLowerCase();
  let hour24 = hour;
  if (p === 'pm' && hour24 !== 12) hour24 += 12;
  if (p === 'am' && hour24 === 12) hour24 = 0;

  return { hour: hour24, minute };
}

function parseDuration(amount: number, unit: string): number | null {
  const normalizedUnit = unit.toLowerCase().replace(/s$/, '');
  const unitToSeconds: Record<string, number> = {
    second: 1,
    minute: 60,
    min: 60,
    hour: 3600,
    hr: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
    year: 31536000,
  };
  const mult = unitToSeconds[normalizedUnit];
  if (mult === undefined) return null;
  return amount * mult;
}

function calculatePastDate(amount: number, unit: string): string | undefined {
  const date = new Date();
  const normalizedUnit = unit.toLowerCase().replace(/s$/, '');

  if (normalizedUnit === 'day') date.setDate(date.getDate() - amount);
  else if (normalizedUnit === 'week') date.setDate(date.getDate() - amount * 7);
  else if (normalizedUnit === 'month') date.setMonth(date.getMonth() - amount);
  else if (normalizedUnit === 'year')
    date.setFullYear(date.getFullYear() - amount);
  else return undefined;

  return date.toISOString().split('T')[0];
}

function calculateFutureDate(amount: number, unit: string): string | undefined {
  const date = new Date();
  const normalizedUnit = unit.toLowerCase().replace(/s$/, '');

  if (normalizedUnit === 'day') date.setDate(date.getDate() + amount);
  else if (normalizedUnit === 'week') date.setDate(date.getDate() + amount * 7);
  else if (normalizedUnit === 'month') date.setMonth(date.getMonth() + amount);
  else if (normalizedUnit === 'year')
    date.setFullYear(date.getFullYear() + amount);
  else return undefined;

  return date.toISOString().split('T')[0];
}
