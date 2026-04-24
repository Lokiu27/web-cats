// Central game state manager for Openspacemarin
// Requirements: 2.6, 10.3
//
// Holds the single source of truth for GameState. State is treated as
// immutable — callers receive a frozen snapshot via getState() and update
// via setState() which merges a partial update and emits events as needed.

import type { GameState, Desk, Cat, CatAppearance, HexCoord, IEventBus } from '../types/index.js';
import { ECONOMY } from '../data/economy.js';

const SAVE_VERSION = 1;

// ---------------------------------------------------------------------------
// Initial state helpers
// ---------------------------------------------------------------------------

function makeAppearance(index: number): CatAppearance {
  // Deterministic starter appearances so the first 3 cats look distinct
  const furColors = ['orange', 'gray', 'white'] as const;
  const patterns = ['solid', 'spotted', 'striped'] as const;
  const expressions = ['focused', 'smiling', 'serious'] as const;
  const accessories = ['glasses', 'tie', 'none'] as const;
  const poses = ['upright', 'leaning'] as const;

  return {
    furColor: furColors[index % furColors.length],
    pattern: patterns[index % patterns.length],
    expression: expressions[index % expressions.length],
    accessory: accessories[index % accessories.length],
    pose: poses[index % poses.length],
  };
}

function makeStarterCat(index: number): Cat {
  const names = ['Whiskers', 'Mittens', 'Shadow'];
  return {
    name: names[index] ?? `Cat ${index + 1}`,
    appearance: makeAppearance(index),
  };
}

function makeStarterDesk(index: number): Desk {
  // Place the 3 starter desks: (0,0), (0,1), (0,2) — first column, rows 0-2
  const hexCoord: HexCoord = { q: 0, r: index };
  return {
    id: `desk-starter-${index}`,
    hexCoord,
    upgradeLevel: 0,
    cat: makeStarterCat(index),
  };
}

/**
 * Creates the initial game state for a new game.
 * Starts with 3 desks at upgrade level 0 and 150 currency (Requirement 2.6).
 */
export function createInitialState(): GameState {
  const desks: Desk[] = Array.from({ length: ECONOMY.STARTING_DESKS }, (_, i) =>
    makeStarterDesk(i),
  );

  return {
    version: SAVE_VERSION,
    desks,
    currency: ECONOMY.STARTING_CURRENCY,
    totalGeneratedCurrency: 0,
    totalUpgradeCount: 0,
    playTimeTicks: 0,
    achievements: [],
    settings: {
      language: 'en',
      musicVolume: 5,
      sfxVolume: 5,
      defaultSpeed: 1,
      tickIntervalSeconds: 1,
    },
    statistics: {
      totalDesksEverPurchased: ECONOMY.STARTING_DESKS,
      highestDeskLevel: 0,
      totalAchievementsUnlocked: 0,
      recentAchievements: [],
      gameStartTick: 0,
    },
    firstLaunchDone: false,
  };
}

// ---------------------------------------------------------------------------
// StateManager class
// ---------------------------------------------------------------------------

export class StateManager {
  private state: GameState;
  private readonly bus: IEventBus;

  constructor(bus: IEventBus, initialState?: GameState) {
    this.bus = bus;
    this.state = initialState ?? createInitialState();
  }

  /**
   * Returns a shallow-frozen snapshot of the current game state.
   * Callers must not mutate the returned object — use setState() instead.
   */
  getState(): Readonly<GameState> {
    return this.state;
  }

  /**
   * Merges a partial update into the current state and emits relevant events.
   *
   * - If `currency` changes, emits `currency_changed`.
   * - Always replaces the internal state reference (immutable update pattern).
   */
  setState(update: Partial<GameState>): void {
    const prev = this.state;
    this.state = { ...prev, ...update };

    // Emit currency_changed whenever the balance changes
    if ('currency' in update && update.currency !== prev.currency) {
      const newValue = this.state.currency;
      const oldValue = prev.currency;
      this.bus.emit({
        type: 'currency_changed',
        oldValue,
        newValue,
        delta: newValue - oldValue,
      });
    }
  }

  /**
   * Replaces the entire state (e.g., after loading a save).
   * Emits `game_loaded`.
   */
  loadState(state: GameState): void {
    this.state = state;
    this.bus.emit({ type: 'game_loaded', state });
  }
}
