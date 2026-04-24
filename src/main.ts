// Openspacemarin — Entry Point
// Requirements: 2.6, 4.3, 5.6, 7.2, 11.1
//
// Initialises all modules, connects them via the Event Bus, handles new game
// vs load game, and starts the game loop.
//
// Architecture:
//   - All modules are instantiated here and wired together.
//   - Cross-module communication goes through the EventBus only.
//   - The render callback draws the hex grid and visual effects each frame.
//   - The tick callback (registered with TimeController) runs game logic.

import { EventBus } from './core/event-bus.js';
import { StateManager, createInitialState } from './core/state-manager.js';
import { TimeController } from './core/time-controller.js';
import { GameLoop } from './core/game-loop.js';
import { InputHandlers } from './core/input-handlers.js';
import { TickProcessor } from './core/tick-processor.js';

import { EconomyCalculator } from './systems/economy.js';
import { DeskManager } from './systems/desk-manager.js';
import { CatGenerator } from './systems/cat-generator.js';
import { AchievementManager } from './systems/achievement-manager.js';
import { SaveSystem } from './systems/save-system.js';
import { localization } from './systems/localization.js';

import { HexGridRenderer } from './rendering/hex-grid-renderer.js';
import { PixelArtGenerator } from './rendering/pixel-art-generator.js';
import { VisualEffects } from './rendering/visual-effects.js';

import { AudioSystem } from './audio/audio-system.js';

import { ScreenRouter } from './ui/screen-router.js';
import { HUD } from './ui/hud.js';
import { SplashScreen } from './ui/screens/splash-screen.js';
import { WelcomeScreen } from './ui/screens/welcome-screen.js';
import { MainMenuScreen } from './ui/screens/main-menu-screen.js';
import { InGameMenuScreen } from './ui/screens/ingame-menu-screen.js';
import { AchievementsScreen } from './ui/screens/achievements-screen.js';
import { StatisticsScreen } from './ui/screens/statistics-screen.js';
import { SettingsScreen } from './ui/screens/settings-screen.js';
import { HelpScreen } from './ui/screens/help-screen.js';
import { AboutScreen } from './ui/screens/about-screen.js';
import { PurchaseModal } from './ui/modals/purchase-modal.js';
import { UpgradeModal } from './ui/modals/upgrade-modal.js';
import { AchievementNotification } from './ui/modals/achievement-notification.js';

import type { HexCoord, ScreenType, Viewport } from './types/index.js';
import { ACHIEVEMENT_DEFINITIONS } from './data/achievements.js';

// ---------------------------------------------------------------------------
// DOM elements
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLDivElement;

if (!canvas || !uiOverlay) {
  throw new Error('Required DOM elements #game-canvas and #ui-overlay not found');
}

// ---------------------------------------------------------------------------
// Module instantiation
// ---------------------------------------------------------------------------

// Core
const bus = new EventBus();
const stateManager = new StateManager(bus);
const timeController = new TimeController(bus);

// Systems
const economy = new EconomyCalculator();
const catGenerator = new CatGenerator();
const achievementManager = new AchievementManager(bus);
const saveSystem = new SaveSystem();
const deskManager = new DeskManager(economy, catGenerator, bus);

// Tick processor
const tickProcessor = new TickProcessor(economy, achievementManager);

// ---------------------------------------------------------------------------
// Fixed 640×480 game viewport
// ---------------------------------------------------------------------------

/** The game always renders into a fixed 640×480 logical canvas. */
const GAME_W = 640;
const GAME_H = 480;

// Ensure the canvas has the correct pixel dimensions
canvas.width = GAME_W;
canvas.height = GAME_H;

// Rendering
const pixelArt = new PixelArtGenerator();

const initialViewport: Viewport = {
  offsetX: 0,
  width: GAME_W,
  height: GAME_H,
  scale: 1,
  parallaxLayers: [0.3, 0.6, 1.0],
};
const hexRenderer = new HexGridRenderer(initialViewport, pixelArt);
const visualEffects = new VisualEffects(pixelArt);

// Audio
const audioSystem = new AudioSystem();

// UI
const screenRouter = new ScreenRouter(uiOverlay, bus);
let hud = new HUD(bus);

