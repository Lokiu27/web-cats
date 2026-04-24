// Statistics Screen for Openspacemarin
// Requirements: 15.1–15.4
//
// Shows cat employee list, recent achievements, and progress toward the
// next closest achievement.

import type {
  AchievementDefinition,
  AchievementProgress,
  GameState,
} from '../../types/index.js';
import { localization } from '../../systems/localization.js';
import { EconomyCalculator } from '../../systems/economy.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STATISTICS_SCREEN_STYLES = `
.screen--statistics {
  display: flex;
  flex-direction: column;
  background: #0d0d1a;
  overflow: hidden;
}

.statistics__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #333355;
  background: #0d0d1a;
}

.statistics__title {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1rem, 3vw, 1.4rem);
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-transform: uppercase;
  flex: 1;
}

.statistics__back-btn {
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

.statistics__back-btn:hover {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.statistics__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ---- Section ---- */
.statistics__section-title {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.7rem;
  font-weight: bold;
  color: #8888aa;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid #222244;
  padding-bottom: 0.25rem;
}

/* ---- Cat table ---- */
.statistics__cat-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.72rem;
}

.statistics__cat-table th {
  color: #666688;
  font-weight: normal;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: left;
  padding: 0.2rem 0.4rem;
  border-bottom: 1px solid #222244;
}

.statistics__cat-table td {
  color: #ccccdd;
  padding: 0.25rem 0.4rem;
  border-bottom: 1px solid #1a1a2e;
}

.statistics__cat-table tr:last-child td {
  border-bottom: none;
}

.statistics__cat-table td:first-child {
  color: #ffd700;
}

/* ---- Recent achievements list ---- */
.statistics__recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.statistics__recent-item {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.72rem;
  color: #ccccdd;
  padding: 0.2rem 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.statistics__recent-item::before {
  content: '★';
  color: #ffd700;
  font-size: 0.65rem;
  flex-shrink: 0;
}

.statistics__no-achievements {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.72rem;
  color: #444466;
  font-style: italic;
}

/* ---- Next achievement progress ---- */
.statistics__next-name {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.78rem;
  color: #ccccdd;
  margin-bottom: 0.4rem;
}

.statistics__next-progress-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.3rem;
}

.statistics__next-track {
  flex: 1;
  height: 6px;
  background: #1e1e3a;
  border-radius: 3px;
  overflow: hidden;
}

.statistics__next-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffd700, #ffaa00);
  border-radius: 3px;
  transition: width 0.3s ease-out;
}

.statistics__next-pct {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.65rem;
  color: #8888aa;
  white-space: nowrap;
  flex-shrink: 0;
}

