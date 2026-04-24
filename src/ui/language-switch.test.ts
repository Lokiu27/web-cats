// Bug Condition Exploration Test — Language Switch Fix
// Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
//
// IMPORTANT: This test is EXPECTED TO FAIL on unfixed code.
// Failure confirms the bug exists: UI components retain old language after switch.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// OffscreenCanvas polyfill for jsdom (same pattern as pixel-art-generator.test.ts)
// ---------------------------------------------------------------------------

class MockOffscreenCanvasCtx {
  imageSmoothingEnabled = false;
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  globalAlpha = 1;

  fillRect() {}
  strokeRect() {}
  clearRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  fill() {}
  stroke() {}
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
  createRadialGradient() {
    return { addColorStop() {} };
  }
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  private ctx: MockOffscreenCanvasCtx;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.ctx = new MockOffscreenCanvasCtx();
  }

  getContext(_type: string) {
    return this.ctx;
  }
}

beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;
  }

  // Mock localStorage
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  });
});

// ---------------------------------------------------------------------------
// Imports (after polyfills)
// ---------------------------------------------------------------------------

import { localization } from '../systems/localization.js';
import { EventBus } from '../core/event-bus.js';
import { HUD } from './hud.js';
import { InGameMenuScreen } from './screens/ingame-menu-screen.js';
import { AchievementsScreen } from './screens/achievements-screen.js';
import { StatisticsScreen } from './screens/statistics-screen.js';
import { AchievementNotification } from './modals/achievement-notification.js';
import { MainMenuScreen } from './screens/main-menu-screen.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Language = 'en' | 'ru';

/** Returns all text content from an element and its descendants, joined. */
function getAllText(el: HTMLElement): string[] {
  const texts: string[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const t = node.textContent?.trim();
    if (t) texts.push(t);
  }
  return texts;
}

/** Returns all button text content from an element. */
function getButtonTexts(el: HTMLElement): string[] {
  return Array.from(el.querySelectorAll('button')).map(b => b.textContent?.trim() ?? '');
}

// ---------------------------------------------------------------------------
// Property 1: Bug Condition — UI components retain old language after switch
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
// ---------------------------------------------------------------------------

