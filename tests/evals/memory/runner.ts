import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Learner } from '../../../src/api/Learner.js';
import { SpecificityNER } from '../../../src/extraction/SpecificityNER.js';
import type { MemoryInternal } from '../../../src/internal/types.js';

type GateStage = 'A' | 'B' | 'C';
type PolicyAction = 'ADD' | 'UPDATE' | 'SUPERSEDE' | 'IGNORE';
type TemporalBucket =
  | 'current'
  | 'past'
  | 'future'
  | 'transition'
  | 'unspecified';

interface FixtureTurnExpectation {
  minExtracted?: number;
  maxExtracted?: number;
  requiredExtractedIncludes?: string[];
  forbiddenExtractedIncludes?: string[];
  requiredPolicyActions?: PolicyAction[];
  expectedTemporalBuckets?: TemporalBucket[];
  expectedCanonicalPredicates?: string[];
  minLinkedEntityCount?: number;
}

interface FixtureTurn {
  user: string;
  assistant: string;
  expect?: FixtureTurnExpectation;
}

interface EvalFixture {
  id: string;
  category: string;
  description: string;
  stabilityRuns?: number;
  turns: FixtureTurn[];
}

interface EvalMetrics {
  meaningfulRecall: number;
  noiseFalsePositiveRate: number;
  assistantContaminationRate: number;
  supersessionCorrectness: number;
  canonicalizationAccuracy: number;
  entityLinkAccuracy: number;
  temporalStateAccuracy: number;
  policyDecisionAccuracy: number;
  decisionStability: number;
}

interface Counter {
  pass: number;
  total: number;
}

