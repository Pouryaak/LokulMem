/**
 * Lifecycle module - Memory decay and reinforcement
 *
 * Provides Ebbinghaus decay calculation, reinforcement tracking,
 * maintenance sweeps, and event emission for automatic memory
 * lifecycle management.
 */

export { DecayCalculator } from './DecayCalculator.js';
export { LifecycleEventEmitter } from './EventEmitter.js';
export { KMeansClusterer } from './KMeansClusterer.js';
export { LifecycleManager } from './LifecycleManager.js';
export { MaintenanceSweep } from './MaintenanceSweep.js';
export { ReinforcementTracker } from './ReinforcementTracker.js';
export * from './types.js';