.statistics__next-bonus {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.65rem;
  color: #44cc88;
  letter-spacing: 0.05em;
}
`;

function injectStatisticsStyles(): void {
  if (document.getElementById('statistics-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'statistics-screen-styles';
  style.textContent = STATISTICS_SCREEN_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// StatisticsScreen
// ---------------------------------------------------------------------------

const economy = new EconomyCalculator();

export class StatisticsScreen {
  readonly element: HTMLDivElement;

  /** Called when the player clicks the Back button. */
  onBack: () => void = () => undefined;

  private contentEl!: HTMLDivElement;

  // Label refs for refreshLocalization
  private titleEl!: HTMLDivElement;
  private backBtnEl!: HTMLButtonElement;

  // Localization unsubscribe handle
  private unsubLocalization: (() => void) | null = null;

  constructor() {
    injectStatisticsStyles();
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
    header.className = 'statistics__header';

    const backBtn = document.createElement('button');
    backBtn.className = 'statistics__back-btn';
    backBtn.setAttribute('type', 'button');
    backBtn.textContent = localization.t('ui.back');
    backBtn.addEventListener('click', () => this.onBack());
    this.backBtnEl = backBtn;

    const title = document.createElement('div');
    title.className = 'statistics__title';
    title.textContent = localization.t('statistics.title');
    this.titleEl = title;

    header.appendChild(backBtn);
    header.appendChild(title);

    // Content
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'statistics__content';

    root.appendChild(header);
    root.appendChild(this.contentEl);

    return root;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Refreshes the screen with the latest game state.
   * Requirements: 15.1–15.4
   */
  refresh(
    state: GameState,
    nextAchievement: AchievementProgress | null,
    definitions: AchievementDefinition[],
  ): void {
    this.contentEl.innerHTML = '';

    this.contentEl.appendChild(this.buildCatSection(state));
    this.contentEl.appendChild(this.buildRecentAchievementsSection(state, definitions));
    this.contentEl.appendChild(this.buildNextAchievementSection(nextAchievement));
  }

  /** Re-applies localization strings to all static label DOM elements. */
  refreshLocalization(): void {
    if (this.titleEl) this.titleEl.textContent = localization.t('statistics.title');
    if (this.backBtnEl) this.backBtnEl.textContent = localization.t('ui.back');
  }

  /** Cleans up localization subscription. */
  destroy(): void {
    if (this.unsubLocalization) {
      this.unsubLocalization();
      this.unsubLocalization = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Section builders
  // ---------------------------------------------------------------------------

  private buildCatSection(state: GameState): HTMLDivElement {
    const section = document.createElement('div');

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'statistics__section-title';
    sectionTitle.textContent = localization.t('statistics.cats_header');

    const table = document.createElement('table');
    table.className = 'statistics__cat-table';

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const thName = document.createElement('th');
    thName.textContent = localization.t('statistics.cat_name');
    const thLevel = document.createElement('th');
    thLevel.textContent = localization.t('statistics.cat_level');
    const thGen = document.createElement('th');
    thGen.textContent = localization.t('statistics.cat_generation');
    headerRow.appendChild(thName);
    headerRow.appendChild(thLevel);
    headerRow.appendChild(thGen);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    for (const desk of state.desks) {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = desk.cat.name;

      const tdLevel = document.createElement('td');
      tdLevel.textContent = String(desk.upgradeLevel);

      const tdGen = document.createElement('td');
      const gen = economy.getDeskGeneration(desk.upgradeLevel);
      tdGen.textContent = economy.formatCurrency(gen);

      tr.appendChild(tdName);
      tr.appendChild(tdLevel);
      tr.appendChild(tdGen);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    section.appendChild(sectionTitle);
    section.appendChild(table);
    return section;
  }

  private buildRecentAchievementsSection(
    state: GameState,
    definitions: AchievementDefinition[],
  ): HTMLDivElement {
    const section = document.createElement('div');

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'statistics__section-title';
    sectionTitle.textContent = localization.t('statistics.recent_achievements');

    const defMap = new Map(definitions.map(d => [d.id, d]));
    const recentIds = state.statistics.recentAchievements.slice(0, 10);

    if (recentIds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'statistics__no-achievements';
      empty.textContent = localization.t('statistics.no_achievements');
      section.appendChild(sectionTitle);
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement('ul');
    list.className = 'statistics__recent-list';

    for (const id of recentIds) {
      const def = defMap.get(id);
      const li = document.createElement('li');
      li.className = 'statistics__recent-item';
      li.textContent = def ? localization.t(def.nameKey) : id;
      list.appendChild(li);
    }

    section.appendChild(sectionTitle);
    section.appendChild(list);
    return section;
  }

  private buildNextAchievementSection(
    nextAchievement: AchievementProgress | null,
  ): HTMLDivElement {
    const section = document.createElement('div');

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'statistics__section-title';
    sectionTitle.textContent = localization.t('statistics.next_achievement');

    section.appendChild(sectionTitle);

    if (nextAchievement === null) {
      const empty = document.createElement('div');
      empty.className = 'statistics__no-achievements';
      empty.textContent = localization.t('statistics.no_achievements');
      section.appendChild(empty);
      return section;
    }

    const { definition: def, progressPercent } = nextAchievement;

    const name = document.createElement('div');
    name.className = 'statistics__next-name';
    name.textContent = localization.t('statistics.progress_to', {
      name: localization.t(def.nameKey),
    });

    const progressRow = document.createElement('div');
    progressRow.className = 'statistics__next-progress-row';

    const track = document.createElement('div');
    track.className = 'statistics__next-track';

    const fill = document.createElement('div');
    fill.className = 'statistics__next-fill';
    fill.style.width = `${progressPercent}%`;
    track.appendChild(fill);

    const pctLabel = document.createElement('span');
    pctLabel.className = 'statistics__next-pct';
    pctLabel.textContent = `${progressPercent}%`;

    progressRow.appendChild(track);
    progressRow.appendChild(pctLabel);

    const bonusEl = document.createElement('div');
    bonusEl.className = 'statistics__next-bonus';
    bonusEl.textContent = `+${def.bonusPercent}% ${localization.t('achievement.notification.bonus')}`;

    section.appendChild(name);
    section.appendChild(progressRow);
    section.appendChild(bonusEl);

    return section;
  }
}