// Screens
const splashScreen = new SplashScreen();
const welcomeScreen = new WelcomeScreen();
let mainMenuScreen = new MainMenuScreen();
let inGameMenuScreen = new InGameMenuScreen();
let achievementsScreen = new AchievementsScreen();
let statisticsScreen = new StatisticsScreen();
let settingsScreen = new SettingsScreen();
let helpScreen = new HelpScreen();
let aboutScreen = new AboutScreen();

// Modals
let purchaseModal = new PurchaseModal();
let upgradeModal = new UpgradeModal();
let achievementNotification = new AchievementNotification();

// Input handlers (created after hexRenderer is ready)
const inputHandlers = new InputHandlers(canvas, hexRenderer);

// Game loop (created last — needs all other modules ready)
const gameLoop = new GameLoop(canvas, timeController, renderFrame);

// ---------------------------------------------------------------------------
// Screen registration
// ---------------------------------------------------------------------------

screenRouter.registerScreen('splash', splashScreen.element);
screenRouter.registerScreen('welcome', welcomeScreen.element);
screenRouter.registerScreen('main_menu', mainMenuScreen.element);
screenRouter.registerScreen('game', buildGameScreen());
screenRouter.registerScreen('achievements', achievementsScreen.element);
screenRouter.registerScreen('statistics', statisticsScreen.element);
screenRouter.registerScreen('settings', settingsScreen.element);
screenRouter.registerScreen('help', helpScreen.element);
screenRouter.registerScreen('about', aboutScreen.element);

/**
 * Builds the game screen element: canvas + HUD + in-game menu + modals.
 * The canvas is the background; HTML overlays sit on top.
 */
function buildGameScreen(): HTMLDivElement {
  const gameScreen = document.createElement('div');
  gameScreen.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';

  // HUD at the top
  gameScreen.appendChild(hud.element);

  // In-game menu overlay
  gameScreen.appendChild(inGameMenuScreen.element);

  // Modals
  gameScreen.appendChild(purchaseModal.element);
  gameScreen.appendChild(upgradeModal.element);
  gameScreen.appendChild(achievementNotification.element);

  return gameScreen;
}

// ---------------------------------------------------------------------------
// Viewport sync helper
// ---------------------------------------------------------------------------

function getCurrentViewport(): Viewport {
  return {
    offsetX: hexRenderer.getViewport().offsetX,
    width: GAME_W,
    height: GAME_H,
    scale: 1,
    parallaxLayers: [0.3, 0.6, 1.0],
  };
}

// ---------------------------------------------------------------------------
// Render callback (called every animation frame by GameLoop)
// ---------------------------------------------------------------------------

function renderFrame(ctx: CanvasRenderingContext2D, deltaMs: number): void {
  const state = stateManager.getState();

  // Only render the hex grid when the game screen is active.
  // Always clear the canvas so stale frames don't show through during transitions.
  if (screenRouter.getCurrentScreen() !== 'game') {
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    return;
  }

  const viewport = getCurrentViewport();

  // Clear canvas
  ctx.clearRect(0, 0, GAME_W, GAME_H);

  // Draw hex grid (desks, cats, upgrade bars)
  hexRenderer.updateScroll();
  hexRenderer.render(ctx, viewport, state.desks);

  // Draw visual effects (particles, floating numbers)
  visualEffects.update(deltaMs);
  visualEffects.draw(ctx);

  // Update input handler's occupied coords for click detection
  inputHandlers.updateOccupiedCoords(state.desks.map(d => d.hexCoord));
}

// ---------------------------------------------------------------------------
// Tick callback (registered with TimeController)
// ---------------------------------------------------------------------------

timeController.onTick(() => {
  const state = stateManager.getState();

  // Only process ticks when the game is running
  if (screenRouter.getCurrentScreen() !== 'game') return;

  const result = tickProcessor.processTick(state);

  // Apply the tick result to state
  stateManager.setState({
    currency: result.currency,
    totalGeneratedCurrency: result.totalGeneratedCurrency,
    playTimeTicks: result.playTimeTicks,
    achievements: result.achievements,
    statistics: result.statistics,
  });

  // Update HUD
  const bonusSum = achievementManager.getTotalBonusSum(
    result.achievements,
    result.playTimeTicks,
  );
  const genPerTick = economy.getTotalGenerationPerTick(state.desks, bonusSum);
  hud.update(stateManager.getState(), genPerTick);

  // Spawn floating currency numbers above each desk (subtle tick feedback)
  if (result.generated > 0 && state.desks.length > 0) {
    // Only show on a subset of desks to avoid visual clutter
    const deskToShow = state.desks[result.playTimeTicks % state.desks.length];
    if (deskToShow) {
      const screen = hexRenderer.hexToScreen(deskToShow.hexCoord);
      const perDesk = result.generated / state.desks.length;
      visualEffects.spawnFloatingCurrency(screen.x, screen.y - 20, perDesk);
    }
  }
});

