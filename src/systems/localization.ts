// Localization System for Openspacemarin
// Requirements: 13.1, 13.2, 14.1–14.5, 19.5, 20.6
//
// Provides string lookup by key for English and Russian, with support for
// parameterized templates (e.g., "You have {count} desks").
//
// Design:
//   - Translation data is imported statically from JSON files so the build
//     bundles both languages and no async loading is needed.
//   - `t(key, params?)` returns the translated string, substituting any
//     `{param}` placeholders. Falls back to the key itself if missing.
//   - `getCatName(index)` returns the nth cat name from the language's pool,
//     cycling if the index exceeds the pool size.
//   - Language changes take effect immediately for all subsequent `t()` calls.

import type { ILocalizationSystem } from '../types/index.js';
import enStrings from '../data/localization-en.json';
import ruStrings from '../data/localization-ru.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Language = 'en' | 'ru';
type StringMap = Record<string, string>;

// ---------------------------------------------------------------------------
// Translation tables
// ---------------------------------------------------------------------------

const TRANSLATIONS: Record<Language, StringMap> = {
  en: enStrings as StringMap,
  ru: ruStrings as StringMap,
};

// ---------------------------------------------------------------------------
// LocalizationSystem class
// ---------------------------------------------------------------------------

export class LocalizationSystem implements ILocalizationSystem {
  private lang: Language;
  private changeListeners: Array<() => void> = [];

  /**
   * @param initialLang - Language to use on construction (default: 'en')
   */
  constructor(initialLang: Language = 'en') {
    this.lang = initialLang;
  }

  // ---------------------------------------------------------------------------
  // ILocalizationSystem
  // ---------------------------------------------------------------------------

  /**
   * Switches the active language.
   * All subsequent `t()` and `getCatName()` calls use the new language.
   * Notifies all registered change listeners.
   *
   * Requirements: 13.2, 14.3
   */
  setLanguage(lang: Language): void {
    this.lang = lang;
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  /** Returns the currently active language code. */
  getLanguage(): Language {
    return this.lang;
  }

  /**
   * Registers a callback to be invoked whenever the language changes.
   * Returns an unsubscribe function.
   */
  onChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  /**
   * Looks up a translation key and substitutes any `{param}` placeholders.
   *
   * Examples:
   *   t('menu.new_game')                          → "New Game"
   *   t('message.desk_purchased', { count: 5 })  → "New workstation added! You now have 5 workstations."
   *
   * Falls back to the key string itself if the key is missing in the active
   * language (Requirement 14.1 — no undefined/null returns).
   *
   * Requirements: 14.1, 14.4, 20.6
   */
  t(key: string, params?: Record<string, string | number>): string {
    const table = TRANSLATIONS[this.lang];
    let value = table[key];

    if (value === undefined || value === '') {
      // Fallback: try English, then the key itself
      value = TRANSLATIONS['en'][key] ?? key;
    }

    if (!params) return value;

    // Substitute {param} placeholders
    return value.replace(/\{(\w+)\}/g, (_, name: string) => {
      const replacement = params[name];
      return replacement !== undefined ? String(replacement) : `{${name}}`;
    });
  }

  /**
   * Returns the cat name at position `index` from the active language's name
   * pool. Cycles through the pool if `index` exceeds its length.
   *
   * The name pool is stored as a comma-separated string under the key
   * `"cat.names"` in each translation file.
   *
   * Requirements: 14.5
   */
  getCatName(index: number): string {
    const raw = this.t('cat.names');
    const names = raw.split(',').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length === 0) return `Cat ${index + 1}`;
    return names[index % names.length];
  }
}

// ---------------------------------------------------------------------------
// Singleton helper
// ---------------------------------------------------------------------------

/**
 * Module-level singleton for use across the game.
 * Initialized to English; call `setLanguage()` after loading settings.
 */
export const localization = new LocalizationSystem('en');
