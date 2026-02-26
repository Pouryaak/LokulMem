export type NegationPatternKind =
  | 'simpleNegation'
  | 'emphaticNegation'
  | 'cessationNegation'
  | 'negativeContraction'
  | 'negativeVerb'
  | 'avoidanceVerb'
  | 'absenceVerb'
  | 'negativeAdverb'
  | 'implicitNegation'
  | 'replacementNegation'
  | 'correctionMarker'
  | 'explicitCorrection'
  | 'retraction'
  | 'clarification'
  | 'contradictionMarker'
  | 'contrastMarker'
  | 'exceptionMarker'
  | 'uncertaintyMarker'
  | 'doubtMarker'
  | 'speculationMarker'
  | 'conditionalMarker'
  | 'hypotheticalMarker'
  | 'desireMarker';

export interface NegationPattern {
  pattern: RegExp;
  kind: NegationPatternKind;
  scope: number;
  confidence: number;
  group?: number;
}

export const NEGATION_PATTERNS: NegationPattern[] = [
  {
    pattern: /\b(not|never|no|none|nobody|nothing|nowhere|neither)\b/gi,
    kind: 'simpleNegation',
    scope: 5,
    confidence: 0.95,
    group: 1,
  },
  {
    pattern: /\b(not\s+at\s+all|not\s+really|not\s+exactly|not\s+quite)\b/gi,
    kind: 'emphaticNegation',
    scope: 5,
    confidence: 0.96,
    group: 1,
  },
  {
    pattern: /\b(no\s+longer|no\s+more|not\s+anymore|not\s+any\s+longer)\b/gi,
    kind: 'cessationNegation',
    scope: 5,
    confidence: 0.94,
    group: 1,
  },
  {
    pattern:
      /\b(don['’]?t|doesn['’]?t|didn['’]?t|won['’]?t|wouldn['’]?t|shouldn['’]?t|couldn['’]?t|can['’]?t|cannot|isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t|hasn['’]?t|haven['’]?t|hadn['’]?t|ain['’]?t|shan['’]?t|mustn['’]?t|needn['’]?t)\b/gi,
    kind: 'negativeContraction',
    scope: 5,
    confidence: 0.94,
    group: 1,
  },
  {
    pattern:
      /\b(deny|denies|denied|denying|refuse|refuses|refused|refusing|reject|rejects|rejected|rejecting)\b/gi,
    kind: 'negativeVerb',
    scope: 5,
    confidence: 0.91,
    group: 1,
  },
  {
    pattern:
      /\b(avoid|avoids|avoided|avoiding|prevent|prevents|prevented|preventing|prohibit|prohibits|prohibited|prohibiting)\b/gi,
    kind: 'avoidanceVerb',
    scope: 5,
    confidence: 0.89,
    group: 1,
  },
  {
    pattern:
      /\b(lack|lacks|lacked|lacking|miss|misses|missed|missing|fail|fails|failed|failing)\b/gi,
    kind: 'absenceVerb',
    scope: 5,
    confidence: 0.88,
    group: 1,
  },
  {
    pattern:
      /\b(rarely|seldom|hardly|scarcely|barely|infrequently|hardly\s+ever|scarcely\s+ever)\b/gi,
    kind: 'negativeAdverb',
    scope: 5,
    confidence: 0.88,
    group: 1,
  },
  {
    pattern: /\b(without|lacking|absent|devoid\s+of|free\s+from|free\s+of)\b/gi,
    kind: 'implicitNegation',
    scope: 5,
    confidence: 0.86,
    group: 1,
  },
  {
    pattern:
      /\b(instead\s+of|rather\s+than|as\s+opposed\s+to|in\s+place\s+of)\b/gi,
    kind: 'replacementNegation',
    scope: 5,
    confidence: 0.85,
    group: 1,
  },
  {
    pattern:
      /\b(actually|in\s+fact|in\s+reality|truth\s+is|to\s+be\s+honest|honestly)\b/gi,
    kind: 'correctionMarker',
    scope: 10,
    confidence: 0.84,
    group: 1,
  },
  {
    pattern: /\b(correction|correcting|correct\s+that|let\s+me\s+correct)\b/gi,
    kind: 'explicitCorrection',
    scope: 10,
    confidence: 0.92,
    group: 1,
  },
  {
    pattern:
      /\b(scratch\s+that|forget\s+that|ignore\s+that|disregard\s+that)\b/gi,
    kind: 'retraction',
    scope: 10,
    confidence: 0.93,
    group: 1,
  },
  {
    pattern:
      /\b(i\s+mean|what\s+i\s+mean\s+is|to\s+clarify|let\s+me\s+clarify)\b/gi,
    kind: 'clarification',
    scope: 10,
    confidence: 0.86,
    group: 1,
  },
  {
    pattern:
      /\b(but|however|nevertheless|nonetheless|yet|still|though|although|even\s+though|despite|in\s+spite\s+of)\b/gi,
    kind: 'contradictionMarker',
    scope: 10,
    confidence: 0.82,
    group: 1,
  },
  {
    pattern:
      /\b(on\s+the\s+contrary|on\s+the\s+other\s+hand|conversely|in\s+contrast)\b/gi,
    kind: 'contrastMarker',
    scope: 10,
    confidence: 0.85,
    group: 1,
  },
  {
    pattern:
      /\b(except|except\s+for|excluding|aside\s+from|apart\s+from|other\s+than)\b/gi,
    kind: 'exceptionMarker',
    scope: 5,
    confidence: 0.84,
    group: 1,
  },
  {
    pattern:
      /\b(maybe|perhaps|possibly|probably|likely|unlikely|might|may|could)\b/gi,
    kind: 'uncertaintyMarker',
    scope: 5,
    confidence: 0.88,
    group: 1,
  },
  {
    pattern:
      /\b(not\s+sure|unsure|uncertain|unclear|doubtful|questionable)\b/gi,
    kind: 'doubtMarker',
    scope: 5,
    confidence: 0.9,
    group: 1,
  },
  {
    pattern:
      /\b(i\s+think|i\s+believe|i\s+guess|i\s+suppose|i\s+assume|i\s+imagine)\b/gi,
    kind: 'speculationMarker',
    scope: 5,
    confidence: 0.83,
    group: 1,
  },
  {
    pattern:
      /\b(if|unless|provided\s+that|assuming\s+that|supposing\s+that)\b/gi,
    kind: 'conditionalMarker',
    scope: 10,
    confidence: 0.87,
    group: 1,
  },
  {
    pattern:
      /\b(would|could|should|might\s+have|could\s+have|would\s+have|should\s+have)\b/gi,
    kind: 'hypotheticalMarker',
    scope: 5,
    confidence: 0.85,
    group: 1,
  },
  {
    pattern: /\b(wish|hope|want|desire|prefer)\b/gi,
    kind: 'desireMarker',
    scope: 5,
    confidence: 0.81,
    group: 1,
  },
];

export const NEGATION_TERMINATORS = new Set([
  '.',
  '!',
  '?',
  ';',
  ':',
  ',',
  'and',
  'or',
  'but',
  'yet',
  'so',
]);
