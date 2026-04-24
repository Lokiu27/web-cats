// Achievements Screen for Openspacemarin
// Requirements: 12.1–12.5
//
// Displays all achievements grouped by category with progress bars,
// locked/unlocked styling, and an "Unlocked: X/Y" counter.

import type {
  AchievementCategory,
  AchievementDefinition,
  AchievementState,
  GameState,
} from '../../types/index.js';
import { localization } from '../../systems/localization.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ACHIEVEMENTS_SCREEN_STYLES = `
.screen--achievements {
  display: flex;
  flex-direction: column;
  background: #0d0d1a;
  overflow: hidden;
}

.achievements__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #333355;
  background: #0d0d1a;
}

.achievements__title {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1rem, 3vw, 1.4rem);
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-transform: uppercase;
  flex: 1;
}

.achievements__counter {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.8rem;
  color: #8888aa;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.achievements__back-btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  color: #ccccdd;
  background: #0d0d1a;
  border: 1px solid #333355;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.achievements__back-btn:hover {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

/* ---- Tabs ---- */
.achievements__tabs {
  flex-shrink: 0;
  display: flex;
  gap: 0;
  border-bottom: 1px solid #333355;
  overflow-x: auto;
  scrollbar-width: none;
}

.achievements__tabs::-webkit-scrollbar {
  display: none;
}

.achievements__tab {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.65rem;
  color: #666688;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.achievements__tab:hover {
  color: #aaaacc;
}

.achievements__tab--active {
  color: #ffd700;
  border-bottom-color: #ffd700;
}

/* ---- Content area ---- */
.achievements__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* ---- Achievement card ---- */
.achievement-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid #222244;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.02);
  transition: border-color 0.15s;
}

.achievement-card--unlocked {
  border-color: rgba(255, 215, 0, 0.3);
  background: rgba(255, 215, 0, 0.04);
}

.achievement-card--locked {
  opacity: 0.4;
}

.achievement-card__icon {
  font-size: 1.2rem;
  line-height: 1;
  flex-shrink: 0;
  width: 1.5rem;
  text-align: center;
  margin-top: 0.1rem;
}

.achievement-card__body {
  flex: 1;
  min-width: 0;
}

.achievement-card__name {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.8rem;
  font-weight: bold;
  color: #ccccdd;
  letter-spacing: 0.05em;
  margin-bottom: 0.15rem;
}

.achievement-card--unlocked .achievement-card__name {
  color: #ffd700;
}

.achievement-card__desc {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.65rem;
  color: #666688;
  letter-spacing: 0.03em;
  margin-bottom: 0.35rem;
  line-height: 1.4;
}

.achievement-card__progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.achievement-card__progress-track {
  flex: 1;
  height: 4px;
  background: #1e1e3a;
  border-radius: 2px;
  overflow: hidden;
}

.achievement-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffd700, #ffaa00);
  border-radius: 2px;
  transition: width 0.3s ease-out;
}

.achievement-card__progress-label {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.6rem;
  color: #666688;
  white-space: nowrap;
  flex-shrink: 0;
}

