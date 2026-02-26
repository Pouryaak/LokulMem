import type { Entity } from '../../types/memory.js';
import {
  CONTACT_PATTERNS,
  CONTACT_VALIDATION,
  type ContactPatternKind,
} from '../patterns/contactPatterns.js';

export interface ContactSignal {
  kind: ContactPatternKind;
  confidence: number;
  pii: boolean;
  value?: string;
  normalized?: string;
  relation?: string;
}

export function extractContactSignals(content: string): {
  signals: ContactSignal[];
  entities: Entity[];
} {
  const signals: ContactSignal[] = [];
  const entities: Entity[] = [];
  const seenSignals = new Set<string>();
  const seenEntities = new Set<string>();

  for (const contactPattern of CONTACT_PATTERNS) {
    for (const match of content.matchAll(contactPattern.pattern)) {
      const raw = (match[0] ?? '').trim();
      if (!raw) continue;

      const captures = (contactPattern.groups ?? [])
        .map((group) => (match[group] ?? '').trim())
        .filter((value) => value.length > 0);

      const parsed = parseContactPattern(contactPattern.kind, captures, raw);
      if (!parsed.valid) continue;

      const signalKey = `${contactPattern.kind}:${parsed.normalized ?? parsed.value ?? ''}:${parsed.relation ?? ''}`;
      if (seenSignals.has(signalKey)) continue;
      seenSignals.add(signalKey);

      const confidence = adjustConfidence(
        contactPattern.confidence,
        contactPattern.kind,
        parsed,
      );

      signals.push({
        kind: contactPattern.kind,
        confidence,
        pii: contactPattern.pii,
        ...(parsed.value !== undefined && { value: parsed.value }),
        ...(parsed.normalized !== undefined && {
          normalized: parsed.normalized,
        }),
        ...(parsed.relation !== undefined && { relation: parsed.relation }),
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

function parseContactPattern(
  kind: ContactPatternKind,
  captures: string[],
  raw: string,
): {
  valid: boolean;
  value?: string;
  normalized?: string;
  relation?: string;
  entity?: Omit<Entity, 'confidence'>;
} {
  if (kind === 'userName' || kind === 'contactName') {
    const name = captures[0] ?? '';
    if (!isValidName(name)) return { valid: false };
    const normalized = normalizeName(name);
    return {
      valid: true,
      value: normalized,
      normalized,
      entity: { type: 'person', value: normalized, raw: name, count: 1 },
    };
  }

  if (kind === 'nickname' || kind === 'socialHandle') {
    const handle = normalizeHandle(captures[0] ?? '');
    if (!isValidHandle(kind, handle)) return { valid: false };
    return {
      valid: true,
      value: handle,
      normalized: handle,
      entity: {
        type: 'person',
        value: handle,
        raw: captures[0] ?? '',
        count: 1,
      },
    };
  }

  if (kind === 'email') {
    const email = normalizeEmail(captures[0] ?? '');
    if (!isValidEmail(email)) return { valid: false };
    return {
      valid: true,
      value: email,
      normalized: email,
      entity: {
        type: 'person',
        value: email,
        raw: captures[0] ?? '',
        count: 1,
      },
    };
  }

  if (kind === 'phoneNumber') {
    const area = captures[0] ?? '';
    const exchange = captures[1] ?? '';
    const number = captures[2] ?? '';
    if (!isValidUSPhone(area, exchange, number)) return { valid: false };
    const normalized = `+1${area}${exchange}${number}`;
    return {
      valid: true,
      value: `(${area}) ${exchange}-${number}`,
      normalized,
      entity: { type: 'number', value: normalized, raw, count: 1 },
    };
  }

  if (kind === 'phoneInternational') {
    const value = (captures[0] ?? '').replace(/[\s.-]/g, '');
    if (!/^\+\d{6,16}$/.test(value)) return { valid: false };
    return {
      valid: true,
      value,
      normalized: value,
      entity: { type: 'number', value, raw: captures[0] ?? '', count: 1 },
    };
  }

  if (kind === 'streetAddress') {
    const house = captures[0] ?? '';
    const street = captures[1] ?? '';
    const streetType = captures[2] ?? '';
    const unit = captures[3] ?? '';
    if (!house || !street || !streetType) return { valid: false };
    const normalized = normalizeAddress(
      `${house} ${street} ${streetType}${unit ? ` ${unit}` : ''}`,
    );
    return {
      valid: true,
      value: normalized,
      normalized,
      entity: { type: 'place', value: normalized, raw, count: 1 },
    };
  }

  if (kind === 'cityStateZip') {
    const city = captures[0] ?? '';
    const state = captures[1] ?? '';
    const zip = captures[2] ?? '';
    if (!city || !state || !zip) return { valid: false };
    if (!isValidState(state) || !isValidZip(zip)) return { valid: false };
    const normalized = `${normalizeName(city)}, ${state.toUpperCase()} ${zip}`;
    return {
      valid: true,
      value: normalized,
      normalized,
      entity: { type: 'place', value: normalized, raw, count: 1 },
    };
  }

  if (kind === 'website') {
    const website = normalizeWebsite(captures[0] ?? '');
    if (!isValidWebsite(website)) return { valid: false };
    if (website.includes('@')) return { valid: false };
    return {
      valid: true,
      value: website,
      normalized: website,
      entity: {
        type: 'organization',
        value: website,
        raw: captures[0] ?? '',
        count: 1,
      },
    };
  }

  if (kind === 'relationship') {
    const first = captures[0] ?? '';
    const second = captures[1] ?? '';
    const firstLower = first.toLowerCase();
    const secondLower = second.toLowerCase();
    let relation = secondLower;
    let name = first;
    if (CONTACT_VALIDATION.relationshipTypes.has(firstLower)) {
      relation = firstLower;
      name = second;
    }

    if (!CONTACT_VALIDATION.relationshipTypes.has(relation)) {
      return { valid: false };
    }
    if (!isValidName(name)) return { valid: false };

    const normalizedName = normalizeName(name);
    return {
      valid: true,
      relation,
      value: normalizedName,
      normalized: normalizedName,
      entity: { type: 'person', value: normalizedName, raw: name, count: 1 },
    };
  }

  if (kind === 'employment') {
    const company = normalizeOrganization(captures[0] ?? '');
    if (!company) return { valid: false };
    return {
      valid: true,
      value: company,
      normalized: company,
      entity: {
        type: 'organization',
        value: company,
        raw: captures[0] ?? '',
        count: 1,
      },
    };
  }

  if (kind === 'contactBirthday') {
    const name = captures[0] ?? '';
    const month = captures[1] ?? '';
    const day = captures[2] ?? '';
    if (!isValidName(name) || !isValidMonthDay(month, day))
      return { valid: false };

    const monthNum = monthToNumber(month);
    if (monthNum === null) return { valid: false };
    const normalized = `--${String(monthNum).padStart(2, '0')}-${String(Number.parseInt(day, 10)).padStart(2, '0')}`;

    return {
      valid: true,
      value: normalizeName(name),
      normalized,
      entity: { type: 'date', value: normalized, raw, count: 1 },
    };
  }

  if (kind === 'preferredContactMethod' || kind === 'contactMethodAvoid') {
    const method = (captures[0] ?? '').toLowerCase().trim();
    if (!method) return { valid: false };
    return {
      valid: true,
      value: method,
      normalized: method,
      entity: {
        type: 'preference',
        value: method,
        raw: captures[0] ?? '',
        count: 1,
      },
    };
  }

  return { valid: false };
}

function adjustConfidence(
  base: number,
  kind: ContactPatternKind,
  parsed: { value?: string },
): number {
  let confidence = base;

  if ((kind === 'userName' || kind === 'contactName') && parsed.value) {
    const first = parsed.value.split(/\s+/)[0];
    if (first && CONTACT_VALIDATION.commonFirstNames.has(first)) {
      confidence += 0.05;
    }
  }

  if (kind === 'website' && parsed.value?.includes('localhost')) {
    confidence -= 0.2;
  }

  return Math.max(0.5, Math.min(0.98, confidence));
}

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  if (!/^[A-Z][a-z]+(?:[\s'-][A-Z]?[a-z]+){0,3}$/.test(trimmed)) return false;
  return !CONTACT_VALIDATION.invalidNames.has(trimmed.toLowerCase());
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isValidUSPhone(
  areaCode: string,
  exchange: string,
  number: string,
): boolean {
  const area = Number.parseInt(areaCode, 10);
  const exch = Number.parseInt(exchange, 10);
  const num = Number.parseInt(number, 10);
  if (
    !Number.isInteger(area) ||
    !Number.isInteger(exch) ||
    !Number.isInteger(num)
  ) {
    return false;
  }
  if (area < 200 || area > 999 || area === 555) return false;
  if (exch < 200 || exch > 999) return false;
  return num >= 0 && num <= 9999;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function normalizeAddress(address: string): string {
  return address
    .replace(/\bStreet\b/gi, 'St')
    .replace(/\bAvenue\b/gi, 'Ave')
    .replace(/\bRoad\b/gi, 'Rd')
    .replace(/\bBoulevard\b/gi, 'Blvd')
    .replace(/\bDrive\b/gi, 'Dr')
    .replace(/\bLane\b/gi, 'Ln')
    .replace(/\bCourt\b/gi, 'Ct')
    .replace(/\bPlace\b/gi, 'Pl')
    .replace(/\bApartment\b/gi, 'Apt')
    .replace(/\bSuite\b/gi, 'Ste')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isValidState(state: string): boolean {
  return CONTACT_VALIDATION.usStates.has(state.toUpperCase());
}

function isValidZip(zip: string): boolean {
  return /^\d{5}(?:-\d{4})?$/.test(zip);
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase().trim();
}

function isValidHandle(kind: ContactPatternKind, handle: string): boolean {
  if (!handle) return false;
  if (kind === 'nickname') return /^[a-zA-Z0-9_]{2,30}$/.test(handle);
  if (kind === 'socialHandle') return /^[a-zA-Z0-9_.-]{1,39}$/.test(handle);
  return false;
}

function normalizeWebsite(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

function isValidWebsite(value: string): boolean {
  return /^[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?$/.test(value);
}

function normalizeOrganization(value: string): string | undefined {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length < 2 || normalized.length > 60) return undefined;
  if (/^(?:the|a|an)$/.test(normalized)) return undefined;
  return normalized;
}

function isValidMonthDay(month: string, day: string): boolean {
  const monthNum = monthToNumber(month);
  const dayNum = Number.parseInt(day, 10);
  if (monthNum === null || !Number.isInteger(dayNum)) return false;
  if (dayNum < 1 || dayNum > 31) return false;

  const year = new Date().getFullYear();
  return new Date(year, monthNum, 0).getDate() >= dayNum;
}

function monthToNumber(month: string): number | null {
  const map: Record<string, number> = {
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

  return map[month.toLowerCase()] ?? null;
}
