import { describe, expect, it } from 'vitest';

import { AmbiguityTrigger } from '../../src/extraction/AmbiguityTrigger.js';

describe('AmbiguityTrigger', () => {
  it('triggers fallback in gray-zone score band', () => {
    const trigger = new AmbiguityTrigger();

    const decision = trigger.evaluate({
      content: 'I live in Austin',
      score: 0.48,
      threshold: 0.45,
      memoryTypes: ['location'],
      entityCount: 1,
      temporalBucket: 'current',
    });

    expect(decision.shouldTriggerFallback).toBe(true);
    expect(decision.reasons).toContain('GRAY_ZONE_SCORE');
  });

  it('triggers for unresolved temporal phrasing', () => {
    const trigger = new AmbiguityTrigger();

    const decision = trigger.evaluate({
      content: 'I currently might move next week',
      score: 0.72,
      threshold: 0.45,
      memoryTypes: ['project'],
      entityCount: 0,
      temporalBucket: 'unspecified',
    });

    expect(decision.shouldTriggerFallback).toBe(true);
    expect(decision.reasons).toContain('UNRESOLVED_TEMPORAL_SHIFT');
  });

  it('triggers for weak first-person personal fact cues', () => {
    const trigger = new AmbiguityTrigger();

    const decision = trigger.evaluate({
      content: "Im married and my wife's name is Parastoo",
      score: 0.29,
      threshold: 0.45,
      memoryTypes: ['relational'],
      entityCount: 0,
      temporalBucket: 'unspecified',
    });

    expect(decision.shouldTriggerFallback).toBe(true);
    expect(decision.reasons).toContain('PERSONAL_FACT_CUE');
  });

  it('does not trigger for non-personal small talk', () => {
    const trigger = new AmbiguityTrigger();

    const decision = trigger.evaluate({
      content: 'hi there',
      score: 0.2,
      threshold: 0.45,
      memoryTypes: [],
      entityCount: 0,
      temporalBucket: 'unspecified',
    });

    expect(decision.shouldTriggerFallback).toBe(false);
    expect(decision.reasons).toEqual([]);
  });
});