.achievement-card__bonus {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.65rem;
  color: #44cc88;
  letter-spacing: 0.05em;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.achievement-card--unlocked .achievement-card__bonus {
  color: #ffd700;
}
`;

function injectAchievementsStyles(): void {
  if (document.getElementById('achievements-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'achievements-screen-styles';
  style.textContent = ACHIEVEMENTS_SCREEN_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Category tab configuration
// ---------------------------------------------------------------------------

interface TabConfig {
  category: AchievementCategory;
  labelKey: string;
}

const TABS: TabConfig[] = [
  { category: 'office_expansion',   labelKey: 'achievements.tab.office_expansion' },
  { category: 'upgrades',           labelKey: 'achievements.tab.upgrades' },
  { category: 'currency_generation', labelKey: 'achievements.tab.currency_generation' },
  { category: 'play_time',          labelKey: 'achievements.tab.play_time' },
  { category: 'special',            labelKey: 'achievements.tab.special' },
];

// ---------------------------------------------------------------------------
// AchievementsScreen
// ---------------------------------------------------------------------------

export class AchievementsScreen {
  readonly element: HTMLDivElement;

  /** Called when the player clicks the Back button. */
  onBack: () => void = () => undefined;

  private counterEl!: HTMLSpanElement;
  private tabButtons!: Map<AchievementCategory, HTMLButtonElement>;
  private contentEl!: HTMLDivElement;
  private activeCategory: AchievementCategory = 'office_expansion';

  // Label refs for refreshLocalization
  private titleEl!: HTMLDivElement;
  private backBtnEl!: HTMLButtonElement;

  // Localization unsubscribe handle
  private unsubLocalization: (() => void) | null = null;

  // Cached data for tab switching without re-render
  private cachedDefinitions: AchievementDefinition[] = [];
  private cachedStates: AchievementState[] = [];

  constructor() {
    injectAchievementsStyles();
    this.element = this.buildDOM();
    this.unsubLocalization = localization.onChange(() => this.refreshLocalization());
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');

    // Header
    const header = document.createElement('div');
    header.className = 'achievements__header';

    const backBtn = document.createElement('button');
    backBtn.className = 'achievements__back-btn';
    backBtn.setAttribute('type', 'button');
    backBtn.textContent = localization.t('ui.back');
    backBtn.addEventListener('click', () => this.onBack());
    this.backBtnEl = backBtn;

    const title = document.createElement('div');
    title.className = 'achievements__title';
    title.textContent = localization.t('achievements.title');
    this.titleEl = title;

    this.counterEl = document.createElement('span');
    this.counterEl.className = 'achievements__counter';
    this.counterEl.textContent = '';

    header.appendChild(backBtn);
    header.appendChild(title);
    header.appendChild(this.counterEl);

    // Tabs
    const tabsEl = document.createElement('div');
    tabsEl.className = 'achievements__tabs';

    this.tabButtons = new Map();
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.className = 'achievements__tab';
      btn.setAttribute('type', 'button');
      btn.textContent = localization.t(tab.labelKey);
      btn.addEventListener('click', () => this.switchTab(tab.category));
      this.tabButtons.set(tab.category, btn);
      tabsEl.appendChild(btn);
    }

    // Content
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'achievements__content';

    root.appendChild(header);
    root.appendChild(tabsEl);
    root.appendChild(this.contentEl);

    // Activate first tab
    this.setActiveTab('office_expansion');

    return root;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Refreshes the screen with the latest game state and achievement data.
   * Requirements: 12.1–12.5
   */
  refresh(
    _state: GameState,
    definitions: AchievementDefinition[],
    achievementStates: AchievementState[],
  ): void {
    this.cachedDefinitions = definitions;
    this.cachedStates = achievementStates;

    // Update unlocked counter
    const unlockedCount = achievementStates.filter(s => s.unlocked).length;
    const totalCount = definitions.length;
    this.counterEl.textContent = localization.t('achievements.unlocked_count', {
      unlocked: unlockedCount,
      total: totalCount,
    });

    // Re-render current tab
    this.renderTab(this.activeCategory);
  }

  /** Re-applies localization strings to all static label DOM elements. */
  refreshLocalization(): void {
    if (this.titleEl) this.titleEl.textContent = localization.t('achievements.title');
    if (this.backBtnEl) this.backBtnEl.textContent = localization.t('ui.back');
    for (const [category, btn] of this.tabButtons) {
      const tab = TABS.find(t => t.category === category);
      if (tab) btn.textContent = localization.t(tab.labelKey);
    }
  }

  /** Cleans up localization subscription. */
  destroy(): void {
    if (this.unsubLocalization) {
      this.unsubLocalization();
      this.unsubLocalization = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private switchTab(category: AchievementCategory): void {
    this.activeCategory = category;
    this.setActiveTab(category);
    this.renderTab(category);
  }

  private setActiveTab(category: AchievementCategory): void {
    for (const [cat, btn] of this.tabButtons) {
      btn.classList.toggle('achievements__tab--active', cat === category);
    }
  }

  private renderTab(category: AchievementCategory): void {
    this.contentEl.innerHTML = '';

    const stateMap = new Map(this.cachedStates.map(s => [s.id, s]));
    const defs = this.cachedDefinitions.filter(d => d.category === category);

    for (const def of defs) {
      const state = stateMap.get(def.id) ?? { id: def.id, unlocked: false, progress: 0 };
      const card = this.buildCard(def, state);
      this.contentEl.appendChild(card);
    }
  }

  private buildCard(def: AchievementDefinition, state: AchievementState): HTMLDivElement {
    const card = document.createElement('div');
    card.className = state.unlocked
      ? 'achievement-card achievement-card--unlocked'
      : 'achievement-card achievement-card--locked';

    // Icon
    const icon = document.createElement('div');
    icon.className = 'achievement-card__icon';
    icon.textContent = state.unlocked ? '★' : '🔒';

    // Body
    const body = document.createElement('div');
    body.className = 'achievement-card__body';

    const name = document.createElement('div');
    name.className = 'achievement-card__name';
    name.textContent = localization.t(def.nameKey);

    const desc = document.createElement('div');
    desc.className = 'achievement-card__desc';
    desc.textContent = localization.t(def.descriptionKey);

    // Progress row
    const progressRow = document.createElement('div');
    progressRow.className = 'achievement-card__progress-row';

    const track = document.createElement('div');
    track.className = 'achievement-card__progress-track';

    const fill = document.createElement('div');
    fill.className = 'achievement-card__progress-fill';

    const { current, target } = this.getProgressValues(def, state);
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    fill.style.width = `${pct}%`;
    track.appendChild(fill);

    const progressLabel = document.createElement('span');
    progressLabel.className = 'achievement-card__progress-label';
    progressLabel.textContent = state.unlocked
      ? localization.t('achievements.unlocked')
      : localization.t('achievements.progress', {
          current: Math.floor(current),
          target,
        });

    progressRow.appendChild(track);
    progressRow.appendChild(progressLabel);

    // Bonus
    const bonus = document.createElement('div');
    bonus.className = 'achievement-card__bonus';
    const bonusText = localization.t('achievements.bonus', { percent: def.bonusPercent });
    bonus.textContent = def.isTemporary
      ? `${bonusText} (${localization.t('achievements.temporary', { hours: 1 })})`
      : bonusText;

    body.appendChild(name);
    body.appendChild(desc);
    body.appendChild(progressRow);

    card.appendChild(icon);
    card.appendChild(body);
    card.appendChild(bonus);

    return card;
  }

  private getProgressValues(
    def: AchievementDefinition,
    state: AchievementState,
  ): { current: number; target: number } {
    const cond = def.condition;
    let target = 0;

    switch (cond.type) {
      case 'desk_count':           target = cond.target; break;
      case 'single_desk_level':    target = cond.target; break;
      case 'total_upgrades':       target = cond.target; break;
      case 'total_currency':       target = cond.target; break;
      case 'play_time_hours':      target = cond.target; break;
      case 'all_desks_same_level': target = cond.minDesks; break;
      case 'specialist':           target = cond.levelGap; break;
      case 'equilibrium':          target = cond.minDesks; break;
      case 'speed_start':          target = cond.desksTarget; break;
      case 'all_desks_min_level':  target = cond.minDesks; break;
    }

    const current = state.unlocked ? target : (state.progress ?? 0);
    return { current, target };
  }
}
