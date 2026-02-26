import type { Entity, MemoryType } from '../../types/memory.js';

export function extractNumbers(content: string): Entity[] {
  const entities: Entity[] = [];
  const currencyPattern =
    /\$\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:dollars?|euros?|cents?)/gi;
  for (const match of content.matchAll(currencyPattern)) {
    const value = match[1] || match[2];
    if (!value) continue;
    entities.push({
      type: 'number',
      value,
      raw: match[0],
      count: 1,
      confidence: 0.95,
    });
  }

  for (const match of content.matchAll(/(\d+(?:\.\d+)?)\s*%/gi)) {
    if (!match[1]) continue;
    entities.push({
      type: 'number',
      value: match[1],
      raw: match[0],
      count: 1,
      confidence: 0.95,
    });
  }

  for (const match of content.matchAll(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/g)) {
    if (!match[1]) continue;
    entities.push({
      type: 'number',
      value: match[1].replace(/,/g, ''),
      raw: match[1],
      count: 1,
      confidence: 0.5,
    });
  }

  return entities;
}

export function extractPreferences(content: string): Entity[] {
  const entities: Entity[] = [];
  const preferPatterns = [
    /i\s+(?:really\s+)?(?:like|love|hate|enjoy|prefer|adore|can't stand)\s+([^.!?]+)/gi,
    /i\s+(?:usually\s+)?(?:drink|eat|use)\s+([^.!?]+)/gi,
  ];

  for (const pattern of preferPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (!match[1]) continue;
      const value = match[1].trim();
      if (value.length === 0 || value.length >= 100) continue;
      entities.push({
        type: 'preference',
        value: value.toLowerCase(),
        raw: value,
        count: 1,
        confidence: 0.85,
      });
    }
  }

  for (const match of content.matchAll(
    /([^.!?]+)\s+is\s+(?:my\s+)?favorite/gi,
  )) {
    if (!match[1]) continue;
    const value = match[1].trim();
    if (value.length === 0 || value.length >= 100) continue;
    entities.push({
      type: 'preference',
      value: value.toLowerCase(),
      raw: value,
      count: 1,
      confidence: 0.9,
    });
  }

  for (const match of content.matchAll(
    /(?:my|your)\s+favorite\s+\w+\s+is\s+([^.!?]+)/gi,
  )) {
    if (!match[1]) continue;
    const value = match[1].trim();
    if (value.length === 0 || value.length >= 100) continue;
    entities.push({
      type: 'preference',
      value: value.toLowerCase(),
      raw: value,
      count: 1,
      confidence: 0.9,
    });
  }

  for (const match of content.matchAll(
    /i\s+prefer\s+(\w+)\s+(?:over|to)\s+(\w+)/gi,
  )) {
    if (!(match[1] && match[2])) continue;
    entities.push({
      type: 'preference',
      value: `${match[1].toLowerCase()} over ${match[2].toLowerCase()}`,
      raw: match[0],
      count: 1,
      confidence: 0.9,
    });
  }

  return entities;
}

export function extractDates(content: string): Entity[] {
  const entities: Entity[] = [];
  for (const match of content.matchAll(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/g)) {
    if (!match[1]) continue;
    entities.push({
      type: 'date',
      value: match[1].replace(/\//g, '-'),
      raw: match[1],
      count: 1,
      confidence: 0.95,
    });
  }

  const monthPattern =
    /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/gi;
  for (const match of content.matchAll(monthPattern)) {
    if (!match[1]) continue;
    entities.push({
      type: 'date',
      value: match[1].toLowerCase(),
      raw: match[1],
      count: 1,
      confidence: 0.9,
    });
  }

  const relativePatterns = [
    /\btomorrow\b/gi,
    /\byesterday\b/gi,
    /\bnext\s+week\b/gi,
    /\blast\s+week\b/gi,
    /\bin\s+(\d+)\s+days?\b/gi,
    /\b(\d+)\s+days?\s+ago\b/gi,
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi,
  ];
  for (const pattern of relativePatterns) {
    for (const match of content.matchAll(pattern)) {
      entities.push({
        type: 'date',
        value: (match[0] ?? '').toLowerCase(),
        raw: match[0] ?? '',
        count: 1,
        confidence: 0.8,
      });
    }
  }

  return entities;
}

export function extractNegations(content: string): Entity[] {
  const entities: Entity[] = [];
  const patterns = [
    /\bnot\b/gi,
    /\bnever\b/gi,
    /\bdon't\b/gi,
    /\bdoesn't\b/gi,
    /\bdidn't\b/gi,
    /\bcan't\b/gi,
    /\bcannot\b/gi,
    /\bwon't\b/gi,
    /\bno longer\b/gi,
    /\bstopped\b/gi,
    /\bquit\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      entities.push({
        type: 'negation',
        value: match[0].toLowerCase(),
        raw: match[0],
        count: 1,
        confidence: 0.7,
      });
    }
  }
  return entities;
}