interface EvalResult {
  metrics: EvalMetrics;
  failures: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const BASELINE_PATH = path.join(__dirname, 'baseline.json');

const ABSOLUTE_THRESHOLDS: EvalMetrics = {
  meaningfulRecall: 0.9,
  noiseFalsePositiveRate: 0.05,
  assistantContaminationRate: 0,
  supersessionCorrectness: 0.9,
  canonicalizationAccuracy: 0.95,
  entityLinkAccuracy: 0.85,
  temporalStateAccuracy: 0.9,
  policyDecisionAccuracy: 0.88,
  decisionStability: 1,
};

const REGRESSION_BUDGET: Partial<Record<keyof EvalMetrics, number>> = {
  meaningfulRecall: 0.03,
  noiseFalsePositiveRate: 0.01,
  assistantContaminationRate: 0,
  supersessionCorrectness: 0.03,
  canonicalizationAccuracy: 0.02,
  entityLinkAccuracy: 0.03,
  temporalStateAccuracy: 0.03,
  policyDecisionAccuracy: 0.03,
  decisionStability: 0.01,
};

function ratio(counter: Counter): number {
  if (counter.total === 0) {
    return 1;
  }
  return counter.pass / counter.total;
}

function lowerIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function loadFixtures(): EvalFixture[] {
  const fixtureFiles = readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();

  return fixtureFiles.map((name) => {
    const raw = readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
    return JSON.parse(raw) as EvalFixture;
  });
}

function loadBaseline(): EvalMetrics {
  const raw = readFileSync(BASELINE_PATH, 'utf8');
  return JSON.parse(raw) as EvalMetrics;
}

function createHarness() {
  const stored: MemoryInternal[] = [];

  const vectorSearch = {
    add: () => {},
    delete: () => {},
  };

  const repository = {
    bulkCreate: async (memories: MemoryInternal[]) => {
      stored.push(...memories);
    },
    findByStatus: async (status: MemoryInternal['status']) =>
      stored.filter((memory) => memory.status === status),
    getById: async (id: string) =>
      stored.find((memory) => memory.id === id) ?? null,
  };

  const qualityScorer = {
    score: async () => ({
      score: 0.82,
      novelty: 0.8,
      specificity: 0.8,
      recurrence: 0,
      meetsThreshold: true,
      threshold: 0.45,
    }),
  };

  const contradictionDetector = {
    detect: async () => [],
  };

  const supersessionManager = {
    applySupersession: async (event: {
      conflictingMemoryId: string;
      newMemoryId: string;
    }) => {
      const oldMemory = stored.find(
        (memory) => memory.id === event.conflictingMemoryId,
      );
      if (oldMemory) {
        oldMemory.status = 'superseded';
      }
      return {
        oldMemoryId: event.conflictingMemoryId,
        newMemoryId: event.newMemoryId,
        timestamp: Date.now(),
      };
    },
  };

  const embeddingEngine = {
    embed: async () => new Float32Array([0.2, 0.4, 0.6]),
  };

  const eventManager = {
    emit: () => {},
    createMemoryEvent: (memory: { id: string }) => ({ memoryId: memory.id }),
  };

  const fallbackExtractor = {
    extract: async () => ({
      facts: [],
      provider: 'noop' as const,
      model: 'none',
    }),
  };

  const learner = new Learner(
    {} as never,
    vectorSearch as never,
    repository as never,
    qualityScorer as never,
    contradictionDetector as never,
    supersessionManager as never,
    null,
    new SpecificityNER(),
    {} as never,
    {} as never,
    embeddingEngine as never,
    eventManager as never,
    {
      extractionThreshold: 0.45,
      fallbackExtractor,
    },
  );

  return { learner };
}

function extractTemporalBuckets(extracted: Array<{ metadata?: unknown }>) {
  const buckets: string[] = [];

  for (const item of extracted) {
    const metadata = item.metadata as {
      canonical?: { temporalBucket?: string; predicate?: string };
    };
    const bucket = metadata?.canonical?.temporalBucket;
    if (bucket) {
      buckets.push(bucket);
    }
  }

  return buckets;
}

function extractPredicates(extracted: Array<{ metadata?: unknown }>) {
  const predicates: string[] = [];

  for (const item of extracted) {
    const metadata = item.metadata as {
      canonical?: { temporalBucket?: string; predicate?: string };
    };
    const predicate = metadata?.canonical?.predicate;
    if (predicate) {
      predicates.push(predicate);
    }
  }

  return predicates;
}

async function evaluateFixture(
  fixture: EvalFixture,
  counters: {
    meaningful: Counter;
    noise: Counter;
    contamination: Counter;
    supersession: Counter;
    canonicalization: Counter;
    entityLink: Counter;
    temporal: Counter;
    policy: Counter;
    stability: Counter;
  },
): Promise<{ failures: string[]; signature: string }> {
  const failures: string[] = [];
  const { learner } = createHarness();
  const signatureParts: string[] = [];

  for (let turnIndex = 0; turnIndex < fixture.turns.length; turnIndex++) {
    const turn = fixture.turns[turnIndex];
    if (!turn) {
      continue;
    }
    const result = await learner.learn(
      { role: 'user', content: turn.user },
      { role: 'assistant', content: turn.assistant },
      {
        conversationId: fixture.id,
        verbose: true,
      },
    );

    const extractedContents = result.extracted.map((item) => item.content);
    const extractedLower = extractedContents.map((item) => item.toLowerCase());
    const policyActions = (result.diagnostics ?? [])
      .map((item) => item.policyAction)
      .filter((item): item is PolicyAction => item !== undefined);

    const linkedEntityCount = Math.max(
      0,
      ...(result.diagnostics ?? []).map((item) => item.linkedEntityCount ?? 0),
    );
    const temporalBuckets = extractTemporalBuckets(result.extracted);
    const canonicalPredicates = extractPredicates(result.extracted);

    signatureParts.push(
      `${turnIndex}:${extractedLower.sort().join('|')}::${policyActions
        .slice()
        .sort()
        .join('|')}`,
    );

    const expectation = turn.expect;
    if (!expectation) {
      continue;
    }

    if (expectation.minExtracted !== undefined) {
      if (result.extracted.length < expectation.minExtracted) {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: extracted ${result.extracted.length}, expected at least ${expectation.minExtracted}`,
        );
      }
    }

    if (expectation.maxExtracted !== undefined) {
      counters.noise.total += 1;
      if (result.extracted.length <= expectation.maxExtracted) {
        counters.noise.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: extracted ${result.extracted.length}, expected at most ${expectation.maxExtracted}`,
        );
      }
    }

    for (const required of expectation.requiredExtractedIncludes ?? []) {
      counters.meaningful.total += 1;
      const matched = extractedLower.some((candidate) =>
        lowerIncludes(candidate, required),
      );
      if (matched) {
        counters.meaningful.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: missing required extraction '${required}'`,
        );
      }
    }

    for (const forbidden of expectation.forbiddenExtractedIncludes ?? []) {
      counters.noise.total += 1;
      const violated = extractedLower.some((candidate) =>
        lowerIncludes(candidate, forbidden),
      );
      if (!violated) {
        counters.noise.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: forbidden extraction '${forbidden}' was persisted`,
        );
      }
    }

    for (const expectedAction of expectation.requiredPolicyActions ?? []) {
      counters.policy.total += 1;
      const matched = policyActions.includes(expectedAction);
      if (matched) {
        counters.policy.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: missing policy action '${expectedAction}'`,
        );
      }

      if (expectedAction === 'SUPERSEDE') {
        counters.supersession.total += 1;
        if (matched) {
          counters.supersession.pass += 1;
        }
      }
    }

    for (const expectedBucket of expectation.expectedTemporalBuckets ?? []) {
      counters.temporal.total += 1;
      if (temporalBuckets.includes(expectedBucket)) {
        counters.temporal.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: missing temporal bucket '${expectedBucket}'`,
        );
      }
    }

    for (const expectedPredicate of expectation.expectedCanonicalPredicates ??
      []) {
      counters.canonicalization.total += 1;
      if (canonicalPredicates.includes(expectedPredicate)) {
        counters.canonicalization.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: missing canonical predicate '${expectedPredicate}'`,
        );
      }
    }

    if (expectation.minLinkedEntityCount !== undefined) {
      counters.entityLink.total += 1;
      if (linkedEntityCount >= expectation.minLinkedEntityCount) {
        counters.entityLink.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: linkedEntityCount ${linkedEntityCount}, expected at least ${expectation.minLinkedEntityCount}`,
        );
      }
    }

    if (fixture.category === 'assistant_contamination') {
      counters.contamination.total += 1;
      if (result.extracted.length === 0) {
        counters.contamination.pass += 1;
      } else {
        failures.push(
          `${fixture.id} turn ${turnIndex + 1}: assistant contamination detected (${result.extracted.length} extraction(s))`,
        );
      }
    }
  }

  return {
    failures,
    signature: signatureParts.join('##'),
  };
}