// ---------------------------------------------------------------------------
// Auto-save
// ---------------------------------------------------------------------------

timeController.onAutoSave(() => {
  const state = stateManager.getState();
  const result = saveSystem.save(state);
  if (result.success) {
    bus.emit({ type: 'game_saved' });
  } else {
    // Show non-intrusive warning for auto-save failure (quota exceeded, etc.)
    console.warn('[AutoSave] Auto-save failed:', result.error);
    showNotificationBanner(
      result.error?.includes('quota') || result.error?.includes('Quota')
        ? 'Auto-save failed: storage full. Try clearing browser data.'
        : `Auto-save failed: ${result.error ?? 'unknown error'}`,
      'warning',
      8000,
    );
  }
});

// ---------------------------------------------------------------------------
// Event Bus subscriptions
// ---------------------------------------------------------------------------

// Achievement unlocked → show notification
bus.on('achievement_unlocked', (e) => {
  const { achievement } = e;
  achievementNotification.show({
    name: localization.t(achievement.definition.nameKey),
    description: localization.t(achievement.definition.descriptionKey),
    bonusPercent: achievement.definition.bonusPercent,
  });
  audioSystem.playSFX('achievement');

  // Spawn confetti
  visualEffects.spawnAchievementConfetti(GAME_W, GAME_H);
});

// Desk purchased → visual + audio feedback
bus.on('desk_purchased', (e) => {
  const screen = hexRenderer.hexToScreen(e.desk.hexCoord);
  visualEffects.spawnUpgradeSparkles(screen.x, screen.y, 8);
  audioSystem.playSFX('purchase');
});

// Desk upgraded → visual + audio feedback
bus.on('desk_upgraded', (e) => {
  const screen = hexRenderer.hexToScreen(e.desk.hexCoord);
  visualEffects.spawnUpgradeSparkles(screen.x, screen.y, 16);
  audioSystem.playSFX('upgrade');
});

// Speed changed → update HUD
bus.on('speed_changed', (e) => {
  hud.setSpeed(e.multiplier as 1 | 2 | 4);
});

// Pause toggled → update HUD
bus.on('pause_toggled', (e) => {
  hud.setPaused(e.paused);
});

// Language changed → update localization and rebuild menu screens
bus.on('language_changed', (e) => {
  localization.setLanguage(e.lang);

  // Rebuild menu screens (these are separate from the game screen)
  mainMenuScreen = new MainMenuScreen();
  screenRouter.registerScreen('main_menu', mainMenuScreen.element);

  settingsScreen = new SettingsScreen();
  settingsScreen.refresh(stateManager.getState().settings);
  screenRouter.registerScreen('settings', settingsScreen.element);

  helpScreen = new HelpScreen();
  screenRouter.registerScreen('help', helpScreen.element);

  aboutScreen = new AboutScreen();
  screenRouter.registerScreen('about', aboutScreen.element);

  // Rebuild game-screen components that were not previously rebuilt
  hud.destroy();
  hud = new HUD(bus);

  inGameMenuScreen = new InGameMenuScreen();

  achievementsScreen = new AchievementsScreen();
  screenRouter.registerScreen('achievements', achievementsScreen.element);

  statisticsScreen = new StatisticsScreen();
  screenRouter.registerScreen('statistics', statisticsScreen.element);

  achievementNotification = new AchievementNotification();

  purchaseModal = new PurchaseModal();

  upgradeModal = new UpgradeModal();

  // Rebuild the game screen container with the new component instances
  screenRouter.registerScreen('game', buildGameScreen());

  // Re-wire callbacks for rebuilt screens (must run AFTER all rebuilds)
  wireAllCallbacks();
});

