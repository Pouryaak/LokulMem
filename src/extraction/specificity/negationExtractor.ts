import type { Entity } from '../../types/memory.js';
import {
  NEGATION_PATTERNS,
  NEGATION_TERMINATORS,
  type NegationPatternKind,
} from '../patterns/negationPatterns.js';

export type NegationHandling = 'reject' | 'flag' | 'storeWithContext';

export interface NegationSignal {
  kind: NegationPatternKind;
  cue: string;
  confidence: number;
  strength: number;
  strategy: NegationHandling;
  scope: {
    start: number;
    end: number;
    text: string;
  };
}

export function extractNegationSignals(content: string): {
  signals: NegationSignal[];
  entities: Entity[];
} {
  const signals: NegationSignal[] = [];
  const entities: Entity[] = [];
  const seen = new Set<string>();

  const tokens = tokenize(content);

  for (const negationPattern of NEGATION_PATTERNS) {
    for (const match of content.matchAll(negationPattern.pattern)) {
      const raw = (match[0] ?? '').trim();
      if (!raw) continue;

      const cue = (
        negationPattern.group === undefined
          ? raw
          : (match[negationPattern.group] ?? raw)
      )
        .toLowerCase()
        .trim();

      if (!cue) continue;

      const startIndex =
        match.index ?? content.toLowerCase().indexOf(raw.toLowerCase());
      if (startIndex < 0) continue;

      const tokenIndex = charIndexToTokenIndex(tokens, startIndex);
      if (tokenIndex < 0) continue;

      if (shouldSkipByContext(negationPattern.kind, tokens, tokenIndex)) {
        continue;
      }

      const scope = calculateScope(tokens, tokenIndex, negationPattern.scope);
      const scopeText = tokens
        .slice(scope.start + 1, scope.end + 1)
        .map((token) => token.raw)
        .join(' ')
        .trim();

      const strength = getNegationStrength(negationPattern.kind, cue);
      const strategy = getHandlingStrategy(negationPattern.kind, strength);
      const confidence = adjustConfidence(
        negationPattern.confidence,
        negationPattern.kind,
        cue,
        scopeText,
      );

      const key = `${negationPattern.kind}:${cue}:${scope.start}:${scope.end}`;
      if (seen.has(key)) continue;
      seen.add(key);

      signals.push({
        kind: negationPattern.kind,
        cue,
        confidence,
        strength,
        strategy,
        scope: {
          start: scope.start,
          end: scope.end,
          text: scopeText,
        },
      });

      entities.push({
        type: 'negation',
        value: cue,
        raw,
        count: 1,
        confidence,
      });
    }
  }

  return { signals, entities };
}

function shouldSkipByContext(
  kind: NegationPatternKind,
  tokens: Token[],
  tokenIndex: number,
): boolean {
  const requiresContextKinds: NegationPatternKind[] = [
    'correctionMarker',
    'explicitCorrection',
    'retraction',
    'clarification',
    'contradictionMarker',
    'contrastMarker',
    'conditionalMarker',
    'hypotheticalMarker',
    'desireMarker',
  ];

  if (!requiresContextKinds.includes(kind)) {
    return false;
  }

  return !hasStrongCueNearby(tokens, tokenIndex, 8);
}

function hasStrongCueNearby(
  tokens: Token[],
  tokenIndex: number,
  window: number,
): boolean {
  const strongCues = new Set([
    'not',
    'never',
    'no',
    'none',
    'nothing',
    'nowhere',
    "don't",
    "doesn't",
    "didn't",
    "won't",
    "can't",
    'cannot',
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "hasn't",
    "haven't",
    "hadn't",
    'without',
    'lacking',
    'absent',
    'rarely',
    'seldom',
    'hardly',
    'barely',
    'no longer',
    'not anymore',
  ]);

  const start = Math.max(0, tokenIndex - window);
  const end = Math.min(tokens.length - 1, tokenIndex + window);
  const joined = tokens
    .slice(start, end + 1)
    .map((token) => token.raw.toLowerCase())
    .join(' ');

  if (joined.includes('no longer') || joined.includes('not anymore')) {
    return true;
  }

  for (let i = start; i <= end; i++) {
    const token = tokens[i];
    if (!token) continue;
    if (strongCues.has(token.normalized)) {
      return true;
    }
  }

  return false;
}