export function extractHabits(content: string): Entity[] {
  const entities: Entity[] = [];
  const patterns = [
    /\b(?:every|each)\s+(?:morning|afternoon|evening|night|day|week|month|year|weekend)\b/gi,
    /\b(?:usually|often|regularly|typically)\b/gi,
    /\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      entities.push({
        type: 'preference',
        value: (match[0] ?? '').toLowerCase(),
        raw: match[0] ?? '',
        count: 1,
        confidence: 0.75,
      });
    }
  }
  return entities;
}

export function extractTemporalChanges(content: string): Entity[] {
  const entities: Entity[] = [];
  const patterns = [
    /\bused to\b/gi,
    /\bno longer\b/gi,
    /\bnot anymore\b/gi,
    /\bformerly\b/gi,
    /\bpreviously\b/gi,
    /\bbut now\b/gi,
    /\bnow\s+i\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      entities.push({
        type: 'date',
        value: (match[0] ?? '').toLowerCase(),
        raw: match[0] ?? '',
        count: 1,
        confidence: 0.8,
      });
    }
  }
  return entities;
}

export function extractPreferenceComparisons(content: string): Entity[] {
  const entities: Entity[] = [];
  const comparePattern =
    /\bi\s+prefer\s+([a-zA-Z0-9+#.-]+(?:\s+[a-zA-Z0-9+#.-]+)?)\s+(?:over|to)\s+([a-zA-Z0-9+#.-]+(?:\s+[a-zA-Z0-9+#.-]+)?)\b/gi;
  for (const match of content.matchAll(comparePattern)) {
    if (!(match[1] && match[2])) continue;
    entities.push({
      type: 'preference',
      value: `${match[1].toLowerCase()} over ${match[2].toLowerCase()}`,
      raw: match[0] ?? '',
      count: 1,
      confidence: 0.9,
    });
  }
  return entities;
}

export function extractEmails(content: string): Entity[] {
  const entities: Entity[] = [];
  const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  for (const match of content.matchAll(emailPattern)) {
    if (!match[1]) continue;
    entities.push({
      type: 'person',
      value: match[1].toLowerCase(),
      raw: match[1],
      count: 1,
      confidence: 0.95,
    });
  }
  return entities;
}

export function extractNamedEntities(content: string): Entity[] {
  const entities: Entity[] = [];
  const namedPattern =
    /\b(?:named|called)\s+([A-Z][a-z]+(?:\s+(?:and\s+)?[A-Z][a-z]+)*)/g;
  for (const match of content.matchAll(namedPattern)) {
    if (!match[1]) continue;
    entities.push({
      type: 'person',
      value: match[1].toLowerCase(),
      raw: match[1],
      count: 1,
      confidence: 0.85,
    });
  }
  return entities;
}

export function extractPossessions(content: string): Entity[] {
  const entities: Entity[] = [];
  const possessionPatterns = [
    /\bmy\s+([a-z]+(?:\s+[a-z]+)?)\b/gi,
    /\bour\s+([a-z]+(?:\s+[a-z]+)?)\b/gi,
    /\bi\s+(?:have|own)\s+([^.!?]+)/gi,
  ];
  for (const pattern of possessionPatterns) {
    for (const match of content.matchAll(pattern)) {
      if (!match[1]) continue;
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

export function classifyMemoryTypes(
  content: string,
  types: MemoryType[],
  isProfessionPhrase: (value: string) => boolean,
): void {
  const lower = content.toLowerCase();

  if (
    (isProfessionPhrase(lower) ||
      /\b(?:i\s+work\s+as|i\s+work\s+at|i\s+am\s+a|i\s+am\s+an|i\s+am\s+the|i['’]?m\s+a|i['’]?m\s+an)\b/gi.test(
        lower,
      )) &&
    !types.includes('profession')
  ) {
    types.push('profession');
  }

  if (
    /\b(plan|goal|task|project|deadline|reminder|todo|schedule)\b/gi.test(
      lower,
    ) ||
    /\bi\s+need\s+to\b/gi.test(lower) ||
    /\bi'm\s+going\s+to\b/gi.test(lower)
  ) {
    if (!types.includes('project')) types.push('project');
  }

  if (
    /\b(mother|father|sister|brother|parent|child|son|daughter|friend|wife|husband|partner|family)\b/gi.test(
      lower,
    ) &&
    !types.includes('relational')
  ) {
    types.push('relational');
  }

  const isRelationshipIdiom =
    /\bmarried\s+to\s+(?:my\s+)?work\b/.test(lower) ||
    /\bsingle[-\s]handedly\b/.test(lower);
  if (
    !isRelationshipIdiom &&
    /\b(married|engaged|divorced|single)\b/gi.test(lower)
  ) {
    if (!types.includes('relational')) types.push('relational');
  }

  if (
    /\b(feel|feeling|happy|sad|angry|excited|nervous|worried|proud|disappointed)\b/gi.test(
      lower,
    ) &&
    !types.includes('emotional')
  ) {
    types.push('emotional');
  }
}