// ---------------------------------------------------------------------------
// Wire all UI callbacks (called on init and after language change)
// ---------------------------------------------------------------------------

function wireAllCallbacks(): void {
  // HUD
  hud.onBuyDesk = () => {
    const state = stateManager.getState();
    const cost = economy.getDeskPurchaseCost(state.desks.length);
    purchaseModal.show(cost, state.currency);
    audioSystem.playSFX('window_open');
  };
  hud.onSpeedChange = (speed) => { timeController.setSpeed(speed); audioSystem.playSFX('button_click'); };
  hud.onPauseToggle = () => {
    if (timeController.isPaused()) timeController.resume(); else timeController.pause();
    audioSystem.playSFX('button_click');
  };
  hud.onMenuOpen = () => { timeController.pause(); inGameMenuScreen.show(); audioSystem.playSFX('window_open'); };

  // Purchase modal
  purchaseModal.onBuy = () => {
    const state = stateManager.getState();
    const result = deskManager.purchaseDesk(state);
    if (result.success && result.desk && result.newCurrency !== undefined) {
      stateManager.setState({
        desks: [...state.desks, result.desk],
        currency: result.newCurrency,
        statistics: { ...state.statistics, totalDesksEverPurchased: state.statistics.totalDesksEverPurchased + 1 },
      });
      purchaseModal.hide();
      audioSystem.playSFX('purchase');
    } else { audioSystem.playSFX('error'); }
  };
  purchaseModal.onClose = () => { purchaseModal.hide(); audioSystem.playSFX('window_close'); };

  // Upgrade modal
  upgradeModal.onUpgrade = (deskId) => {
    const state = stateManager.getState();
    const result = deskManager.upgradeDesk(deskId, state);
    if (result.success && result.newLevel !== undefined && result.newCurrency !== undefined) {
      const newDesks = state.desks.map(d => d.id === deskId ? { ...d, upgradeLevel: result.newLevel! } : d);
      const highestLevel = Math.max(...newDesks.map(d => d.upgradeLevel));
      stateManager.setState({
        desks: newDesks, currency: result.newCurrency, totalUpgradeCount: state.totalUpgradeCount + 1,
        statistics: { ...state.statistics, highestDeskLevel: Math.max(state.statistics.highestDeskLevel, highestLevel) },
      });
      upgradeModal.hide();
      audioSystem.playSFX('upgrade');
    } else { audioSystem.playSFX('error'); }
  };
  upgradeModal.onClose = () => { upgradeModal.hide(); audioSystem.playSFX('window_close'); };

  // Achievement notification
  achievementNotification.onDismiss = () => {};

  // In-game menu
  inGameMenuScreen.onNavigate = (target) => {
    if (target === 'close') { inGameMenuScreen.hide(); timeController.resume(); audioSystem.playSFX('window_close'); return; }
    inGameMenuScreen.hide();
    audioSystem.playSFX('button_click');
    if (target === 'main_menu') { timeController.pause(); navigateTo('main_menu'); }
    else if (target === 'statistics') { refreshStatisticsScreen(); navigateTo('statistics'); }
    else if (target === 'settings') { settingsScreen.refresh(stateManager.getState().settings); navigateTo('settings'); }
  };
  inGameMenuScreen.onSave = () => {
    const state = stateManager.getState();
    const result = saveSystem.save(state);
    if (result.success) { bus.emit({ type: 'game_saved' }); showNotificationBanner('Game saved successfully.', 'info', 3000); }
    else { showNotificationBanner(`Save failed: ${result.error ?? 'unknown error'}`, 'error', 0); }
  };

  // Input handlers
  inputHandlers.onEmptyHexClick = (_coord: HexCoord) => {
    const state = stateManager.getState();
    purchaseModal.show(economy.getDeskPurchaseCost(state.desks.length), state.currency);
    audioSystem.playSFX('window_open');
  };
  inputHandlers.onOccupiedHexClick = (coord: HexCoord) => {
    const state = stateManager.getState();
    const desk = state.desks.find(d => d.hexCoord.q === coord.q && d.hexCoord.r === coord.r);
    if (!desk) return;
    upgradeModal.show(desk, economy.getUpgradeCost(desk.upgradeLevel), state.currency, economy.getDeskGeneration(desk.upgradeLevel), economy.getDeskGeneration(desk.upgradeLevel + 1));
    audioSystem.playSFX('window_open');
  };
  inputHandlers.onScroll = () => {};

  // Main menu
  mainMenuScreen.onNavigate = (screen, action) => {
    audioSystem.playSFX('button_click');
    if (action === 'new_game') { startNewGame(); navigateTo('game'); }
    else if (action === 'load_game') { if (loadGame()) navigateTo('game'); }
    else if (screen === 'achievements') { refreshAchievementsScreen(); navigateTo('achievements'); }
    else if (screen === 'statistics') { refreshStatisticsScreen(); navigateTo('statistics'); }
    else if (screen === 'settings') { settingsScreen.refresh(stateManager.getState().settings); navigateTo('settings'); }
    else if (screen === 'help') { navigateTo('help'); }
    else if (screen === 'about') { navigateTo('about'); }
  };

  // Screen back buttons
  achievementsScreen.onBack = () => { audioSystem.playSFX('button_click'); navigateTo(cameFromScreen === 'game' ? 'game' : 'main_menu'); };
  statisticsScreen.onBack = () => { audioSystem.playSFX('button_click'); navigateTo(cameFromScreen === 'game' ? 'game' : 'main_menu'); };
  settingsScreen.onBack = () => { audioSystem.playSFX('button_click'); navigateTo(cameFromScreen === 'game' ? 'game' : 'main_menu'); };
  helpScreen.onBack = () => { audioSystem.playSFX('button_click'); navigateTo('main_menu'); };
  aboutScreen.onBack = () => { audioSystem.playSFX('button_click'); navigateTo('main_menu'); };

  // Settings change
  settingsScreen.onSettingsChange = (partial) => {
    const state = stateManager.getState();
    stateManager.setState({ settings: { ...state.settings, ...partial } });
    if (partial.language !== undefined) { localization.setLanguage(partial.language); bus.emit({ type: 'language_changed', lang: partial.language }); }
    if (partial.musicVolume !== undefined) audioSystem.setMusicVolume(partial.musicVolume);
    if (partial.sfxVolume !== undefined) audioSystem.setSFXVolume(partial.sfxVolume);
    if (partial.defaultSpeed !== undefined) timeController.setSpeed(partial.defaultSpeed);
  };
}

