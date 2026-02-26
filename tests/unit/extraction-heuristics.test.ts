import { describe, expect, it } from 'vitest';

describe('SpecificityNER heuristics', () => {
  it('captures routine preferences like coffee habits', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I drink coffee every morning');

    expect(result.memoryTypes).toContain('preference');
    expect(result.score).toBeGreaterThanOrEqual(0.4);
  });

  it('captures temporal change markers for supersession-like statements', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze(
      'I used to live in Denver but now I live in Austin',
    );

    expect(result.memoryTypes).toContain('temporal');
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it('treats email statements as high-signal identity memories', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('My email is alex.dev@example.com');

    expect(result.memoryTypes).toContain('identity');
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it('does not misclassify weekdays as places', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I usually work from home on Fridays');
    const placeEntities = result.entities
      .filter((entity) => entity.type === 'place')
      .map((entity) => entity.value);

    expect(placeEntities).not.toContain('fridays');
    expect(placeEntities).not.toContain('friday');
  });

  it('scores comparative preferences as meaningful memory candidates', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I prefer Vim over VS Code');

    expect(result.memoryTypes).toContain('preference');
    expect(result.score).toBeGreaterThanOrEqual(0.4);
  });

  it('does not extract lowercase intent phrases as person/place entities', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('im planning to move to australia soon');

    const personOrPlaceValues = result.entities
      .filter((entity) => entity.type === 'person' || entity.type === 'place')
      .map((entity) => entity.value);

    expect(personOrPlaceValues).not.toContain('planning to');
    expect(personOrPlaceValues).not.toContain('move to');
  });
});
