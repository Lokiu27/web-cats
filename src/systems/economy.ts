// Economy Calculator for Openspacemarin
// Requirements: 2.3, 3.3, 4.1, 4.2, 4.6, 24.1–24.6
//
// All cost and generation formulas are centralised here so game balance
// stays consistent. Every formula is a pure function — no side effects,
// no external state — making them trivially testable.

import type { Desk, IEconomyCalculator } from '../types/index.js';
import { ECONOMY } from '../data/economy.js';
import { formatCurrency } from '../utils/formatting.js';

export class EconomyCalculator implements IEconomyCalculator {
  // ---------------------------------------------------------------------------
  // Cost formulas
  // ---------------------------------------------------------------------------

  /**
   * Cost to purchase the next desk when the office already has `totalDesks`.
   *
   * Formula: BASE_DESK_COST * (1 + DESK_COST_GROWTH_RATE) ^ (totalDesks - 1)
   *   = 100 * 1.15 ^ (totalDesks - 1)
   *
   * Requirement 2.3, 24.1
   *
   * @param totalDesks - Current number of desks (≥ 1)
   */
  getDeskPurchaseCost(totalDesks: number): number {
    return (
      ECONOMY.BASE_DESK_COST *
      Math.pow(1 + ECONOMY.DESK_COST_GROWTH_RATE, totalDesks - 1)
    );
  }

  /**
   * Cost to upgrade a desk that is currently at `upgradeLevel`.
   *
   * Formula: BASE_UPGRADE_COST * (1 + UPGRADE_COST_GROWTH_RATE) ^ upgradeLevel
   *   = 50 * 1.2 ^ upgradeLevel
   *
   * Requirement 3.3, 24.2
   *
   * @param upgradeLevel - Current upgrade level of the desk (≥ 0)
   */
  getUpgradeCost(upgradeLevel: number): number {
    return (
      ECONOMY.BASE_UPGRADE_COST *
      Math.pow(1 + ECONOMY.UPGRADE_COST_GROWTH_RATE, upgradeLevel)
    );
  }

  // ---------------------------------------------------------------------------
  // Generation formulas
  // ---------------------------------------------------------------------------

  /**
   * Base currency generated per tick by a single desk at `upgradeLevel`,
   * before achievement bonuses are applied.
   *
   * Formula: BASE_CURRENCY_PER_TICK * (1 + UPGRADE_BONUS_RATE) ^ upgradeLevel
   *   = 1 * 1.25 ^ upgradeLevel
   *
   * Requirement 4.1, 24.3
   *
   * @param upgradeLevel - Upgrade level of the desk (≥ 0)
   */
  getDeskGeneration(upgradeLevel: number): number {
    return (
      ECONOMY.BASE_CURRENCY_PER_TICK *
      Math.pow(1 + ECONOMY.UPGRADE_BONUS_RATE, upgradeLevel)
    );
  }

  /**
   * Applies the cumulative achievement bonus multiplier to a desk's base
   * generation.
   *
   * Formula: baseGeneration * (1 + achievementBonusSum)
   *
   * Requirement 4.2, 24.4
   *
   * @param baseGeneration     - Per-desk generation before bonuses
   * @param achievementBonusSum - Sum of all unlocked achievement bonus fractions
   *                             (e.g., 0.05 for +5%, 0.20 for +20%)
   */
  getFinalGeneration(baseGeneration: number, achievementBonusSum: number): number {
    return baseGeneration * (1 + achievementBonusSum);
  }

  /**
   * Total currency generated per tick across all desks, with achievement
   * bonuses applied.
   *
   * Requirement 4.3
   *
   * @param desks               - All desks in the office
   * @param achievementBonusSum - Sum of all unlocked achievement bonus fractions
   */
  getTotalGenerationPerTick(desks: Desk[], achievementBonusSum: number): number {
    return desks.reduce((sum, desk) => {
      const base = this.getDeskGeneration(desk.upgradeLevel);
      return sum + this.getFinalGeneration(base, achievementBonusSum);
    }, 0);
  }

  // ---------------------------------------------------------------------------
  // Payback time helpers (Requirement 24.5, 24.6)
  // ---------------------------------------------------------------------------

  /**
   * Estimated ticks to recoup the cost of buying the next desk.
   *
   * Formula: deskCost / (newDeskGeneration * (1 + achievementBonuses))
   *
   * Requirement 24.5
   *
   * @param totalDesks          - Current desk count (the new desk will be #totalDesks+1)
   * @param achievementBonusSum - Sum of all unlocked achievement bonus fractions
   */
  getDeskPaybackTime(totalDesks: number, achievementBonusSum: number): number {
    const cost = this.getDeskPurchaseCost(totalDesks);
    // The new desk starts at level 0
    const newDeskGen = this.getFinalGeneration(
      this.getDeskGeneration(0),
      achievementBonusSum,
    );
    if (newDeskGen <= 0) return Infinity;
    return cost / newDeskGen;
  }

  /**
   * Estimated ticks to recoup the cost of upgrading a desk from `upgradeLevel`
   * to `upgradeLevel + 1`.
   *
   * Formula: upgradeCost / (generationIncrease * (1 + achievementBonuses))
   *
   * Requirement 24.6
   *
   * @param upgradeLevel        - Current upgrade level of the desk
   * @param achievementBonusSum - Sum of all unlocked achievement bonus fractions
   */
  getUpgradePaybackTime(upgradeLevel: number, achievementBonusSum: number): number {
    const cost = this.getUpgradeCost(upgradeLevel);
    const currentGen = this.getDeskGeneration(upgradeLevel);
    const nextGen = this.getDeskGeneration(upgradeLevel + 1);
    const increase = this.getFinalGeneration(nextGen - currentGen, achievementBonusSum);
    if (increase <= 0) return Infinity;
    return cost / increase;
  }

  // ---------------------------------------------------------------------------
  // Formatting (Requirement 4.6)
  // ---------------------------------------------------------------------------

  /**
   * Formats a currency value with K/M/B/T abbreviations.
   * Delegates to the shared `formatCurrency` utility.
   *
   * @param value - Non-negative number to format
   */
  formatCurrency(value: number): string {
    return formatCurrency(value);
  }
}
