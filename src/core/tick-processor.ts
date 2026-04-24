// Tick Processor for Openspacemarin
// Requirements: 2.6, 4.3, 5.6, 7.2, 11.1
//
// Executes all per-tick game logic in the correct sequence:
//   1. Increment play time
//   2. Compute total currency generation (desks × achievement bonuses)
//   3. Add generated currency to the balance
//   4. Check and unlock achievements
//   5. Trigger auto-save (handled by TimeController, but processor updates state)
//
// The processor is stateless — it reads from GameState and returns an updated
// partial state. The caller (main.ts) applies the update via StateManager.

import type { AchievementState, GameState } from '../types/index.js';
import type { EconomyCalculator } from '../systems/economy.js';
import type { AchievementManager } from '../systems/achievement-manager.js';

// ---------------------------------------------------------------------------
// TickResult
// ---------------------------------------------------------------------------

export interface TickResult {
  /** Updated currency balance after this tick. */
  currency: number;
  /** Total currency generated this tick (for floating number effects). */
  generated: number;
  /** Updated lifetime total generated currency. */
  totalGeneratedCurrency: number;
  /** Updated play time in ticks. */
  playTimeTicks: number;
  /** Updated achievement states (may include newly unlocked achievements). */
  achievements: AchievementState[];
  /** Updated statistics. */
  statistics: GameState['statistics'];
}

// ---------------------------------------------------------------------------
// TickProcessor class
// ---------------------------------------------------------------------------

export class TickProcessor {
  private readonly economy: EconomyCalculator;
  private readonly achievementManager: AchievementManager;

  /**
   * @param economy            - Economy calculator for generation formulas
   * @param achievementManager - Achievement manager for unlock checks
   */
  constructor(economy: EconomyCalculator, achievementManager: AchievementManager) {
    this.economy = economy;
    this.achievementManager = achievementManager;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Processes one game tick against the given state snapshot.
   *
   * Sequence (Requirement 5.6):
   *   1. Increment playTimeTicks
   *   2. Compute achievement bonus sum (excluding expired temporary bonuses)
   *   3. Compute total currency generated this tick
   *   4. Add generated currency to balance and totalGeneratedCurrency
   *   5. Check and unlock achievements against the updated state
   *   6. Return the updated fields (caller applies via StateManager.setState)
   *
   * Requirements: 4.3, 5.6, 7.2
   *
   * @param state - Current game state snapshot (read-only)
   * @returns Partial state update to be merged by the caller
   */
  processTick(state: Readonly<GameState>): TickResult {
    // 1. Increment play time
    const playTimeTicks = state.playTimeTicks + 1;

    // 2. Compute achievement bonus sum at the new tick count
    const bonusSum = this.achievementManager.getTotalBonusSum(
      state.achievements,
      playTimeTicks,
    );

    // 3. Compute total currency generated this tick (Requirement 4.3)
    const generated = this.economy.getTotalGenerationPerTick(state.desks, bonusSum);

    // 4. Update currency and lifetime total
    const currency = state.currency + generated;
    const totalGeneratedCurrency = state.totalGeneratedCurrency + generated;

    // 5. Build an updated state snapshot for achievement checking
    //    (achievements need the new currency/play-time values to evaluate correctly)
    const updatedState: GameState = {
      ...state,
      currency,
      totalGeneratedCurrency,
      playTimeTicks,
    };

    // 6. Check and unlock achievements
    const newlyUnlocked = this.achievementManager.checkAndUnlock(updatedState);

    // Merge newly unlocked achievement states into the existing array
    let achievements = [...state.achievements];
    for (const achievement of newlyUnlocked) {
      const idx = achievements.findIndex(a => a.id === achievement.state.id);
      if (idx >= 0) {
        achievements[idx] = achievement.state;
      } else {
        achievements = [...achievements, achievement.state];
      }
    }

    // Update statistics
    const statistics: GameState['statistics'] = {
      ...state.statistics,
      totalAchievementsUnlocked: achievements.filter(a => a.unlocked).length,
      recentAchievements: newlyUnlocked.length > 0
        ? [
            ...newlyUnlocked.map(a => a.definition.id),
            ...state.statistics.recentAchievements,
          ].slice(0, 10)
        : state.statistics.recentAchievements,
    };

    return {
      currency,
      generated,
      totalGeneratedCurrency,
      playTimeTicks,
      achievements,
      statistics,
    };
  }
}
