export type LocationPatternKind =
  | 'residence'
  | 'origin'
  | 'birthplace'
  | 'pastResidence'
  | 'workLocation'
  | 'movedTo'
  | 'movedFromTo'
  | 'visited'
  | 'currentLocation'
  | 'nearby';

export interface LocationPattern {
  pattern: RegExp;
  kind: LocationPatternKind;
  confidence: number;
  primaryGroup: number;
  secondaryGroup?: number;
}

export const LOCATION_PATTERNS: LocationPattern[] = [
  {
    pattern:
      /i\s+live\s+in\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'residence',
    confidence: 0.9,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i(?:['’]?m|\s+am)\s+(?:currently\s+)?(?:living|based|located|residing)\s+in\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'residence',
    confidence: 0.9,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i(?:['’]?m|\s+am)\s+from\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'origin',
    confidence: 0.86,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i\s+(?:was\s+)?(?:born|raised|grew\s+up)\s+in\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'birthplace',
    confidence: 0.9,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i\s+(?:used\s+to\s+live|lived|previously\s+lived|stayed)\s+in\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'pastResidence',
    confidence: 0.88,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i\s+work\s+in\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'workLocation',
    confidence: 0.82,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i\s+(?:moved|relocated|transferred)\s+to\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'movedTo',
    confidence: 0.9,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i(?:['’]?m|\s+am)\s+(?:moving|planning\s+to\s+move)\s+to\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'movedTo',
    confidence: 0.88,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i\s+moved\s+from\s+([a-z][a-z\s'-]{1,40})\s+to\s+([a-z][a-z\s'-]{1,40})(?=$|[,.!?\s])/gi,
    kind: 'movedFromTo',
    confidence: 0.9,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i\s+(?:visited|went\s+to|traveled\s+to|travelled\s+to|have\s+been\s+to)\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'visited',
    confidence: 0.84,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i(?:['’]?m|\s+am)\s+(?:currently\s+)?(?:in|at|visiting)\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?:\s+right\s+now)?(?=$|[,.!?\s])/gi,
    kind: 'currentLocation',
    confidence: 0.86,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
  {
    pattern:
      /i\s+live\s+(?:near|close\s+to|around)\s+([a-z][a-z\s'-]{1,40})(?:,\s*([a-z]{2}|[a-z][a-z\s'-]{1,25}))?(?=$|[,.!?\s])/gi,
    kind: 'nearby',
    confidence: 0.85,
    primaryGroup: 1,
    secondaryGroup: 2,
  },
];

export const LOCATION_IDIOM_BLOCKLIST: Record<LocationPatternKind, string[]> = {
  residence: [
    'fear',
    'hope',
    'moment',
    'head',
    'denial',
    'pain',
    'peace',
    'chaos',
    'luxury',
    'misery',
  ],
  origin: ['mars', 'outer space', 'the future', 'the past', 'nowhere'],
  birthplace: ['january', 'february', 'march', 'april', 'may', 'june', 'july'],
  pastResidence: ['poverty', 'wealth', 'chaos'],
  workLocation: ['tech', 'technology', 'finance', 'sales', 'marketing'],
  movedTo: ['sleep', 'bed', 'work'],
  movedFromTo: [],
  visited: ['sleep', 'bed', 'work', 'hell', 'heaven'],
  currentLocation: ['trouble', 'love', 'pain', 'shock', 'denial'],
  nearby: [],
};

export const LOCATION_KNOWN_TERMS = new Set([
  'denmark',
  'copenhagen',
  'australia',
  'uk',
  'united kingdom',
  'usa',
  'united states',
  'canada',
  'france',
  'germany',
  'italy',
  'spain',
  'japan',
  'tokyo',
  'london',
  'paris',
  'berlin',
  'new york',
  'san francisco',
  'seattle',
  'bay area',
  'sweden',
  'norway',
  'finland',
]);

export const LOCATION_COMPANY_BLOCKLIST = new Set([
  'google',
  'microsoft',
  'apple',
  'amazon',
  'meta',
  'openai',
  'anthropic',
]);