// Wire callbacks on initial setup
wireAllCallbacks();

// ---------------------------------------------------------------------------
// Navigation helper
// ---------------------------------------------------------------------------

/** Tracks which screen the user came from, so "Back" returns correctly. */
let cameFromScreen: ScreenType = 'main_menu';

function navigateTo(screen: ScreenType): void {
  // Remember where we came from before switching
  const current = screenRouter.getCurrentScreen();
  if (current && current !== screen) {
    cameFromScreen = current;
  }

  screenRouter.navigateTo(screen);

  // Refresh screens that need live data when shown
  if (screen === 'main_menu') {
    mainMenuScreen.refresh();
  }
}

// ---------------------------------------------------------------------------
// Screen data refresh helpers
// ---------------------------------------------------------------------------

function refreshAchievementsScreen(): void {
  const state = stateManager.getState();
  achievementsScreen.refresh(state, ACHIEVEMENT_DEFINITIONS, state.achievements);
}

function refreshStatisticsScreen(): void {
  const state = stateManager.getState();
  const nextAchievement = achievementManager.getNextClosestAchievement(state);
  statisticsScreen.refresh(state, nextAchievement, ACHIEVEMENT_DEFINITIONS);
}

// ---------------------------------------------------------------------------
// Game start / load helpers
// ---------------------------------------------------------------------------

function startNewGame(): void {
  const freshState = createInitialState();
  stateManager.loadState(freshState);

  // Apply settings from the fresh state
  localization.setLanguage(freshState.settings.language);
  timeController.setSpeed(freshState.settings.defaultSpeed);
  timeController.setTickInterval(freshState.settings.tickIntervalSeconds);
  timeController.resume();

  // Update HUD
  const genPerTick = economy.getTotalGenerationPerTick(freshState.desks, 0);
  hud.update(freshState, genPerTick);
  hud.setSpeed(freshState.settings.defaultSpeed);
  hud.setPaused(false);

  // Start music on first user interaction
  audioSystem.playMusic(0);
}

