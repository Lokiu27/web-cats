// Achievement Manager for Openspacemarin
// Requirements: 7.1–7.6, 8.1–8.5
//
// Tracks progress for all 28 achievements, unlocks them when conditions are
// met, applies permanent and temporary bonus multipliers, and surfaces the
// next closest achievement for the statistics screen.
//
// Design notes:
//   - Once an achievement is unlocked it stays unlocked (Property 8).
//   - Temporary bonuses expire after `durationTicks` ticks (Property 9).
//   - bonusPercent values are stored as whole numbers (e.g., 5 = +5%).
//     getTotalBonusSum() returns the sum as a fraction (e.g., 0.05).
//   - The manager is stateless between calls — it reads from GameState and
//     returns newly unlocked achievements; the caller persists the updated
//     AchievementState[] back into GameState.

import type {
  Achievement,
  AchievementCategory,
  AchievementDefinition,
  AchievementProgress,
  AchievementState,
  GameState,
  IAchievementManager,
  IEventBus,
} from '../types/index.js';
import { ACHIEVEMENT_DEFINITIONS, ACHIEVEMENT_MAP } from '../data/achievements.js';

// ---------------------------------------------------------------------------
// Condition evaluators
// ---------------------------------------------------------------------------

/**
 * Returns the current progress value for a given achievement condition.
 * Progress is a raw number (desk count, level, currency, etc.) that is
 * compared against the condition's target.
 */
function getProgress(def: AchievementDefinition, state: GameState): number {
  const cond = def.condition;

  switch (cond.type) {
    case 'desk_count':
      return state.desks.length;

    case 'single_desk_level':
      return state.desks.reduce((max, d) => Math.max(max, d.upgradeLevel), 0);

    case 'total_upgrades':
      return state.totalUpgradeCount;

    case 'total_currency':
      return state.totalGeneratedCurrency;

    case 'play_time_hours': {
      // playTimeTicks at 1 tick/s → seconds; convert to hours
      // We use tickIntervalSeconds from settings to get real seconds.
      const realSeconds = state.playTimeTicks * state.settings.tickIntervalSeconds;
      return realSeconds / 3600;
    }

    case 'all_desks_same_level': {
      if (state.desks.length < cond.minDesks) return 0;
      const levels = state.desks.map(d => d.upgradeLevel);
      const allSame = levels.every(l => l === levels[0]);
      return allSame ? cond.minDesks : 0; // binary: either qualifies or not
    }

    case 'specialist': {
      if (state.desks.length < 2) return 0;
      const levels = state.desks.map(d => d.upgradeLevel);
      // Gap between the single highest desk and the next highest
      const sorted = [...levels].sort((a, b) => b - a);
      const gap = sorted[0] - sorted[1];
      return gap;
    }

    case 'equilibrium': {
      if (state.desks.length < cond.minDesks) return 0;
      const levels = state.desks.map(d => d.upgradeLevel);
      const evenCount = levels.filter(l => l % 2 === 0).length;
      const oddCount = levels.length - evenCount;
      const evenRatio = evenCount / levels.length;
      const oddRatio = oddCount / levels.length;
      // Both must be exactly 50% (within floating-point tolerance)
      const balanced = Math.abs(evenRatio - 0.5) < 0.01 && Math.abs(oddRatio - 0.5) < 0.01;
      return balanced ? cond.minDesks : 0;
    }

    case 'speed_start': {
      // Condition: reach desksTarget desks within ticksLimit ticks from game start
      if (state.playTimeTicks > cond.ticksLimit) {
        // Time window has passed — only counts if already met
        return state.desks.length >= cond.desksTarget ? cond.desksTarget : 0;
      }
      return state.desks.length;
    }

    case 'all_desks_min_level': {
      if (state.desks.length < cond.minDesks) return 0;
      const allMeetMin = state.desks.every(d => d.upgradeLevel >= cond.minLevel);
      return allMeetMin ? cond.minDesks : 0;
    }
  }
}

/**
 * Returns the target value for progress display purposes.
 */
function getTarget(def: AchievementDefinition): number {
  const cond = def.condition;
  switch (cond.type) {
    case 'desk_count':        return cond.target;
    case 'single_desk_level': return cond.target;
    case 'total_upgrades':    return cond.target;
    case 'total_currency':    return cond.target;
    case 'play_time_hours':   return cond.target;
    case 'all_desks_same_level': return cond.minDesks;
    case 'specialist':        return cond.levelGap;
    case 'equilibrium':       return cond.minDesks;
    case 'speed_start':       return cond.desksTarget;
    case 'all_desks_min_level': return cond.minDesks;
  }
}

/**
 * Returns true when the achievement condition is fully satisfied.
 */
function isMet(def: AchievementDefinition, state: GameState): boolean {
  const progress = getProgress(def, state);
  const target = getTarget(def);
  return progress >= target;
}

// ---------------------------------------------------------------------------
// AchievementManager class
// ---------------------------------------------------------------------------

export class AchievementManager implements IAchievementManager {
  private readonly bus: IEventBus;

  /**
   * @param bus - Event bus for emitting `achievement_unlocked` events
   */
  constructor(bus: IEventBus) {
    this.bus = bus;
  }

  // ---------------------------------------------------------------------------
  // IAchievementManager — read operations
  // ---------------------------------------------------------------------------