type Token = {
  raw: string;
  normalized: string;
  start: number;
  end: number;
};

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const raw = match[0] ?? '';
    const start = match.index ?? -1;
    if (start < 0) continue;

    tokens.push({
      raw,
      normalized: raw.toLowerCase().replace(/[^a-z0-9']/g, ''),
      start,
      end: start + raw.length - 1,
    });
  }
  return tokens;
}

function charIndexToTokenIndex(tokens: Token[], charIndex: number): number {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token && charIndex >= token.start && charIndex <= token.end) {
      return i;
    }
  }
  return -1;
}

function calculateScope(
  tokens: Token[],
  negationTokenIndex: number,
  defaultScope: number,
): { start: number; end: number } {
  let scopeEnd = Math.min(tokens.length - 1, negationTokenIndex + defaultScope);

  for (let i = negationTokenIndex + 1; i <= scopeEnd; i++) {
    const token = tokens[i];
    if (!token) continue;
    if (
      NEGATION_TERMINATORS.has(token.normalized) ||
      /[.!?;:,]$/.test(token.raw)
    ) {
      scopeEnd = i - 1;
      break;
    }
  }

  return {
    start: negationTokenIndex,
    end: Math.max(negationTokenIndex, scopeEnd),
  };
}

function getNegationStrength(kind: NegationPatternKind, cue: string): number {
  const strong = new Set([
    'not',
    'never',
    'no',
    'none',
    'nobody',
    'nothing',
    "don't",
    "doesn't",
    "didn't",
    "won't",
    "can't",
    'cannot',
  ]);

  const weak = new Set([
    'rarely',
    'seldom',
    'hardly',
    'scarcely',
    'barely',
    'maybe',
    'possibly',
    'probably',
  ]);

  if (strong.has(cue)) return 1.0;
  if (weak.has(cue)) return 0.5;

  if (kind === 'simpleNegation' || kind === 'negativeContraction') return 1.0;
  if (kind === 'uncertaintyMarker' || kind === 'speculationMarker') return 0.4;
  if (kind === 'hypotheticalMarker' || kind === 'desireMarker') return 0.3;
  if (kind === 'implicitNegation' || kind === 'replacementNegation') return 0.7;

  return 0.6;
}

function getHandlingStrategy(
  kind: NegationPatternKind,
  strength: number,
): NegationHandling {
  if (strength >= 0.9) return 'reject';
  if (kind === 'explicitCorrection' || kind === 'retraction') return 'reject';
  if (
    kind === 'uncertaintyMarker' ||
    kind === 'speculationMarker' ||
    kind === 'doubtMarker'
  ) {
    return 'flag';
  }
  if (kind === 'conditionalMarker' || kind === 'hypotheticalMarker') {
    return 'storeWithContext';
  }
  if (strength < 0.6) return 'storeWithContext';
  return 'reject';
}

function adjustConfidence(
  base: number,
  kind: NegationPatternKind,
  cue: string,
  scopeText: string,
): number {
  let confidence = base;

  if (!scopeText) {
    confidence -= 0.15;
  }

  if (
    (kind === 'simpleNegation' || kind === 'negativeContraction') &&
    cue.length <= 2
  ) {
    confidence -= 0.05;
  }

  if (detectDoubleNegation(scopeText, cue)) {
    confidence -= 0.2;
  }

  return Math.max(0.5, Math.min(0.98, confidence));
}

function detectDoubleNegation(scopeText: string, cue: string): boolean {
  const text = `${cue} ${scopeText}`.toLowerCase();
  const negationWords = [
    'not',
    'never',
    'no',
    'none',
    'nobody',
    'nothing',
    "don't",
    "doesn't",
    "didn't",
    "won't",
    "can't",
    'cannot',
  ];

  let count = 0;
  for (const word of negationWords) {
    const matches = text.match(
      new RegExp(`\\b${word.replace("'", "['’]?")}\\b`, 'g'),
    );
    if (matches) count += matches.length;
  }

  return count >= 2;
}
