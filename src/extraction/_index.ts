export {
  type AmbiguityDecision,
  type AmbiguityInput,
  type AmbiguityReason,
  AmbiguityTrigger,
} from './AmbiguityTrigger.js';
export {
  CandidateFusion,
  type CandidateFusionDecision,
  type CandidateFusionInput,
  type CandidateSource,
} from './CandidateFusion.js';
export {
  type CanonicalEntity,
  type CanonicalizationEntity,
  type CanonicalizationInput,
  type CanonicalizationResult,
  Canonicalizer,
  type CanonicalScope,
} from './Canonicalizer.js';
export {
  type ContradictionCandidate,
  type ContradictionConfig,
  ContradictionDetector,
  type ContradictionEvent,
} from './ContradictionDetector.js';
export {
  type EntityLinkContext,
  EntityLinker,
  type LinkedEntity,
} from './EntityLinker.js';
export {
  ChainedFallbackExtractor,
  type FallbackExtractionFact,
  type FallbackExtractionInput,
  type FallbackExtractionResult,
  type FallbackExtractor,
  NoopFallbackExtractor,
  PatternFallbackExtractor,
  WebLLMFallbackExtractor,
} from './FallbackExtractor.js';
export { type NormalizationMetadata, Normalizer } from './Normalizer.js';
export { NoveltyCalculator } from './NoveltyCalculator.js';
export { type QualityInput, QualityScorer } from './QualityScorer.js';
export { RecurrenceTracker } from './RecurrenceTracker.js';
export {
  type RiskSignal,
  type RiskValidationInput,
  type RiskValidationResult,
  RiskValidator,
} from './RiskValidator.js';
export { SpecificityNER, type SpecificityResult } from './SpecificityNER.js';
export {
  type SupersessionEvent,
  SupersessionManager,
  type SupersessionManagerConfig,
  type SupersessionResult,
} from './SupersessionManager.js';
export {
  type TemporalMarker,
  TemporalMarkerDetector,
  type TemporalUpdate,
} from './TemporalMarkerDetector.js';