  /**
   * Returns all 28 achievements merged with their current state.
   * Achievements without a saved state are treated as locked with progress 0.
   */
  getAchievements(achievementStates?: AchievementState[]): Achievement[] {
    const stateMap = new Map((achievementStates ?? []).map(s => [s.id, s]));
    return ACHIEVEMENT_DEFINITIONS.map(def => ({
      definition: def,
      state: stateMap.get(def.id) ?? this.defaultState(def.id),
    }));
  }

  /** @inheritdoc */
  getAchievementsByCategory(
    category: AchievementCategory,
    achievementStates?: AchievementState[],
  ): Achievement[] {
    return this.getAchievements(achievementStates).filter(
      a => a.definition.category === category,
    );
  }

  /**
   * Checks all 28 achievement conditions against the current game state.
   * Unlocks any that are newly met and emits `achievement_unlocked` for each.
   *
   * Rules:
   *   - Already-unlocked achievements are never re-unlocked (Property 8).
   *   - Temporary achievements that have expired can be re-unlocked if the
   *     condition is met again (the bonus window restarts).
   *
   * Returns the list of newly unlocked achievements so the caller can update
   * GameState.achievements.
   *
   * Requirements: 7.2, 7.5
   */
  checkAndUnlock(state: GameState): Achievement[] {
    const stateMap = new Map(state.achievements.map(s => [s.id, s]));
    const newlyUnlocked: Achievement[] = [];

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      const existing = stateMap.get(def.id);

      // Permanent achievements stay unlocked forever
      if (existing?.unlocked && !def.isTemporary) continue;

      // Temporary achievements: skip if bonus is still active
      if (existing?.unlocked && def.isTemporary) {
        const expiresTick = existing.temporaryBonusExpiresTick ?? 0;
        if (state.playTimeTicks < expiresTick) continue;
        // Bonus has expired — allow re-unlock if condition is still met
      }

      if (!isMet(def, state)) continue;

      // Build the new achievement state
      const newState: AchievementState = def.isTemporary
        ? {
            id: def.id,
            unlocked: true,
            unlockedAtTick: state.playTimeTicks,
            progress: getProgress(def, state),
            temporaryBonusExpiresTick: state.playTimeTicks + (def.durationTicks ?? 0),
          }
        : {
            id: def.id,
            unlocked: true,
            unlockedAtTick: state.playTimeTicks,
            progress: getProgress(def, state),
          };

      stateMap.set(def.id, newState);

      const achievement: Achievement = { definition: def, state: newState };
      newlyUnlocked.push(achievement);

      this.bus.emit({ type: 'achievement_unlocked', achievement });
    }

    return newlyUnlocked;
  }

  /**
   * Sums all active (non-expired) achievement bonuses as a fraction.
   *
   * Example: two achievements with +5% and +10% → returns 0.15
   *
   * Temporary bonuses are excluded once their expiry tick has passed.
   *
   * Requirements: 7.3, 7.5
   */
  getTotalBonusSum(achievementStates: AchievementState[], currentTick: number): number {
    let sum = 0;

    for (const s of achievementStates) {
      if (!s.unlocked) continue;

      const def = ACHIEVEMENT_MAP.get(s.id);
      if (!def) continue;

      // Exclude expired temporary bonuses
      if (def.isTemporary && s.temporaryBonusExpiresTick !== undefined) {
        if (currentTick >= s.temporaryBonusExpiresTick) continue;
      }

      sum += def.bonusPercent / 100;
    }

    return sum;
  }

  /** Returns the count of unlocked achievements. */
  getUnlockedCount(achievementStates: AchievementState[]): number {
    return achievementStates.filter(s => s.unlocked).length;
  }

  /** Returns the total number of achievement definitions (always 28). */
  getTotalCount(): number {
    return ACHIEVEMENT_DEFINITIONS.length;
  }

  /**
   * Finds the closest-to-completion locked achievement for the statistics
   * screen progress bar.
   *
   * "Closest" = highest (progress / target) ratio among locked achievements.
   * Temporary achievements that are currently active are excluded.
   *
   * Requirements: 15.3
   */
  getNextClosestAchievement(state: GameState): AchievementProgress | null {
    const stateMap = new Map(state.achievements.map(s => [s.id, s]));

    let best: AchievementProgress | null = null;
    let bestRatio = -1;

    for (const def of ACHIEVEMENT_DEFINITIONS) {
      const existing = stateMap.get(def.id);

      // Skip permanently unlocked
      if (existing?.unlocked && !def.isTemporary) continue;

      // Skip temporary achievements whose bonus is still active
      if (existing?.unlocked && def.isTemporary) {
        const expiresTick = existing.temporaryBonusExpiresTick ?? 0;
        if (state.playTimeTicks < expiresTick) continue;
      }

      const progress = getProgress(def, state);
      const target = getTarget(def);
      const ratio = target > 0 ? Math.min(progress / target, 1) : 0;

      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = {
          definition: def,
          state: existing ?? this.defaultState(def.id),
          progressPercent: Math.round(ratio * 100),
        };
      }
    }

    return best;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private defaultState(id: string): AchievementState {
    return { id, unlocked: false, progress: 0 };
  }
}

// ---------------------------------------------------------------------------
// Interface overloads note
// ---------------------------------------------------------------------------
// The IAchievementManager interface in types/index.ts declares signatures
// without the extra `achievementStates` / `currentTick` parameters because
// those are implementation details. The concrete class adds them as optional
// parameters for callers that have the data available, while still satisfying
// the interface contract.