function loadGame(): boolean {
  let saved;
  try {
    saved = saveSystem.load();
  } catch (err) {
    console.error('[LoadGame] Unexpected error loading save:', err);
    saved = null;
  }

  if (!saved) {
    // Save data was corrupted or missing — offer to start a new game
    showNotificationBanner(
      'Save data corrupted or unreadable. Please start a new game.',
      'error',
      0,
    );
    return false;
  }

  stateManager.loadState(saved);

  // Apply loaded settings
  localization.setLanguage(saved.settings.language);
  timeController.setSpeed(saved.settings.defaultSpeed);
  timeController.setTickInterval(saved.settings.tickIntervalSeconds);
  timeController.resume();

  // Update HUD
  const bonusSum = achievementManager.getTotalBonusSum(
    saved.achievements,
    saved.playTimeTicks,
  );
  const genPerTick = economy.getTotalGenerationPerTick(saved.desks, bonusSum);
  hud.update(saved, genPerTick);
  hud.setSpeed(saved.settings.defaultSpeed);
  hud.setPaused(false);

  audioSystem.playMusic(0);
  return true;
}

// ---------------------------------------------------------------------------
// Notification banner helper
// ---------------------------------------------------------------------------

/**
 * Shows a styled notification banner at the top of the screen.
 * Matches the game's dark pixel-art aesthetic.
 * Returns the element so callers can remove it later.
 */
function showNotificationBanner(
  message: string,
  level: 'error' | 'warning' | 'info' = 'error',
  autoDismissMs: number = 0,
): HTMLDivElement {
  const colors = {
    error: { bg: '#4a0010', border: '#e94560' },
    warning: { bg: '#3a2a00', border: '#ffd700' },
    info: { bg: '#0a1a3a', border: '#4d96ff' },
  };
  const { bg, border } = colors[level];

  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; padding: 12px 40px 12px 16px;
    background: ${bg}; border-bottom: 2px solid ${border};
    color: #e0e0e0; font-family: monospace, 'Courier New', Courier;
    z-index: 10000; text-align: center; font-size: 13px;
    line-height: 1.4; image-rendering: pixelated;
    animation: osm-banner-in 0.3s ease-out;
  `;
  banner.textContent = message;

  // Close button
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    position: absolute; top: 8px; right: 12px; cursor: pointer;
    font-size: 16px; color: #888; line-height: 1;
  `;
  closeBtn.addEventListener('click', () => banner.remove());
  banner.appendChild(closeBtn);

  document.body.appendChild(banner);

  if (autoDismissMs > 0) {
    setTimeout(() => banner.remove(), autoDismissMs);
  }

  return banner;
}

// ---------------------------------------------------------------------------
// Browser compatibility check (Requirement 22.5)
// ---------------------------------------------------------------------------

function checkCompatibility(): boolean {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Critical: Canvas support
  if (!canvas.getContext) {
    issues.push('HTML5 Canvas is not supported — the game cannot render.');
  }

  // Non-critical: localStorage
  let localStorageAvailable = false;
  try {
    const testKey = '__osm_compat_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }
  if (!localStorageAvailable) {
    warnings.push('localStorage is not available — saves will not work.');
  }

  // Non-critical: Web Audio API
  const hasWebAudio = typeof AudioContext !== 'undefined' ||
    typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';
  if (!hasWebAudio) {
    warnings.push('Web Audio API is not available — audio will be disabled.');
  }

  // Non-critical: OffscreenCanvas (used by PixelArtGenerator)
  if (typeof OffscreenCanvas === 'undefined') {
    warnings.push('OffscreenCanvas is not supported — sprite rendering may be slower.');
  }

  // Fatal issues — show error screen and abort
  if (issues.length > 0) {
    showFatalErrorScreen(issues.join(' '));
    return false;
  }

  // Non-fatal warnings — show a dismissible banner
  if (warnings.length > 0) {
    showNotificationBanner(
      `⚠ ${warnings.join(' ')}`,
      'warning',
      10000,
    );
  }

  return true;
}

/**
 * Shows a full-screen error when the game cannot start at all.
 * Styled to match the game's dark pixel-art theme.
 */
function showFatalErrorScreen(message: string): void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #1a1a2e; color: #e0e0e0;
    font-family: monospace, 'Courier New', Courier;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    z-index: 10001; text-align: center; padding: 2rem;
  `;

  overlay.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">⚠</div>
    <h1 style="font-size: 20px; color: #e94560; margin-bottom: 12px; font-family: monospace;">
      Openspacemarin cannot start
    </h1>
    <p style="font-size: 14px; max-width: 480px; line-height: 1.6; color: #aaa;">
      ${message}
    </p>
    <p style="font-size: 12px; margin-top: 24px; color: #666;">
      Please try a modern browser (Chrome, Firefox, Safari, or Edge).
    </p>
  `;

  document.body.appendChild(overlay);
}

