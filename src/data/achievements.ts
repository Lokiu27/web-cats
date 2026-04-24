// Achievement definitions for Openspacemarin
// Requirements: 7.1–7.6, 8.1–8.5
//
// 28 achievements across 5 categories:
//   - Office Expansion  (7)
//   - Upgrades          (7)
//   - Currency Generation (5)
//   - Play Time         (4)
//   - Special           (5)
//
// bonusPercent values are whole numbers (e.g., 2 = +2%).
// The Achievement Manager converts them to fractions (÷100) when summing.

import type { AchievementDefinition } from '../types/index.js';

// ---------------------------------------------------------------------------
// Office Expansion — 7 achievements (Requirement 8.1)
// ---------------------------------------------------------------------------

const OFFICE_EXPANSION: AchievementDefinition[] = [
  {
    id: 'office_5',
    category: 'office_expansion',
    nameKey: 'achievement.office_5.name',
    descriptionKey: 'achievement.office_5.description',
    bonusPercent: 2,
    isTemporary: false,
    condition: { type: 'desk_count', target: 5 },
  },
  {
    id: 'office_10',
    category: 'office_expansion',
    nameKey: 'achievement.office_10.name',
    descriptionKey: 'achievement.office_10.description',
    bonusPercent: 5,
    isTemporary: false,
    condition: { type: 'desk_count', target: 10 },
  },
  {
    id: 'office_25',
    category: 'office_expansion',
    nameKey: 'achievement.office_25.name',
    descriptionKey: 'achievement.office_25.description',
    bonusPercent: 10,
    isTemporary: false,
    condition: { type: 'desk_count', target: 25 },
  },
  {
    id: 'office_50',
    category: 'office_expansion',
    nameKey: 'achievement.office_50.name',
    descriptionKey: 'achievement.office_50.description',
    bonusPercent: 20,
    isTemporary: false,
    condition: { type: 'desk_count', target: 50 },
  },
  {
    id: 'office_100',
    category: 'office_expansion',
    nameKey: 'achievement.office_100.name',
    descriptionKey: 'achievement.office_100.description',
    bonusPercent: 35,
    isTemporary: false,
    condition: { type: 'desk_count', target: 100 },
  },
  {
    id: 'office_250',
    category: 'office_expansion',
    nameKey: 'achievement.office_250.name',
    descriptionKey: 'achievement.office_250.description',
    bonusPercent: 50,
    isTemporary: false,
    condition: { type: 'desk_count', target: 250 },
  },
  {
    id: 'office_500',
    category: 'office_expansion',
    nameKey: 'achievement.office_500.name',
    descriptionKey: 'achievement.office_500.description',
    bonusPercent: 75,
    isTemporary: false,
    condition: { type: 'desk_count', target: 500 },
  },
];

// ---------------------------------------------------------------------------
// Upgrades — 7 achievements (Requirement 8.2)
// ---------------------------------------------------------------------------

const UPGRADES: AchievementDefinition[] = [
  // Single-desk level milestones
  {
    id: 'upgrade_level_5',
    category: 'upgrades',
    nameKey: 'achievement.upgrade_level_5.name',
    descriptionKey: 'achievement.upgrade_level_5.description',
    bonusPercent: 5,
    isTemporary: false,
    condition: { type: 'single_desk_level', target: 5 },
  },
  {
    id: 'upgrade_level_10',
    category: 'upgrades',
    nameKey: 'achievement.upgrade_level_10.name',
    descriptionKey: 'achievement.upgrade_level_10.description',
    bonusPercent: 10,
    isTemporary: false,
    condition: { type: 'single_desk_level', target: 10 },
  },
  {
    id: 'upgrade_level_20',
    category: 'upgrades',
    nameKey: 'achievement.upgrade_level_20.name',
    descriptionKey: 'achievement.upgrade_level_20.description',
    bonusPercent: 20,
    isTemporary: false,
    condition: { type: 'single_desk_level', target: 20 },
  },
  {
    id: 'upgrade_level_50',
    category: 'upgrades',
    nameKey: 'achievement.upgrade_level_50.name',
    descriptionKey: 'achievement.upgrade_level_50.description',
    bonusPercent: 50,
    isTemporary: false,
    condition: { type: 'single_desk_level', target: 50 },
  },
  // Total upgrade count milestones
  {
    id: 'total_upgrades_50',
    category: 'upgrades',
    nameKey: 'achievement.total_upgrades_50.name',
    descriptionKey: 'achievement.total_upgrades_50.description',
    bonusPercent: 3,
    isTemporary: false,
    condition: { type: 'total_upgrades', target: 50 },
  },
  {
    id: 'total_upgrades_200',
    category: 'upgrades',
    nameKey: 'achievement.total_upgrades_200.name',
    descriptionKey: 'achievement.total_upgrades_200.description',
    bonusPercent: 7,
    isTemporary: false,
    condition: { type: 'total_upgrades', target: 200 },
  },
  {
    id: 'total_upgrades_1000',
    category: 'upgrades',
    nameKey: 'achievement.total_upgrades_1000.name',
    descriptionKey: 'achievement.total_upgrades_1000.description',
    bonusPercent: 15,
    isTemporary: false,
    condition: { type: 'total_upgrades', target: 1000 },
  },
];

// ---------------------------------------------------------------------------
// Currency Generation — 5 achievements (Requirement 8.3)
// ---------------------------------------------------------------------------

