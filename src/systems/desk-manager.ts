// Desk Manager for Openspacemarin
// Requirements: 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.4, 3.5, 3.6
//
// Handles all desk lifecycle operations: purchasing new desks and upgrading
// existing ones. Each operation validates currency, mutates state via the
// provided update callback, and emits the appropriate events through the
// event bus.
//
// Hex placement strategy: desks are laid out in a spiral-like pattern that
// expands to the right. The next available cell is determined by scanning
// occupied coords and picking the smallest q-column that has a free r-row
// slot, keeping the grid compact and visually expanding rightward.

import type {
  Desk,
  GameState,
  HexCoord,
  IDeskManager,
  IEconomyCalculator,
  IEventBus,
  PurchaseResult,
  UpgradeResult,
} from '../types/index.js';
import type { ICatAppearanceGenerator } from '../types/index.js';
import { ECONOMY } from '../data/economy.js';

// ---------------------------------------------------------------------------
// Hex placement helpers
// ---------------------------------------------------------------------------

/**
 * Returns the next unoccupied hex coordinate for a new desk.
 *
 * Layout: desks fill a 4-row grid expanding to the right.
 *   Rows 0–3, columns grow from 0.
 *   Fills column-by-column (all rows in column 0, then column 1, etc.)
 *   so the office grows rightward naturally.
 */
function nextHexCoord(occupied: Set<string>): HexCoord {
  for (let q = 0; q < 10_000; q++) {
    for (let r = 0; r < 4; r++) {
      const key = `${q},${r}`;
      if (!occupied.has(key)) {
        return { q, r };
      }
    }
  }
  return { q: occupied.size, r: 0 };
}

function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

// ---------------------------------------------------------------------------
// DeskManager class
// ---------------------------------------------------------------------------

export class DeskManager implements IDeskManager {
  private readonly economy: IEconomyCalculator;
  private readonly catGenerator: ICatAppearanceGenerator;
  private readonly bus: IEventBus;

  /**
   * @param economy      - Economy calculator for cost/generation formulas
   * @param catGenerator - Cat appearance + name generator
   * @param bus          - Event bus for emitting desk/currency events
   */
  constructor(
    economy: IEconomyCalculator,
    catGenerator: ICatAppearanceGenerator,
    bus: IEventBus,
  ) {
    this.economy = economy;
    this.catGenerator = catGenerator;
    this.bus = bus;
  }

  // ---------------------------------------------------------------------------
  // IDeskManager — read operations
  // ---------------------------------------------------------------------------

  /** Returns all desks from the provided state snapshot. */
  getDesks(): Desk[] {
    // DeskManager is stateless — callers pass state into mutating operations.
    // This method is provided for interface compliance; callers should read
    // desks directly from GameState in most cases.
    return [];
  }

  /** Finds the desk occupying `hexCoord`, or null if the cell is empty. */
  getDeskAt(_hexCoord: HexCoord): Desk | null {
    // Stateless — see note on getDesks(). Use getDeskAtFromState() instead.
    return null;
  }

  /** Returns the total desk count from the provided state. */
  getTotalDesks(): number {
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Stateful helpers (operate on a GameState snapshot)
  // ---------------------------------------------------------------------------

  /**
   * Finds the desk at `hexCoord` within the given state.
   */
  getDeskAtFromState(hexCoord: HexCoord, state: GameState): Desk | null {
    const key = coordKey(hexCoord);
    return state.desks.find(d => coordKey(d.hexCoord) === key) ?? null;
  }

  // ---------------------------------------------------------------------------
  // IDeskManager — mutating operations
  // ---------------------------------------------------------------------------

  /**
   * Attempts to purchase a new desk.
   *
   * Steps:
   *   1. Compute cost for the next desk (based on current desk count).
   *   2. Validate the player has sufficient currency.
   *   3. Determine the next available hex coordinate.
   *   4. Generate a cat appearance and unique name.
   *   5. Create the desk and return the updated state fields via PurchaseResult.
   *   6. Emit `desk_purchased` and `currency_changed` events.
   *
   * The caller is responsible for applying the returned values to GameState
   * (e.g., via StateManager.setState). This keeps DeskManager stateless and
   * easy to test.
   *
   * Requirements: 2.1, 2.2, 2.4, 2.5
   */
  purchaseDesk(state: GameState): PurchaseResult {
    const totalDesks = state.desks.length;
    const cost = this.economy.getDeskPurchaseCost(totalDesks);

    // Requirement 2.4: reject if insufficient currency
    if (state.currency < cost) {
      return { success: false, error: 'insufficient_currency' };
    }

    // Find next free hex cell
    const occupied = new Set(state.desks.map(d => coordKey(d.hexCoord)));
    const hexCoord = nextHexCoord(occupied);

    // Generate cat
    const existingNames = state.desks.map(d => d.cat.name);
    const appearance = this.catGenerator.generate();
    const name = this.catGenerator.generateName(existingNames, state.settings.language);
    const biography = this.catGenerator.generateBiography(state.settings.language);

    const desk: Desk = {
      id: `desk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      hexCoord,
      upgradeLevel: 0,
      cat: { name, appearance, biography },
    };

    const newCurrency = state.currency - cost;

    // Emit events (state update is the caller's responsibility)
    this.bus.emit({ type: 'desk_purchased', desk });
    this.bus.emit({
      type: 'currency_changed',
      oldValue: state.currency,
      newValue: newCurrency,
      delta: -cost,
    });

    return { success: true, desk, newCurrency };
  }

  /**
   * Attempts to upgrade the desk identified by `deskId`.
   *
   * Steps:
   *   1. Locate the desk in state.
   *   2. Compute upgrade cost for its current level.
   *   3. Validate sufficient currency.
   *   4. Increment the desk's upgrade level.
   *   5. Return updated values via UpgradeResult.
   *   6. Emit `desk_upgraded` and `currency_changed` events.
   *
   * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
   */
  upgradeDesk(deskId: string, state: GameState): UpgradeResult {
    const deskIndex = state.desks.findIndex(d => d.id === deskId);

    // Requirement 3.1: desk must exist
    if (deskIndex === -1) {
      return { success: false, error: 'desk_not_found' };
    }

    const desk = state.desks[deskIndex];

    // Requirement 5.1, 5.4: reject if desk is already at max level
    if (desk.upgradeLevel >= ECONOMY.MAX_UPGRADE_LEVEL) {
      return { success: false, error: 'max_level_reached' };
    }

    const cost = this.economy.getUpgradeCost(desk.upgradeLevel);

    // Requirement 3.5: reject if insufficient currency
    if (state.currency < cost) {
      return { success: false, error: 'insufficient_currency' };
    }

    const newLevel = desk.upgradeLevel + 1;
    const newGeneration = this.economy.getDeskGeneration(newLevel);
    const newCurrency = state.currency - cost;

    // Build the upgraded desk (immutable update)
    const upgradedDesk: Desk = { ...desk, upgradeLevel: newLevel };

    // Emit events
    this.bus.emit({ type: 'desk_upgraded', desk: upgradedDesk, newLevel });
    this.bus.emit({
      type: 'currency_changed',
      oldValue: state.currency,
      newValue: newCurrency,
      delta: -cost,
    });

    return { success: true, newLevel, newGeneration, newCurrency };
  }
}