// ---------------------------------------------------------------------------
// Global error boundary (Requirement 22.2)
// ---------------------------------------------------------------------------

/**
 * Shows a user-friendly error screen when an unhandled error occurs,
 * instead of leaving the player with a blank page.
 */
function installGlobalErrorHandlers(): void {
  window.onerror = (_message, _source, _lineno, _colno, error) => {
    console.error('[Openspacemarin] Unhandled error:', error);
    showNotificationBanner(
      'An unexpected error occurred. The game may not work correctly. Try refreshing the page.',
      'error',
      0,
    );
    // Return true to prevent the default browser error handling
    return true;
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    console.error('[Openspacemarin] Unhandled promise rejection:', event.reason);
    showNotificationBanner(
      'An unexpected error occurred. The game may not work correctly. Try refreshing the page.',
      'error',
      0,
    );
  };
}

// ---------------------------------------------------------------------------
// Audio context suspension prompt (Requirement 17.1)
// ---------------------------------------------------------------------------

/**
 * Shows a "Click to enable audio" prompt when the AudioContext is suspended
 * due to browser autoplay policy. Resumes on first user interaction.
 */
function installAudioContextResumeHandler(): void {
  // Check after a short delay — AudioContext may not be created yet at boot
  const checkAndPrompt = () => {
    // Access the audio system's internal context state via a duck-type check
    const audioAny = audioSystem as unknown as { ctx?: AudioContext; available?: boolean };
    if (!audioAny.available) return; // Web Audio not available — nothing to do

    // If context exists and is suspended, show prompt
    if (audioAny.ctx && audioAny.ctx.state === 'suspended') {
      const prompt = document.createElement('div');
      prompt.id = 'osm-audio-prompt';
      prompt.style.cssText = `
        position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
        background: #1a1a2e; border: 1px solid #4d96ff; border-radius: 4px;
        color: #e0e0e0; font-family: monospace, 'Courier New', Courier;
        font-size: 12px; padding: 8px 16px; z-index: 9999;
        cursor: pointer; opacity: 0.9;
      `;
      prompt.textContent = '🔇 Click to enable audio';

      const dismiss = () => {
        prompt.remove();
        if (audioAny.ctx && audioAny.ctx.state === 'suspended') {
          void audioAny.ctx.resume();
        }
        document.removeEventListener('click', dismiss);
        document.removeEventListener('touchstart', dismiss);
        document.removeEventListener('keydown', dismiss);
      };

      prompt.addEventListener('click', dismiss);
      // Also resume on any user interaction
      document.addEventListener('click', dismiss, { once: true });
      document.addEventListener('touchstart', dismiss, { once: true });
      document.addEventListener('keydown', dismiss, { once: true });

      document.body.appendChild(prompt);
    }
  };

  // Check shortly after bootstrap (AudioContext is created lazily)
  setTimeout(checkAndPrompt, 1000);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrap(): void {
  // Install global error boundary first — catches errors during init too
  installGlobalErrorHandlers();

  if (!checkCompatibility()) return;

  // Start the render loop immediately (renders splash/menu backgrounds)
  gameLoop.start();

  // Show splash screen immediately
  screenRouter.showImmediate('splash');

  // Install audio context resume handler for autoplay policy
  installAudioContextResumeHandler();

  // Start splash timer
  splashScreen.start(
    stateManager.getState().firstLaunchDone,
    (nextScreen: ScreenType) => {
      if (nextScreen === 'welcome') {
        navigateTo('welcome');
        welcomeScreen.start(() => {
          // Mark first launch done
          stateManager.setState({ firstLaunchDone: true });
          navigateTo('main_menu');
        });
      } else {
        navigateTo('main_menu');
      }
    },
  );
}

bootstrap();
