export type CandidateSource = 'deterministic' | 'fallback';

export interface CandidateFusionInput {
  source: CandidateSource;
  canonicalKey: string;
  score: number;
  threshold: number;
  accepted: boolean;
  fallbackConfidence?: number;
}

export interface CandidateFusionDecision {
  canonicalKey: string;
  accepted: boolean;
  source: CandidateSource;
  agreement: boolean;
}

export class CandidateFusion {
  calibrate(inputs: CandidateFusionInput[]): CandidateFusionDecision[] {
    const byKey = new Map<string, CandidateFusionInput[]>();
    for (const input of inputs) {
      if (!byKey.has(input.canonicalKey)) {
        byKey.set(input.canonicalKey, []);
      }
      byKey.get(input.canonicalKey)?.push(input);
    }

    const output: CandidateFusionDecision[] = [];

    for (const [canonicalKey, candidates] of byKey) {
      const deterministic = candidates.find(
        (candidate) => candidate.source === 'deterministic',
      );
      const fallback = candidates.find(
        (candidate) => candidate.source === 'fallback',
      );

      if (deterministic && fallback) {
        const deterministicAccepted = deterministic.accepted;
        const fallbackAccepted =
          fallback.accepted ||
          fallback.score >= fallback.threshold + 0.03 ||
          (fallback.fallbackConfidence ?? 0) >= 0.72;
        output.push({
          canonicalKey,
          accepted: deterministicAccepted || fallbackAccepted,
          source: deterministicAccepted ? 'deterministic' : 'fallback',
          agreement: deterministicAccepted && fallbackAccepted,
        });
        continue;
      }

      if (deterministic) {
        output.push({
          canonicalKey,
          accepted: deterministic.accepted,
          source: 'deterministic',
          agreement: false,
        });
        continue;
      }

      if (fallback) {
        const conservativeAccept =
          fallback.accepted &&
          (fallback.score >= fallback.threshold + 0.08 ||
            (fallback.fallbackConfidence ?? 0) >= 0.72);
        output.push({
          canonicalKey,
          accepted: conservativeAccept,
          source: 'fallback',
          agreement: false,
        });
      }
    }

    return output;
  }
}
