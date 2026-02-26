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
});
