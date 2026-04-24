// Save System for Openspacemarin
// Requirements: 10.1–10.7, 23.1, 23.2, 23.4, 23.5
//
// Persists game state to browser localStorage as JSON.
// Single save slot — most recent save only (Requirement 10.6).
//
// Error handling:
//   - localStorage unavailable → save/load return failure gracefully
//   - Corrupted JSON → load() returns null, logs error (Requirement 23.4)
//   - Quota exceeded → save() returns failure with descriptive error
//   - Missing required fields → filled with defaults where safe, else null
//
// The save envelope wraps GameState with a top-level `version` field so
// future migrations can detect and upgrade old saves (Requirement 23.5).

import type { GameState, ISaveSystem, SaveResult } from '../types/index.js';
import { createInitialState } from '../core/state-manager.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAVE_KEY = 'openspacemarin_save';

/** Current save format version. Increment when the schema changes. */
export const CURRENT_SAVE_VERSION = 1;

// ---------------------------------------------------------------------------
// Save envelope
// ---------------------------------------------------------------------------

interface SaveEnvelope {
  version: number;
  savedAt: number; // Unix timestamp (ms)
  state: GameState;
}

// ---------------------------------------------------------------------------
// Validation / migration helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether the browser supports localStorage.
 * Returns false in environments where it is unavailable or blocked.
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__osm_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempts to migrate a save from an older version to the current version.
 * Returns the migrated state, or null if migration is not possible.
 *
 * Currently only version 1 exists, so this is a no-op placeholder.
 */
function migrate(envelope: SaveEnvelope): GameState | null {
  // Future: add `case 1:` blocks here to migrate v1 → v2, etc.
  if (envelope.version === CURRENT_SAVE_VERSION) {
    return envelope.state;
  }
  // Unknown version — cannot migrate safely
  console.warn(
    `[SaveSystem] Unknown save version ${envelope.version}. Expected ${CURRENT_SAVE_VERSION}.`,
  );
  return null;
}

/**
 * Fills any missing top-level fields in a loaded state with safe defaults.
 * This guards against partial saves or schema additions in future versions.
 */
function applyDefaults(partial: Partial<GameState>): GameState {
  const defaults = createInitialState();
  return {
    ...defaults,
    ...partial,
    // Nested objects need explicit merging so we don't lose sub-fields
    settings: { ...defaults.settings, ...(partial.settings ?? {}) },
    statistics: { ...defaults.statistics, ...(partial.statistics ?? {}) },
  };
}

/**
 * Validates that the parsed value looks like a SaveEnvelope.
 * Returns false for obviously malformed data.
 */
function isValidEnvelope(value: unknown): value is SaveEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['version'] === 'number' &&
    typeof obj['savedAt'] === 'number' &&
    typeof obj['state'] === 'object' &&
    obj['state'] !== null
  );
}

// ---------------------------------------------------------------------------
// SaveSystem class
// ---------------------------------------------------------------------------

export class SaveSystem implements ISaveSystem {
  private readonly storageKey: string;

  /**
   * @param storageKey - localStorage key to use (default: 'openspacemarin_save').
   *                     Override in tests to avoid polluting real storage.
   */
  constructor(storageKey: string = SAVE_KEY) {
    this.storageKey = storageKey;
  }

  // ---------------------------------------------------------------------------
  // ISaveSystem — public API
  // ---------------------------------------------------------------------------

  /**
   * Serializes `state` to JSON and writes it to localStorage.
   *
   * Requirements: 10.1, 10.2, 23.1
   */
  save(state: GameState): SaveResult {
    if (!isLocalStorageAvailable()) {
      return {
        success: false,
        error: 'localStorage is not available in this browser.',
      };
    }

    const envelope: SaveEnvelope = {
      version: CURRENT_SAVE_VERSION,
      savedAt: Date.now(),
      state,
    };

    try {
      const json = JSON.stringify(envelope);
      localStorage.setItem(this.storageKey, json);
      return { success: true };
    } catch (err) {
      // Most likely a QuotaExceededError
      const message =
        err instanceof Error ? err.message : 'Unknown error during save.';
      console.error('[SaveSystem] Save failed:', message);
      return {
        success: false,
        error: `Save failed: ${message}`,
      };
    }
  }

  /**
   * Reads and deserializes the save from localStorage.
   *
   * Returns null if:
   *   - No save data exists
   *   - The JSON is malformed (corrupted save)
   *   - The save version cannot be migrated
   *
   * Requirements: 10.4, 23.2, 23.4
   */
  load(): GameState | null {
    if (!isLocalStorageAvailable()) {
      console.warn('[SaveSystem] localStorage unavailable — cannot load save.');
      return null;
    }

    const raw = localStorage.getItem(this.storageKey);
    if (raw === null) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('[SaveSystem] Save data is corrupted (invalid JSON):', err);
      return null;
    }

    if (!isValidEnvelope(parsed)) {
      console.error('[SaveSystem] Save data has an unexpected structure:', parsed);
      return null;
    }

    const migrated = migrate(parsed);
    if (migrated === null) {
      console.error('[SaveSystem] Could not migrate save data from version', parsed.version);
      return null;
    }

    // Fill any missing fields with safe defaults
    return applyDefaults(migrated as Partial<GameState>);
  }

  /**
   * Returns true if a save exists in localStorage.
   *
   * Requirements: 10.5
   */
  hasSaveData(): boolean {
    if (!isLocalStorageAvailable()) return false;
    return localStorage.getItem(this.storageKey) !== null;
  }

  /**
   * Removes the save from localStorage.
   *
   * Requirements: 10.6 (single slot — delete clears it entirely)
   */
  deleteSave(): void {
    if (!isLocalStorageAvailable()) return;
    localStorage.removeItem(this.storageKey);
  }

  /**
   * Returns the version number stored in the current save, or 0 if no save
   * exists or the data is unreadable.
   *
   * Requirements: 23.5
   */
  getSaveVersion(): number {
    if (!isLocalStorageAvailable()) return 0;

    const raw = localStorage.getItem(this.storageKey);
    if (raw === null) return 0;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return typeof parsed['version'] === 'number' ? parsed['version'] : 0;
    } catch {
      return 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton helper
// ---------------------------------------------------------------------------

/**
 * Module-level singleton for use across the game.
 * Uses the default localStorage key 'openspacemarin_save'.
 */
export const saveSystem = new SaveSystem();
