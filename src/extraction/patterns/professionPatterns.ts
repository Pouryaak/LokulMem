export type ProfessionPatternKind =
  | 'company'
  | 'role'
  | 'industry'
  | 'workMode'
  | 'selfEmployment';

export interface ProfessionPattern {
  pattern: RegExp;
  group: number;
  kind: ProfessionPatternKind;
  confidence: number;
}

const companyPatterns: ProfessionPattern[] = [
  {
    pattern:
      /i\s+(?:currently\s+)?work\s+(?:at|for)\s+([a-z][a-z0-9&.'-]*(?:\s+[a-z0-9][a-z0-9&.'-]*){0,4})(?=$|[,.!?])/gi,
    group: 1,
    kind: 'company',
    confidence: 0.86,
  },
  {
    pattern:
      /i['’]?m\s+employed\s+(?:at|by|with)\s+([a-z][a-z0-9&.'-]*(?:\s+[a-z0-9][a-z0-9&.'-]*){0,4})(?=$|[,.!?])/gi,
    group: 1,
    kind: 'company',
    confidence: 0.88,
  },
  {
    pattern:
      /i\s+(?:joined|started\s+at)\s+([a-z][a-z0-9&.'-]*(?:\s+[a-z0-9][a-z0-9&.'-]*){0,4})(?=$|[,.!?])/gi,
    group: 1,
    kind: 'company',
    confidence: 0.84,
  },
];

const rolePatterns: ProfessionPattern[] = [
  {
    pattern:
      /i\s+work\s+as\s+(?:a|an)?\s*([a-z][a-z0-9+#/.'-]*(?:\s+[a-z0-9+#/.'-]+){0,5})(?=$|\s+(?:at|for|with)\b|[,.!?])/gi,
    group: 1,
    kind: 'role',
    confidence: 0.9,
  },
  {
    pattern:
      /(?:i['’]?m|im|i\s+am)\s+(?:a|an)\s+([a-z][a-z0-9+#/.'-]*(?:\s+[a-z0-9+#/.'-]+){0,5})(?=$|\s+(?:at|for|with)\b|[,.!?])/gi,
    group: 1,
    kind: 'role',
    confidence: 0.86,
  },
  {
    pattern:
      /my\s+(?:job|role|position)\s+is\s+([a-z][a-z0-9+#/.'-]*(?:\s+[a-z0-9+#/.'-]+){0,5})(?=$|\s+(?:at|for|with)\b|[,.!?])/gi,
    group: 1,
    kind: 'role',
    confidence: 0.84,
  },
  {
    pattern: /i\s+do\s+([a-z][a-z\s-]{1,35})\s+for\s+a\s+living/gi,
    group: 1,
    kind: 'role',
    confidence: 0.82,
  },
  {
    pattern: /i\s+practice\s+(law|medicine|dentistry|accounting|engineering)/gi,
    group: 1,
    kind: 'role',
    confidence: 0.84,
  },
];

const industryPatterns: ProfessionPattern[] = [
  {
    pattern:
      /i\s+work\s+in\s+([a-z][a-z\s-]{1,35})(?=$|\s+(?:industry|field|sector)\b|[,.!?])/gi,
    group: 1,
    kind: 'industry',
    confidence: 0.78,
  },
  {
    pattern:
      /i['’]?m\s+in\s+(?:the\s+)?([a-z][a-z\s-]{1,30})\s+(?:industry|field|sector)/gi,
    group: 1,
    kind: 'industry',
    confidence: 0.8,
  },
];

const workModePatterns: ProfessionPattern[] = [
  {
    pattern:
      /i\s+work\s+from\s+(home|my\s+home|my\s+office|a\s+home\s+office|remotely|anywhere)(?=$|[,.!?])/gi,
    group: 1,
    kind: 'workMode',
    confidence: 0.72,
  },
  {
    pattern: /i['’]?m\s+(?:fully\s+)?remote(?=$|[,.!?])/gi,
    group: 0,
    kind: 'workMode',
    confidence: 0.72,
  },
];

const selfEmploymentPatterns: ProfessionPattern[] = [
  {
    pattern:
      /(?:i['’]?m|i\s+am)\s+(self-employed|freelancing|a\s+freelancer|an\s+independent\s+contractor|a\s+consultant|consulting)(?=$|\s+and\b|[,.!?])/gi,
    group: 1,
    kind: 'selfEmployment',
    confidence: 0.86,
  },
  {
    pattern:
      /(?:i\s+)?run\s+(?:my\s+own|a)\s+(business|company|startup|agency|firm|practice)(?=$|[,.!?])/gi,
    group: 1,
    kind: 'selfEmployment',
    confidence: 0.84,
  },
  {
    pattern:
      /i['’]?m\s+(?:a|the)\s+(?:founder|co-founder|owner)\s+of\s+([a-z][a-z0-9&.'-]*(?:\s+[a-z0-9][a-z0-9&.'-]*){0,5})(?=$|[,.!?])/gi,
    group: 1,
    kind: 'selfEmployment',
    confidence: 0.88,
  },
];

export const PROFESSION_PATTERNS: ProfessionPattern[] = [
  ...companyPatterns,
  ...rolePatterns,
  ...industryPatterns,
  ...workModePatterns,
  ...selfEmploymentPatterns,
];

export const PROFESSION_KEYWORDS = [
  'engineer',
  'developer',
  'designer',
  'architect',
  'manager',
  'director',
  'lead',
  'consultant',
  'analyst',
  'accountant',
  'founder',
  'cto',
  'ceo',
  'nurse',
  'doctor',
  'lawyer',
  'teacher',
  'researcher',
  'scientist',
  'product manager',
  'software',
  'programmer',
  'bodybuilder',
  'freelancer',
  'contractor',
  'owner',
  'operator',
  'specialist',
  'administrator',
  'technician',
] as const;
