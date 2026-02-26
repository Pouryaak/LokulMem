export { SpecificityNER, type SpecificityResult } from './SpecificityNER.js';
export { Normalizer, type NormalizationMetadata } from './Normalizer.js';
export {
  AmbiguityTrigger,
  type AmbiguityDecision,
  type AmbiguityInput,
  type AmbiguityReason,
} from './AmbiguityTrigger.js';
export {
  CandidateFusion,
  type CandidateFusionDecision,
  type CandidateFusionInput,
  type CandidateSource,
} from './CandidateFusion.js';
export {
  ChainedFallbackExtractor,
  WebLLMFallbackExtractor,
  PatternFallbackExtractor,
  NoopFallbackExtractor,
  type FallbackExtractor,
  type FallbackExtractionInput,
  type FallbackExtractionFact,
  type FallbackExtractionResult,
} from './FallbackExtractor.js';
export {
  Canonicalizer,
  type CanonicalEntity,
  type CanonicalizationEntity,
  type CanonicalScope,
  type CanonicalizationInput,
  type CanonicalizationResult,
} from './Canonicalizer.js';
export {
  EntityLinker,
  type LinkedEntity,
  type EntityLinkContext,
} from './EntityLinker.js';
export {
  RiskValidator,
  type RiskSignal,
  type RiskValidationInput,
  type RiskValidationResult,
} from './RiskValidator.js';
export { NoveltyCalculator } from './NoveltyCalculator.js';
export { RecurrenceTracker } from './RecurrenceTracker.js';
export { QualityScorer, type QualityInput } from './QualityScorer.js';
export {
  TemporalMarkerDetector,
  type TemporalMarker,
  type TemporalUpdate,
} from './TemporalMarkerDetector.js';
export {
  ContradictionDetector,
  type ContradictionEvent,
  type ContradictionCandidate,
  type ContradictionConfig,
} from './ContradictionDetector.js';
export {
  SupersessionManager,
  type SupersessionResult,
  type SupersessionEvent,
  type SupersessionManagerConfig,
} from './SupersessionManager.js';
