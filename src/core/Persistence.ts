/**
 * Storage persistence module
 *
 * Wraps navigator.storage.persist() for requesting persistent storage.
 * Must be called from main thread (Window context) before worker spawn.
 */

import type { PersistenceStatus } from './types.js';

/**
 * Request persistent storage from the browser.
 * This prevents the browser from clearing storage under pressure.
 *
 * @returns PersistenceStatus with result details
 */
export async function requestPersistence(): Promise<PersistenceStatus> {
  const lastAttempt = Date.now();

  if (!navigator.storage?.persist) {
    return {
      persisted: false,
      reason: 'not-supported',
      lastAttempt,
    };
  }

  try {
    const persisted = await navigator.storage.persist();
    return {
      persisted,
      reason: persisted ? 'granted' : 'denied',
      lastAttempt,
    };
  } catch (error) {
    console.error('Storage persistence request failed:', error);
    return {
      persisted: false,
      reason: 'error',
      lastAttempt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if the StorageManager.persist() API is supported.
 *
 * @returns true if persistence is supported by the browser
 */
export function isPersistenceSupported(): boolean {
  return typeof navigator.storage?.persist === 'function';
}
