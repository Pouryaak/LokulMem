export type IdentityPatternKind =
  | 'age'
  | 'ageRange'
  | 'pronouns'
  | 'relationshipStatus'
  | 'childrenCount'
  | 'parentalStatus'
  | 'nativeLanguage';

export interface IdentityPattern {
  pattern: RegExp;
  group: number;
  kind: IdentityPatternKind;
  confidence: number;
}

export const IDENTITY_PATTERNS: IdentityPattern[] = [
  {
    pattern:
      /(?:i['’]?m|i\s+am)\s+(\d{1,3})\s+(?:years?\s+old|yrs?\s+old|yo)(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'age',
    confidence: 0.95,
  },
  {
    pattern: /i\s+just\s+turned\s+(\d{1,3})(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'age',
    confidence: 0.92,
  },
  {
    pattern: /my\s+age\s+is\s+(\d{1,3})(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'age',
    confidence: 0.93,
  },
  {
    // Bare "I'm 29" / "I am 29" without "years old" suffix
    // Lower confidence since the number could theoretically be something else
    pattern:
      /(?:i['']?m|i\s+am)\s+(\d{1,3})(?=$|[,.!?\s])(?!\s+(?:years?\s+old|yrs?\s+old|yo\b))/gi,
    group: 1,
    kind: 'age',
    confidence: 0.8,
  },
  {
    pattern:
      /(?:i['’]?m|i\s+am)\s+in\s+my\s+(early|mid|late)\s+(twenties|thirties|forties|fifties|sixties|seventies|eighties)(?=$|[,.!?\s])/gi,
    group: 0,
    kind: 'ageRange',
    confidence: 0.88,
  },
  {
    pattern:
      /my\s+pronouns\s+are\s+(he\/him|she\/her|they\/them|he\/they|she\/they|ze\/zir|xe\/xem|any\s+pronouns)(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'pronouns',
    confidence: 0.96,
  },
  {
    pattern:
      /i\s+use\s+(he\/him|she\/her|they\/them|he\/they|she\/they|ze\/zir|xe\/xem)\s+pronouns(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'pronouns',
    confidence: 0.95,
  },
  {
    pattern:
      /(?:i['’]?m|i\s+am)\s+(married|single|divorced|widowed|engaged|in\s+a\s+relationship|dating)(?!\s+to\s+(?:my\s+)?work)(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'relationshipStatus',
    confidence: 0.89,
  },
  {
    pattern: /i\s+have\s+(\d+)\s+(?:kids?|children)(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'childrenCount',
    confidence: 0.92,
  },
  {
    pattern:
      /(?:i['’]?m|i\s+am)\s+a\s+(father|mother|parent|dad|mom|single\s+parent)(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'parentalStatus',
    confidence: 0.88,
  },
  {
    pattern: /my\s+(?:first|native)\s+language\s+is\s+([a-z]+)(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'nativeLanguage',
    confidence: 0.9,
  },
  {
    pattern:
      /(?:i['’]?m|i\s+am)\s+(?:a\s+)?native\s+([a-z]+)\s+speaker(?=$|[,.!?\s])/gi,
    group: 1,
    kind: 'nativeLanguage',
    confidence: 0.87,
  },
];

export const LANGUAGE_ALLOWLIST = new Set([
  'english',
  'spanish',
  'french',
  'german',
  'italian',
  'portuguese',
  'dutch',
  'swedish',
  'norwegian',
  'danish',
  'finnish',
  'polish',
  'russian',
  'ukrainian',
  'turkish',
  'arabic',
  'hebrew',
  'persian',
  'hindi',
  'urdu',
  'bengali',
  'punjabi',
  'mandarin',
  'cantonese',
  'japanese',
  'korean',
  'thai',
  'vietnamese',
  'indonesian',
  'malay',
  'swahili',
  'amharic',
  'yoruba',
  'igbo',
  'zulu',
  'greek',
  'czech',
  'romanian',
  'hungarian',
  'serbian',
  'croatian',
]);
