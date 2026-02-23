/**
 * StorageManager - Operational layer for database lifecycle management
 *
 * Handles database initialization with error recovery, migration support,
 * storage quota management, and status tracking. Provides graceful
 * degradation when storage is full or corrupted.
 *
 * Key responsibilities:
 * - Database initialization with error handling
 * - QuotaExceededError detection and read-only mode
 * - Corruption recovery with backup attempt
 * - Status tracking for debugging and monitoring
 */

import Dexie from 'dexie';
import type { StorageError, StorageStatus } from '../types/api.js';
import { LokulDatabase } from './Database.js';

/**
 * Options for StorageManager initialization
 */
export interface StorageManagerOptions {
  /** Callback invoked when a storage error occurs */
  onStorageError?: (error: StorageError) => void;
}

/**
 * StorageManager handles database lifecycle, errors, and status tracking
 */
export class StorageManager {
  /** Dexie database instance */
  private db: LokulDatabase;

  /** Current storage status */
  private status: StorageStatus;

  /** Error callback */
  private onStorageError?: (error: StorageError) => void;

  /**
   * Create a new StorageManager instance
   * @param options - Configuration options including error callback
   */
  constructor(options?: StorageManagerOptions) {
    this.db = new LokulDatabase();
    this.status = {
      isReadOnly: false,
      lastError: null,
      dbVersion: 0,
      isOpen: false,
    };
    if (options?.onStorageError) {
      this.onStorageError = options.onStorageError;
    }
  }

  /**
   * Initialize the database connection
   * Handles errors gracefully and sets up recovery modes
   *
   * @throws Never throws - errors are handled internally and reported via callback
   */
  async initialize(): Promise<void> {
    try {
      await this.db.open();
      this.status.isOpen = true;
      this.status.dbVersion = this.db.verno;
    } catch (error) {
      this.handleStorageError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Get the current database version
   * @returns Database version number (0 if not initialized)
   */
  getVersion(): number {
    return this.status.dbVersion;
  }

  /**
   * Get current storage status
   * @returns Copy of current status object
   */
  getStatus(): StorageStatus {
    return { ...this.status };
  }

  /**
   * Check if database is in read-only mode
   * @returns true if quota exceeded and writes are blocked
   */
  isReadOnly(): boolean {
    return this.status.isReadOnly;
  }

  /**
   * Get the database instance for repository operations
   * @returns LokulDatabase instance
   */
  getDb(): LokulDatabase {
    return this.db;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.db.close();
    this.status.isOpen = false;
  }

  /**
   * Handle storage errors with appropriate recovery actions
   *
   * @param error - The error that occurred
   * @private
   */
  private handleStorageError(error: Error): void {
    const storageError = this.classifyError(error);

    // Update status
    this.status.lastError = storageError.message;

    // Handle specific error types
    switch (storageError.type) {
      case 'quota_exceeded':
        this.status.isReadOnly = true;
        break;

      case 'corruption':
        this.attemptCorruptionRecovery(storageError);
        break;

      default:
        // Unknown errors - just report
        break;
    }

    // Log for debugging
    console.error('[StorageManager] Storage error:', storageError);

    // Notify callback if provided
    this.onStorageError?.(storageError);
  }

  /**
   * Classify an error into a StorageError with type and recovery hint
   *
   * @param error - Raw error from Dexie/IndexedDB
   * @returns Structured StorageError
   * @private
   */
  private classifyError(error: Error): StorageError {
    const timestamp = Date.now();

    // Check for quota exceeded (including wrapped in AbortError)
    if (this.isQuotaExceededError(error)) {
      return {
        type: 'quota_exceeded',
        message: 'Storage quota exceeded. Database is now in read-only mode.',
        code: 'QUOTA_EXCEEDED',
        timestamp,
        recoveryHint:
          'Free up disk space or clear browser data to restore write access.',
        originalError: error,
      };
    }

    // Check for corruption indicators
    if (
      error.name === 'DatabaseClosedError' ||
      error.name === 'OpenFailedError' ||
      error.name === 'VersionError' ||
      error.message?.includes('corrupt')
    ) {
      return {
        type: 'corruption',
        message: 'Database corruption detected. Attempting recovery.',
        code: 'CORRUPTION_DETECTED',
        timestamp,
        recoveryHint: 'Data has been reset. Check backup if export succeeded.',
        originalError: error,
      };
    }

    // Migration failures
    if (error.name === 'UpgradeError' || error.message?.includes('migration')) {
      return {
        type: 'migration_failed',
        message: `Database migration failed: ${error.message}`,
        code: 'MIGRATION_FAILED',
        timestamp,
        recoveryHint: 'Try clearing site data or contact support.',
        originalError: error,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      message: `Unknown storage error: ${error.message}`,
      code: 'UNKNOWN_ERROR',
      timestamp,
      recoveryHint: 'Try refreshing the page or clearing site data.',
      originalError: error,
    };
  }

  /**
   * Check if error is a quota exceeded error
   * Handles both direct QuotaExceededError and AbortError-wrapped variants
   *
   * @param error - Error to check
   * @returns true if quota exceeded
   * @private
   */
  private isQuotaExceededError(error: Error): boolean {
    // Direct quota error
    if (error.name === 'QuotaExceededError') {
      return true;
    }

    // Some browsers wrap quota errors in AbortError
    if (error.name === 'AbortError') {
      const innerError = (error as Error & { inner?: Error }).inner;
      if (innerError?.name === 'QuotaExceededError') {
        return true;
      }
    }

    // Check Dexie-specific error types
    if (error instanceof Dexie.QuotaExceededError) {
      return true;
    }

    return false;
  }

  /**
   * Attempt to recover from database corruption
   * Tries to export data before clearing, then reopens database
   *
   * @param storageError - The corruption error being handled
   * @private
   */
  private async attemptCorruptionRecovery(
    storageError: StorageError,
  ): Promise<void> {
    console.warn('[StorageManager] Attempting corruption recovery...');

    let backupData: string | undefined;

    try {
      // Best-effort export before clearing
      backupData = await this.db.exportDataString();
      console.log('[StorageManager] Backup export succeeded');
    } catch {
      // Export may fail if corruption is severe - that's ok
      console.warn(
        '[StorageManager] Backup export failed, proceeding without backup',
      );
    }

    try {
      // Clear all data
      await this.db.clearAll();
      console.log('[StorageManager] Database cleared');

      // Reopen database
      await this.db.open();
      this.status.isOpen = true;
      this.status.dbVersion = this.db.verno;

      // Update error with recovery info
      if (backupData) {
        storageError.backup = JSON.parse(backupData) as NonNullable<
          StorageError['backup']
        >;
      }

      console.log('[StorageManager] Corruption recovery complete');
    } catch (recoveryError) {
      console.error('[StorageManager] Recovery failed:', recoveryError);
      storageError.message +=
        ' Recovery failed - manual intervention required.';
    }
  }
}
