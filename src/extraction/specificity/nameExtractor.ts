import type { Entity } from '../../types/memory.js';
import { isProfessionPhrase } from './professionExtractor.js';

export function extractNames(
  content: string,
  isCommonWord: (word: string) => boolean,
): Entity[] {
  const entities: Entity[] = [];
  const nameToken = `[A-Za-z][A-Za-z'’-]{1,30}`;
  const nameSequence = `(${nameToken}(?:\\s+${nameToken}){0,2})`;

  const nameIntroPatterns: Array<{ pattern: RegExp; confidence: number }> = [
    {
      pattern: new RegExp(
        `(?:my\\s+name\\s+is|my\\s+name['’]?s|my\\s+full\\s+name\\s+is)\\s+${nameSequence}`,
        'gi',
      ),
      confidence: 0.95,
    },
    {
      pattern: new RegExp(
        `(?:^|\\s)(?:i['’]?m|im|i\\s+am)\\s+${nameSequence}(?=$|[,.!?])`,
        'gi',
      ),
      confidence: 0.9,
    },
    {
      pattern: new RegExp(
        `(?:call\\s+me|you\\s+can\\s+call\\s+me|just\\s+call\\s+me|i\\s+go\\s+by|i\\s+am\\s+called|i\\s+am\\s+known\\s+as)\\s+${nameSequence}`,
        'gi',
      ),
      confidence: 0.88,
    },
    {
      pattern: new RegExp(
        `(?:my\\s+nickname\\s+is|aka|a\\.k\\.a\\.)\\s+${nameSequence}`,
        'gi',
      ),
      confidence: 0.82,
    },
  ];

  const seen = new Set<string>();
  for (const { pattern, confidence } of nameIntroPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const candidate = match[1]?.replace(/\s+(?:and|or|but)\b.*$/i, '').trim();
      if (!candidate || !isLikelyNameCandidate(candidate)) continue;

      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      entities.push({
        type: 'person',
        value: key,
        raw: candidate,
        count: 1,
        confidence,
      });
    }
  }

  const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const capitalizedMatches = content.matchAll(capitalizedPattern);
  for (const match of capitalizedMatches) {
    if (match[1] && !isCommonWord(match[1])) {
      entities.push({
        type: 'person',
        value: match[1].toLowerCase(),
        raw: match[1],
        count: 1,
        confidence: 0.6,
      });
    }
  }

  return entities;
}

export function isLikelyNameCandidate(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  if (!normalized) return false;
  if (!/^[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,2}$/.test(normalized))
    return false;

  const blockedPhrases = new Set([
    'married',
    'single',
    'engaged',
    'divorced',
    'happy',
    'sad',
    'tired',
    'hungry',
    'ready',
    'from denmark',
    'software engineer',
    'senior software engineer',
    'new job',
    'my wife',
    'my husband',
    'american',
    'british',
    'canadian',
    'european',
    'asian',
  ]);
  if (blockedPhrases.has(normalized)) return false;

  if (
    isProfessionPhrase(normalized) ||
    /\b(wife|husband|partner|friend|family|job|career|project|plan)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  if (
    /^(?:planning\s+to|going\s+to|gonna\s+|need\s+to|want\s+to|working\s+on|work\s+as|work\s+at)/.test(
      normalized,
    )
  ) {
    return false;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 3) return false;

  const blockedTokens = new Set([
    'and',
    'or',
    'but',
    'you',
    'your',
    'my',
    'the',
    'is',
    'am',
  ]);
  return tokens.every((token) => !blockedTokens.has(token));
}
