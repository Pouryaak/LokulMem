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

  it('detects lowercase profession statements as profession memories', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('i work as senior software engineer');

    expect(result.memoryTypes).toContain('profession');
    expect(result.score).toBeGreaterThanOrEqual(0.25);
  });

  it('does not misclassify marriage status as profession', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I am married');

    expect(result.memoryTypes).toContain('relational');
    expect(result.memoryTypes).not.toContain('profession');
  });

  it('extracts names from curated intro variants', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze("my name's pourya and you can call me pouya");
    const personValues = result.entities
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('identity');
    expect(personValues).toContain('pourya');
    expect(personValues).toContain('pouya');
  });

  it('does not treat profession phrases as names in intro forms', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('Im a senior software engineer');
    const personValues = result.entities
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.value);

    expect(personValues).not.toContain('senior software engineer');
    expect(result.memoryTypes).toContain('profession');
  });

  it('extracts employer from direct work statements', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I work at OpenAI');
    const orgValues = result.entities
      .filter((entity) => entity.type === 'organization')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('profession');
    expect(orgValues).toContain('openai');
  });

  it('captures self-employment patterns as profession', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I am self-employed and run my own agency');

    expect(result.memoryTypes).toContain('profession');
    expect(result.score).toBeGreaterThanOrEqual(0.25);
  });

  it('captures strict identity markers for age and pronouns', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze(
      "I'm 29 years old and my pronouns are they/them",
    );

    expect(result.memoryTypes).toContain('identity');
    expect(result.score).toBeGreaterThanOrEqual(0.2);
  });

  it('rejects idiomatic relationship phrases from identity markers', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I am married to my work');

    expect(result.memoryTypes).not.toContain('relational');
  });

  it('extracts named spouse relations', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze("My wife's name is Parastoo");
    const personValues = result.entities
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('relational');
    expect(personValues).toContain('parastoo');
  });

  it('captures unlabeled relation mentions without requiring names', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('My wife loves steak');

    expect(result.memoryTypes).toContain('relational');
  });

  it('captures lowercase residence locations from natural chat', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('i live in denmark');
    const placeValues = result.entities
      .filter((entity) => entity.type === 'place')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('location');
    expect(placeValues).toContain('denmark');
  });

  it('rejects non-location idioms in location patterns', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I live in fear');
    const placeValues = result.entities
      .filter((entity) => entity.type === 'place')
      .map((entity) => entity.value);

    expect(placeValues).not.toContain('fear');
  });

  it('does not classify work industries as locations', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I work in tech');
    const placeValues = result.entities
      .filter((entity) => entity.type === 'place')
      .map((entity) => entity.value);

    expect(placeValues).not.toContain('tech');
  });

  it('captures degree + major + institution education statements', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I earned a BS in computer science from MIT');
    const orgValues = result.entities
      .filter((entity) => entity.type === 'organization')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('identity');
    expect(orgValues).toContain('mit');
    expect(result.score).toBeGreaterThanOrEqual(0.2);
  });

  it('captures current student education statements', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze(
      "I'm currently studying machine learning at Stanford",
    );
    const orgValues = result.entities
      .filter((entity) => entity.type === 'organization')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('identity');
    expect(orgValues).toContain('stanford');
  });

  it('rejects education idioms and joke institutions', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const idiomResult = ner.analyze(
      'I graduated from the school of hard knocks',
    );
    const jokeOrgs = idiomResult.entities
      .filter((entity) => entity.type === 'organization')
      .map((entity) => entity.value);

    const activityResult = ner.analyze('I went to sleep early');
    const activityOrgs = activityResult.entities
      .filter((entity) => entity.type === 'organization')
      .map((entity) => entity.value);

    expect(jokeOrgs).toHaveLength(0);
    expect(activityOrgs).toHaveLength(0);
  });
});