function applyGateChecks(
  gate: GateStage,
  metrics: EvalMetrics,
  baseline: EvalMetrics,
): string[] {
  const failures: string[] = [];

  if (metrics.assistantContaminationRate > 0) {
    failures.push(
      `assistantContaminationRate=${metrics.assistantContaminationRate.toFixed(3)} expected 0`,
    );
  }

  if (gate === 'A') {
    return failures;
  }

  for (const key of Object.keys(metrics) as Array<keyof EvalMetrics>) {
    const budget = REGRESSION_BUDGET[key] ?? 0;
    const current = metrics[key];
    const base = baseline[key];

    if (
      key === 'noiseFalsePositiveRate' ||
      key === 'assistantContaminationRate'
    ) {
      if (current > base + budget) {
        failures.push(
          `regression ${key}: current=${current.toFixed(3)} baseline=${base.toFixed(3)} budget=+${budget.toFixed(3)}`,
        );
      }
    } else if (current < base - budget) {
      failures.push(
        `regression ${key}: current=${current.toFixed(3)} baseline=${base.toFixed(3)} budget=-${budget.toFixed(3)}`,
      );
    }
  }

  if (gate !== 'C') {
    return failures;
  }

  for (const key of Object.keys(metrics) as Array<keyof EvalMetrics>) {
    const current = metrics[key];
    const threshold = ABSOLUTE_THRESHOLDS[key];
    if (
      key === 'noiseFalsePositiveRate' ||
      key === 'assistantContaminationRate'
    ) {
      if (current > threshold) {
        failures.push(
          `threshold ${key}: current=${current.toFixed(3)} exceeds max=${threshold.toFixed(3)}`,
        );
      }
    } else if (current < threshold) {
      failures.push(
        `threshold ${key}: current=${current.toFixed(3)} below min=${threshold.toFixed(3)}`,
      );
    }
  }

  return failures;
}

export async function runMemoryEval(gate: GateStage): Promise<EvalResult> {
  const fixtures = loadFixtures();
  const baseline = loadBaseline();

  const counters = {
    meaningful: { pass: 0, total: 0 },
    noise: { pass: 0, total: 0 },
    contamination: { pass: 0, total: 0 },
    supersession: { pass: 0, total: 0 },
    canonicalization: { pass: 0, total: 0 },
    entityLink: { pass: 0, total: 0 },
    temporal: { pass: 0, total: 0 },
    policy: { pass: 0, total: 0 },
    stability: { pass: 0, total: 0 },
  };

  const failures: string[] = [];

  for (const fixture of fixtures) {
    const firstRun = await evaluateFixture(fixture, counters);
    failures.push(...firstRun.failures);

    const runs = Math.max(2, fixture.stabilityRuns ?? 3);
    counters.stability.total += 1;
    let stable = true;
    for (let i = 1; i < runs; i++) {
      const repeat = await evaluateFixture(fixture, {
        meaningful: { pass: 0, total: 0 },
        noise: { pass: 0, total: 0 },
        contamination: { pass: 0, total: 0 },
        supersession: { pass: 0, total: 0 },
        canonicalization: { pass: 0, total: 0 },
        entityLink: { pass: 0, total: 0 },
        temporal: { pass: 0, total: 0 },
        policy: { pass: 0, total: 0 },
        stability: { pass: 0, total: 0 },
      });

      if (repeat.signature !== firstRun.signature) {
        stable = false;
      }
    }
    if (stable) {
      counters.stability.pass += 1;
    } else {
      failures.push(
        `${fixture.id}: unstable output across repeated runs (decision stability failed)`,
      );
    }
  }

  const metrics: EvalMetrics = {
    meaningfulRecall: ratio(counters.meaningful),
    noiseFalsePositiveRate: 1 - ratio(counters.noise),
    assistantContaminationRate: 1 - ratio(counters.contamination),
    supersessionCorrectness: ratio(counters.supersession),
    canonicalizationAccuracy: ratio(counters.canonicalization),
    entityLinkAccuracy: ratio(counters.entityLink),
    temporalStateAccuracy: ratio(counters.temporal),
    policyDecisionAccuracy: ratio(counters.policy),
    decisionStability: ratio(counters.stability),
  };

  const gateFailures = applyGateChecks(gate, metrics, baseline);
  failures.push(...gateFailures);

  return {
    metrics,
    failures,
  };
}
