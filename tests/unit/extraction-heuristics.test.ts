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

  it('extracts explicit negative preference subjects', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze("I don't like mushrooms");
    const preferenceValues = result.entities
      .filter((entity) => entity.type === 'preference')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('preference');
    expect(preferenceValues).toContain('mushrooms');
  });

  it('rejects like/love linguistic false positives', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const likeResult = ner.analyze("I'd like to travel next year");
    const loveResult = ner.analyze('I love you');
    const likePrefs = likeResult.entities.filter(
      (entity) => entity.type === 'preference',
    );
    const lovePrefs = loveResult.entities.filter(
      (entity) => entity.type === 'preference',
    );

    expect(likePrefs).toHaveLength(0);
    expect(lovePrefs).toHaveLength(0);
  });

  it('rejects into-trouble and hate-to-say false positives', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const intoResult = ner.analyze("I'm into trouble again");
    const hateResult = ner.analyze('I hate to say this, but it is true');

    const intoPrefs = intoResult.entities.filter(
      (entity) => entity.type === 'preference',
    );
    const hatePrefs = hateResult.entities.filter(
      (entity) => entity.type === 'preference',
    );

    expect(intoPrefs).toHaveLength(0);
    expect(hatePrefs).toHaveLength(0);
  });

  it('captures routine schedules with explicit time', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I wake up at 7am');
    const preferenceValues = result.entities
      .filter((entity) => entity.type === 'preference')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('preference');
    expect(preferenceValues).toContain('wake up');
  });

  it('rejects cognitive routine false positives', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I usually think in the morning');
    const preferenceValues = result.entities
      .filter((entity) => entity.type === 'preference')
      .map((entity) => entity.value);

    expect(preferenceValues).not.toContain('think');
  });

  it('captures temporal routine changes like stopped and no longer', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I stopped smoking and no longer drink soda');

    expect(result.memoryTypes).toContain('temporal');
    expect(result.score).toBeGreaterThanOrEqual(0.25);
  });

  it('normalizes absolute month-day-year dates to ISO', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('My event is on January 15, 2024');
    const dateValues = result.entities
      .filter((entity) => entity.type === 'date')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('temporal');
    expect(dateValues).toContain('2024-01-15');
  });

  it('normalizes 12-hour times to 24-hour format', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I have a meeting at 3:30pm');
    const dateValues = result.entities
      .filter((entity) => entity.type === 'date')
      .map((entity) => entity.value);

    expect(dateValues).toContain('15:30');
  });

  it('does not misclassify plain numeric counts as years', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I have 2024 followers on social media');
    const dateValues = result.entities
      .filter((entity) => entity.type === 'date')
      .map((entity) => entity.value);

    expect(dateValues).not.toContain('2024');
  });

  it('does not treat greeting phrases as temporal facts', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('Good morning everyone');
    const dateValues = result.entities
      .filter((entity) => entity.type === 'date')
      .map((entity) => entity.value);

    expect(dateValues).toHaveLength(0);
  });

  it('captures medical condition and medication as identity health facts', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('I have diabetes and I take metformin daily');
    const preferenceValues = result.entities
      .filter((entity) => entity.type === 'preference')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('identity');
    expect(preferenceValues).toContain('diabetes');
    expect(preferenceValues).toContain('metformin');
  });

  it('captures critical allergy statements', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze("I'm allergic to penicillin");
    const preferenceValues = result.entities
      .filter((entity) => entity.type === 'preference')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('identity');
    expect(preferenceValues).toContain('penicillin');
  });

  it('rejects non-medical health false positives', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const conditionResult = ner.analyze('I have a car');
    const medicationResult = ner.analyze("I'm taking a break");

    const conditionPrefs = conditionResult.entities
      .filter((entity) => entity.type === 'preference')
      .map((entity) => entity.value);
    const medicationPrefs = medicationResult.entities
      .filter((entity) => entity.type === 'preference')
      .map((entity) => entity.value);

    expect(conditionPrefs).not.toContain('car');
    expect(medicationPrefs).not.toContain('break');
  });

  it('extracts email and phone as contact identity signals', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze(
      'You can reach me at alex.dev@example.com or (415) 628-1234',
    );
    const personValues = result.entities
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.value);
    const numberValues = result.entities
      .filter((entity) => entity.type === 'number')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('identity');
    expect(personValues).toContain('alex.dev@example.com');
    expect(numberValues).toContain('+14156281234');
  });

  it('rejects invalid name adjectives in contact intros', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze("I'm American");
    const personValues = result.entities
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.value);

    expect(personValues).not.toContain('american');
  });

  it('extracts relationship contacts as relational signals', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('John Smith is my colleague');
    const personValues = result.entities
      .filter((entity) => entity.type === 'person')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('relational');
    expect(personValues).toContain('john smith');
  });

  it('extracts address information as location contact data', async () => {
    const { SpecificityNER } = await import(
      '../../src/extraction/SpecificityNER.js'
    );
    const ner = new SpecificityNER();

    const result = ner.analyze('My address is 123 Main Street');
    const placeValues = result.entities
      .filter((entity) => entity.type === 'place')
      .map((entity) => entity.value);

    expect(result.memoryTypes).toContain('location');
    expect(placeValues).toContain('123 main st');
  });
});