const CURRENCY_GENERATION: AchievementDefinition[] = [
  {
    id: 'currency_1k',
    category: 'currency_generation',
    nameKey: 'achievement.currency_1k.name',
    descriptionKey: 'achievement.currency_1k.description',
    bonusPercent: 3,
    isTemporary: false,
    condition: { type: 'total_currency', target: 1_000 },
  },
  {
    id: 'currency_10k',
    category: 'currency_generation',
    nameKey: 'achievement.currency_10k.name',
    descriptionKey: 'achievement.currency_10k.description',
    bonusPercent: 7,
    isTemporary: false,
    condition: { type: 'total_currency', target: 10_000 },
  },
  {
    id: 'currency_100k',
    category: 'currency_generation',
    nameKey: 'achievement.currency_100k.name',
    descriptionKey: 'achievement.currency_100k.description',
    bonusPercent: 15,
    isTemporary: false,
    condition: { type: 'total_currency', target: 100_000 },
  },
  {
    id: 'currency_1m',
    category: 'currency_generation',
    nameKey: 'achievement.currency_1m.name',
    descriptionKey: 'achievement.currency_1m.description',
    bonusPercent: 30,
    isTemporary: false,
    condition: { type: 'total_currency', target: 1_000_000 },
  },
  {
    id: 'currency_10m',
    category: 'currency_generation',
    nameKey: 'achievement.currency_10m.name',
    descriptionKey: 'achievement.currency_10m.description',
    bonusPercent: 60,
    isTemporary: false,
    condition: { type: 'total_currency', target: 10_000_000 },
  },
];

// ---------------------------------------------------------------------------
// Play Time — 4 achievements (Requirement 8.4)
// ---------------------------------------------------------------------------

const PLAY_TIME: AchievementDefinition[] = [
  {
    id: 'playtime_1h',
    category: 'play_time',
    nameKey: 'achievement.playtime_1h.name',
    descriptionKey: 'achievement.playtime_1h.description',
    bonusPercent: 1,
    isTemporary: false,
    condition: { type: 'play_time_hours', target: 1 },
  },
  {
    id: 'playtime_5h',
    category: 'play_time',
    nameKey: 'achievement.playtime_5h.name',
    descriptionKey: 'achievement.playtime_5h.description',
    bonusPercent: 3,
    isTemporary: false,
    condition: { type: 'play_time_hours', target: 5 },
  },
  {
    id: 'playtime_24h',
    category: 'play_time',
    nameKey: 'achievement.playtime_24h.name',
    descriptionKey: 'achievement.playtime_24h.description',
    bonusPercent: 7,
    isTemporary: false,
    condition: { type: 'play_time_hours', target: 24 },
  },
  {
    id: 'playtime_100h',
    category: 'play_time',
    nameKey: 'achievement.playtime_100h.name',
    descriptionKey: 'achievement.playtime_100h.description',
    bonusPercent: 15,
    isTemporary: false,
    condition: { type: 'play_time_hours', target: 100 },
  },
];

// ---------------------------------------------------------------------------
// Special — 5 achievements (Requirement 8.5)
// ---------------------------------------------------------------------------

// "Balancer": all desks at the same level, min 10 desks — temporary +10% for 1 hour.
// 1 hour = 3600 real seconds. At 1 tick/s that is 3600 ticks; at 3 ticks/s it is
// 1200 ticks; at 5 ticks/s it is 720 ticks. We store the duration in ticks at the
// default 1-tick-per-second rate and let the Achievement Manager scale if needed.
// For simplicity we use 3600 ticks (1 hour at 1 tick/s).
const TICKS_PER_HOUR = 3600;

const SPECIAL: AchievementDefinition[] = [
  {
    id: 'special_balancer',
    category: 'special',
    nameKey: 'achievement.special_balancer.name',
    descriptionKey: 'achievement.special_balancer.description',
    bonusPercent: 10,
    isTemporary: true,
    durationTicks: TICKS_PER_HOUR,
    condition: { type: 'all_desks_same_level', minDesks: 10 },
  },
  {
    id: 'special_specialist',
    category: 'special',
    nameKey: 'achievement.special_specialist.name',
    descriptionKey: 'achievement.special_specialist.description',
    bonusPercent: 5,
    isTemporary: false,
    condition: { type: 'specialist', levelGap: 10 },
  },
  {
    id: 'special_equilibrium',
    category: 'special',
    nameKey: 'achievement.special_equilibrium.name',
    descriptionKey: 'achievement.special_equilibrium.description',
    bonusPercent: 8,
    isTemporary: false,
    condition: { type: 'equilibrium', minDesks: 10 },
  },
  {
    id: 'special_speed_start',
    category: 'special',
    nameKey: 'achievement.special_speed_start.name',
    descriptionKey: 'achievement.special_speed_start.description',
    bonusPercent: 15,
    isTemporary: false,
    // 10 desks within the first 30 minutes = 1800 ticks at 1 tick/s
    condition: { type: 'speed_start', desksTarget: 10, ticksLimit: 1800 },
  },
  {
    id: 'special_upgrader',
    category: 'special',
    nameKey: 'achievement.special_upgrader.name',
    descriptionKey: 'achievement.special_upgrader.description',
    bonusPercent: 12,
    isTemporary: false,
    condition: { type: 'all_desks_min_level', minLevel: 3, minDesks: 5 },
  },
];

// ---------------------------------------------------------------------------
// Exported flat list and lookup map
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  ...OFFICE_EXPANSION,
  ...UPGRADES,
  ...CURRENCY_GENERATION,
  ...PLAY_TIME,
  ...SPECIAL,
];

/** Quick O(1) lookup by achievement id. */
export const ACHIEVEMENT_MAP: ReadonlyMap<string, AchievementDefinition> = new Map(
  ACHIEVEMENT_DEFINITIONS.map(def => [def.id, def]),
);