describe('Property 1: Bug Condition — UI components retain old language after switch', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    // Reset to English before each test
    localization.setLanguage('en');
  });

  // Arbitraries for language pairs where previousLang ≠ newLang
  const langPairArb = fc.tuple(
    fc.constantFrom<Language>('en', 'ru'),
    fc.constantFrom<Language>('en', 'ru'),
  ).filter(([prev, next]) => prev !== next);

  it('HUD labels match new language after switch (hud.currency, hud.buy_desk, hud.menu)', () => {
    fc.assert(
      fc.property(langPairArb, ([previousLang, newLang]) => {
        // Set previous language and construct component
        localization.setLanguage(previousLang);
        const hud = new HUD(bus);

        // Switch to new language
        localization.setLanguage(newLang);

        // Expected values in new language
        const expectedCurrency = localization.t('hud.currency');
        const expectedBuyDesk = localization.t('hud.buy_desk');
        const expectedMenu = localization.t('hud.menu');

        // Get all label text from HUD
        const allText = getAllText(hud.element);
        const buttonTexts = getButtonTexts(hud.element);

        // Assert DOM text matches new language
        expect(allText).toContain(expectedCurrency);
        expect(buttonTexts).toContain(expectedBuyDesk);
        expect(buttonTexts).toContain(expectedMenu);

        hud.destroy();
      }),
    );
  });

  it('InGameMenuScreen buttons match new language after switch (ingame_menu.continue, ingame_menu.save_game)', () => {
    fc.assert(
      fc.property(langPairArb, ([previousLang, newLang]) => {
        localization.setLanguage(previousLang);
        const menu = new InGameMenuScreen();

        localization.setLanguage(newLang);

        const expectedContinue = localization.t('ingame_menu.continue');
        const expectedSaveGame = localization.t('ingame_menu.save_game');
        const expectedStats = localization.t('ingame_menu.statistics');
        const expectedSettings = localization.t('ingame_menu.settings');
        const expectedMainMenu = localization.t('ingame_menu.main_menu');

        const buttonTexts = getButtonTexts(menu.element);

        expect(buttonTexts).toContain(expectedContinue);
        expect(buttonTexts).toContain(expectedSaveGame);
        expect(buttonTexts).toContain(expectedStats);
        expect(buttonTexts).toContain(expectedSettings);
        expect(buttonTexts).toContain(expectedMainMenu);
      }),
    );
  });

  it('AchievementsScreen header and tab labels match new language after switch', () => {
    fc.assert(
      fc.property(langPairArb, ([previousLang, newLang]) => {
        localization.setLanguage(previousLang);
        const screen = new AchievementsScreen();

        localization.setLanguage(newLang);

        const expectedTitle = localization.t('achievements.title');
        const expectedTab1 = localization.t('achievements.tab.office_expansion');
        const expectedTab2 = localization.t('achievements.tab.upgrades');

        const allText = getAllText(screen.element);
        const buttonTexts = getButtonTexts(screen.element);

        expect(allText).toContain(expectedTitle);
        expect(buttonTexts).toContain(expectedTab1);
        expect(buttonTexts).toContain(expectedTab2);
      }),
    );
  });

  it('StatisticsScreen header matches new language after switch', () => {
    fc.assert(
      fc.property(langPairArb, ([previousLang, newLang]) => {
        localization.setLanguage(previousLang);
        const screen = new StatisticsScreen();

        localization.setLanguage(newLang);

        const expectedTitle = localization.t('statistics.title');

        const allText = getAllText(screen.element);

        expect(allText).toContain(expectedTitle);
      }),
    );
  });

  it('AchievementNotification header and continue button match new language after switch', () => {
    fc.assert(
      fc.property(langPairArb, ([previousLang, newLang]) => {
        localization.setLanguage(previousLang);
        const notification = new AchievementNotification();

        localization.setLanguage(newLang);

        const expectedHeader = localization.t('achievement.notification.title');
        const expectedContinue = localization.t('achievement.notification.continue');

        const allText = getAllText(notification.element);
        const buttonTexts = getButtonTexts(notification.element);

        expect(allText).toContain(expectedHeader);
        expect(buttonTexts).toContain(expectedContinue);
      }),
    );
  });

  it('MainMenuScreen subtitle equals localization.t("ui.slogan") — currently hardcoded Russian', () => {
    fc.assert(
      fc.property(langPairArb, ([previousLang, newLang]) => {
        localization.setLanguage(previousLang);
        const screen = new MainMenuScreen();

        localization.setLanguage(newLang);

        const expectedSlogan = localization.t('ui.slogan');

        // Find the subtitle element
        const subtitleEl = screen.element.querySelector('.main-menu__subtitle');
        expect(subtitleEl).not.toBeNull();
        expect(subtitleEl!.textContent?.trim()).toBe(expectedSlogan);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Imports for preservation tests
// ---------------------------------------------------------------------------

import { StateManager } from '../core/state-manager.js';
import type { GameState } from '../types/index.js';

// ---------------------------------------------------------------------------
// Property 2: Preservation — Game state unchanged after language switch
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
// ---------------------------------------------------------------------------

describe('Property 2: Preservation — game state unchanged after language switch', () => {
  let bus: EventBus;
  let stateManager: StateManager;

  beforeEach(() => {
    bus = new EventBus();
    stateManager = new StateManager(bus);
    localization.setLanguage('en');
  });

  // ---------------------------------------------------------------------------
  // Arbitraries for GameState fields
  // ---------------------------------------------------------------------------

  const hexCoordArb = fc.record({
    q: fc.integer({ min: -10, max: 10 }),
    r: fc.integer({ min: -10, max: 10 }),
  });

  const catAppearanceArb = fc.record({
    furColor: fc.constantFrom('orange', 'gray', 'white', 'black', 'brown', 'tabby' as const),
    pattern: fc.constantFrom('solid', 'spotted', 'striped', 'gradient' as const),
    expression: fc.constantFrom('focused', 'smiling', 'serious' as const),
    accessory: fc.constantFrom('glasses', 'tie', 'bow', 'none' as const),
    pose: fc.constantFrom('upright', 'leaning' as const),
  });

  const catArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    appearance: catAppearanceArb,
  });

  const deskArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    hexCoord: hexCoordArb,
    upgradeLevel: fc.integer({ min: 0, max: 50 }),
    cat: catArb,
  });

  const achievementStateArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 30 }),
    unlocked: fc.boolean(),
    unlockedAtTick: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
    progress: fc.float({ min: 0, max: 1, noNaN: true }),
    temporaryBonusExpiresTick: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
  });

  const statisticsArb = fc.record({
    totalDesksEverPurchased: fc.integer({ min: 0, max: 1000 }),
    highestDeskLevel: fc.integer({ min: 0, max: 100 }),
    totalAchievementsUnlocked: fc.integer({ min: 0, max: 50 }),
    recentAchievements: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
    gameStartTick: fc.integer({ min: 0, max: 100000 }),
  });

  const gameStateArb = fc.record({
    version: fc.constant(1),
    desks: fc.array(deskArb, { maxLength: 10 }),
    currency: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
    totalGeneratedCurrency: fc.float({ min: 0, max: 10_000_000, noNaN: true }),
    totalUpgradeCount: fc.integer({ min: 0, max: 10000 }),
    playTimeTicks: fc.integer({ min: 0, max: 1_000_000 }),
    achievements: fc.array(achievementStateArb, { maxLength: 20 }),
    settings: fc.record({
      language: fc.constantFrom('en', 'ru' as const),
      musicVolume: fc.integer({ min: 0, max: 10 }),
      sfxVolume: fc.integer({ min: 0, max: 10 }),
      defaultSpeed: fc.constantFrom(1, 2, 4 as const),
      tickIntervalSeconds: fc.constantFrom(1, 3, 5 as const),
    }),
    statistics: statisticsArb,
    firstLaunchDone: fc.boolean(),
  });

  // ---------------------------------------------------------------------------
  // Test 1: Game state preservation
  // ---------------------------------------------------------------------------

  it('game state fields are identical before and after a language switch', () => {
    fc.assert(
      fc.property(
        gameStateArb,
        fc.constantFrom<Language>('en', 'ru'),
        (generatedState, newLang) => {
          // Load the generated state into StateManager
          stateManager.loadState(generatedState as GameState);

          // Capture state before language switch
          const stateBefore = stateManager.getState();
          const currencyBefore = stateBefore.currency;
          const desksBefore = JSON.stringify(stateBefore.desks);
          const achievementsBefore = JSON.stringify(stateBefore.achievements);
          const totalUpgradeCountBefore = stateBefore.totalUpgradeCount;
          const playTimeTicksBefore = stateBefore.playTimeTicks;
          const statisticsBefore = JSON.stringify(stateBefore.statistics);

          // Perform language switch
          localization.setLanguage(newLang);
          bus.emit({ type: 'language_changed', lang: newLang });

          // Capture state after language switch
          const stateAfter = stateManager.getState();

          // Assert all game state fields are identical after the switch
          expect(stateAfter.currency).toBe(currencyBefore);
          expect(JSON.stringify(stateAfter.desks)).toBe(desksBefore);
          expect(JSON.stringify(stateAfter.achievements)).toBe(achievementsBefore);
          expect(stateAfter.totalUpgradeCount).toBe(totalUpgradeCountBefore);
          expect(stateAfter.playTimeTicks).toBe(playTimeTicksBefore);
          expect(JSON.stringify(stateAfter.statistics)).toBe(statisticsBefore);
        },
      ),
    );
  });

  // ---------------------------------------------------------------------------
  // Test 2: Language setting persistence
  // ---------------------------------------------------------------------------

  it('localization.getLanguage() matches the last set language after any sequence of switches', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Language>('en', 'ru'), { minLength: 1, maxLength: 10 }),
        (langSequence) => {
          for (const lang of langSequence) {
            localization.setLanguage(lang);
            expect(localization.getLanguage()).toBe(lang);
          }
        },
      ),
    );
  });
});
