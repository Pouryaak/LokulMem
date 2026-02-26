import { describe, expect, it } from 'vitest';

import { runMemoryEval } from './runner.js';

type GateStage = 'A' | 'B' | 'C';

function parseGate(value: string | undefined): GateStage {
  if (value === 'A' || value === 'B' || value === 'C') {
    return value;
  }
  return 'A';
}

describe('memory eval harness', () => {
  it('passes configured gate', async () => {
    const gate = parseGate(process.env.EVAL_GATE);
    const result = await runMemoryEval(gate);

    console.log(`Memory eval gate ${gate} metrics:`, result.metrics);

    const failureMessage = result.failures.join('\n');
    expect(result.failures, failureMessage).toHaveLength(0);
  });
});
