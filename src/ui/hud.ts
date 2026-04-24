// Game Screen HUD for Openspacemarin
// Requirements: 2.1, 2.4, 3.1, 3.5, 4.4, 4.5, 5.2, 7.4, 16.4, 20.1–20.5, 21.4
//
// Always-visible panel at the top of the game screen.
// Shows: currency (animated counter), generation/tick, desk count.
// Controls: Buy Desk, speed (1×/2×/4×), pause/resume, menu.

import type { GameState, IEventBus } from '../types/index.js';
import { localization } from '../systems/localization.js';
import { formatCurrency } from '../utils/formatting.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HUD_STYLES = `
.hud {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: rgba(13, 13, 26, 0.88);
  border-bottom: 1px solid #333355;
  font-family: 'Courier New', Courier, monospace;
  box-sizing: border-box;
  pointer-events: auto;
  flex-wrap: wrap;
  user-select: none;
}

/* ---- Resource group ---- */
.hud__resources {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.hud__stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}

.hud__stat-label {
  font-size: 0.55rem;
  color: #666688;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hud__stat-value {
  font-size: 0.9rem;
  color: #ffd700;
  font-weight: bold;
  letter-spacing: 0.05em;
  transition: color 0.15s ease-in-out;
  white-space: nowrap;
}

.hud__stat-value--flash {
  color: #ffffff;
}

/* ---- Controls group ---- */
.hud__controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

/* ---- Shared button base ---- */
.hud__btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.7rem;
  color: #ccccdd;
  background: rgba(13, 13, 26, 0.7);
  border: 1px solid #333355;
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: color 0.15s, border-color 0.15s, background 0.15s, transform 0.1s;
  white-space: nowrap;
}

.hud__btn:hover:not(:disabled) {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.hud__btn:active:not(:disabled) {
  transform: scale(0.97);
}

.hud__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ---- Buy Desk button ---- */
.hud__btn--buy {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.08);
}

.hud__btn--buy:hover:not(:disabled) {
  background: rgba(255, 215, 0, 0.18);
}

/* ---- Speed buttons ---- */
.hud__btn--speed.hud__btn--active {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.12);
}

/* ---- Pause button ---- */
.hud__btn--pause {
  min-width: 2rem;
  text-align: center;
}

/* ---- Separator ---- */
.hud__sep {
  width: 1px;
  height: 1.4rem;
  background: #333355;
  flex-shrink: 0;
}
`;

function injectHudStyles(): void {
  if (document.getElementById('hud-styles')) return;
  const style = document.createElement('style');
  style.id = 'hud-styles';
  style.textContent = HUD_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// HUD class
// ---------------------------------------------------------------------------

export class HUD {
  readonly element: HTMLDivElement;

  /** Called when the player clicks "Buy Desk". */
  onBuyDesk: () => void = () => undefined;

  /** Called when the player selects a speed. */
  onSpeedChange: (speed: 1 | 2 | 4) => void = () => undefined;

  /** Called when the player clicks the pause/resume button. */
  onPauseToggle: () => void = () => undefined;

  /** Called when the player clicks the menu button. */
  onMenuOpen: () => void = () => undefined;

  // DOM refs
  private currencyValue!: HTMLSpanElement;
  private genValue!: HTMLSpanElement;
  private deskValue!: HTMLSpanElement;
  private speedBtns!: Map<1 | 2 | 4, HTMLButtonElement>;
  private pauseBtn!: HTMLButtonElement;

  // Label DOM refs (for refreshLocalization)
  private currencyLabel!: HTMLSpanElement;
  private perTickLabel!: HTMLSpanElement;
  private desksLabel!: HTMLSpanElement;
  private buyBtn!: HTMLButtonElement;
  private menuBtn!: HTMLButtonElement;

  // Localization unsubscribe handle
  private unsubLocalization: (() => void) | null = null;

  // Animation state
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private displayedCurrency = 0;
  private animationFrameId: number | null = null;
  private targetCurrency = 0;

  // Event bus unsubscribe handle
  private unsubCurrencyChanged: (() => void) | null = null;

  /**
   * @param bus - Optional event bus. When provided, the HUD subscribes to
   *              `currency_changed` events to animate the counter automatically.
   */
  constructor(bus?: IEventBus) {
    injectHudStyles();
    this.element = this.buildDOM();

    if (bus) {
      this.unsubCurrencyChanged = bus.on('currency_changed', (e) => {
        this.animateCurrencyTo(e.newValue);
      });
    }

    this.unsubLocalization = localization.onChange(() => this.refreshLocalization());
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');
    root.className = 'hud';

    // ---- Resources ----
    const resources = document.createElement('div');
    resources.className = 'hud__resources';

    this.currencyValue = document.createElement('span');
    this.currencyValue.className = 'hud__stat-value';
    this.currencyValue.textContent = '0';

    this.genValue = document.createElement('span');
    this.genValue.className = 'hud__stat-value';
    this.genValue.textContent = '0/tick';

    this.deskValue = document.createElement('span');
    this.deskValue.className = 'hud__stat-value';
    this.deskValue.textContent = '0';

    const currencyStat = this.makeStat(localization.t('hud.currency'), this.currencyValue);
    this.currencyLabel = currencyStat.querySelector('.hud__stat-label') as HTMLSpanElement;
    const perTickStat = this.makeStat(localization.t('hud.per_tick'), this.genValue);
    this.perTickLabel = perTickStat.querySelector('.hud__stat-label') as HTMLSpanElement;
    const desksStat = this.makeStat(localization.t('hud.desks'), this.deskValue);
    this.desksLabel = desksStat.querySelector('.hud__stat-label') as HTMLSpanElement;
    resources.appendChild(currencyStat);
    resources.appendChild(perTickStat);
    resources.appendChild(desksStat);

    // ---- Controls ----
    const controls = document.createElement('div');
    controls.className = 'hud__controls';

    // Buy Desk
    const buyBtn = document.createElement('button');
    buyBtn.className = 'hud__btn hud__btn--buy';
    buyBtn.setAttribute('type', 'button');
    buyBtn.textContent = localization.t('hud.buy_desk');
    buyBtn.addEventListener('click', () => this.onBuyDesk());
    this.buyBtn = buyBtn;
    controls.appendChild(buyBtn);

    controls.appendChild(this.makeSep());

    // Speed buttons
    this.speedBtns = new Map();
    const speeds: Array<1 | 2 | 4> = [1, 2, 4];
    const speedKeys: Record<number, string> = {
      1: 'hud.speed_1x',
      2: 'hud.speed_2x',
      4: 'hud.speed_4x',
    };

    for (const speed of speeds) {
      const btn = document.createElement('button');
      btn.className = 'hud__btn hud__btn--speed';
      btn.setAttribute('type', 'button');
      btn.textContent = localization.t(speedKeys[speed]);
      btn.addEventListener('click', () => this.onSpeedChange(speed));
      this.speedBtns.set(speed, btn);
      controls.appendChild(btn);
    }

    // Mark 1x as active by default
    this.speedBtns.get(1)?.classList.add('hud__btn--active');

    controls.appendChild(this.makeSep());

    // Pause button
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'hud__btn hud__btn--pause';
    this.pauseBtn.setAttribute('type', 'button');
    this.pauseBtn.textContent = '⏸';
    this.pauseBtn.title = localization.t('hud.pause');
    this.pauseBtn.addEventListener('click', () => this.onPauseToggle());
    controls.appendChild(this.pauseBtn);

    // Menu button
    const menuBtn = document.createElement('button');
    menuBtn.className = 'hud__btn';
    menuBtn.setAttribute('type', 'button');
    menuBtn.textContent = localization.t('hud.menu');
    menuBtn.addEventListener('click', () => this.onMenuOpen());
    this.menuBtn = menuBtn;
    controls.appendChild(menuBtn);

    root.appendChild(resources);
    root.appendChild(controls);

    return root;
  }

  private makeStat(label: string, valueEl: HTMLSpanElement): HTMLDivElement {
    const stat = document.createElement('div');
    stat.className = 'hud__stat';

    const labelEl = document.createElement('span');
    labelEl.className = 'hud__stat-label';
    labelEl.textContent = label;

    stat.appendChild(labelEl);
    stat.appendChild(valueEl);
    return stat;
  }

  private makeSep(): HTMLDivElement {
    const sep = document.createElement('div');
    sep.className = 'hud__sep';
    return sep;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Updates all displayed values from the current game state.
   *
   * @param state             - Current game state snapshot
   * @param generationPerTick - Total currency generated per tick (pre-computed)
   */
  update(state: GameState, generationPerTick: number): void {
    // Currency — only update display if not currently animating
    if (this.animationFrameId === null) {
      this.displayedCurrency = state.currency;
      this.currencyValue.textContent = formatCurrency(state.currency);
    }

    // Generation per tick
    this.genValue.textContent = `${formatCurrency(generationPerTick)}${localization.t('hud.per_tick')}`;

    // Desk count
    this.deskValue.textContent = String(state.desks.length);
  }

  /**
   * Updates the active speed button highlight.
   */
  setSpeed(speed: 1 | 2 | 4): void {
    for (const [s, btn] of this.speedBtns) {
      btn.classList.toggle('hud__btn--active', s === speed);
    }
  }

  /**
   * Updates the pause button icon to reflect the current pause state.
   */
  setPaused(paused: boolean): void {
    this.pauseBtn.textContent = paused ? '▶' : '⏸';
    this.pauseBtn.title = paused
      ? localization.t('hud.resume')
      : localization.t('hud.pause');
  }

  /**
   * Removes event bus subscriptions. Call when tearing down the HUD.
   */
  destroy(): void {
    if (this.unsubCurrencyChanged) {
      this.unsubCurrencyChanged();
      this.unsubCurrencyChanged = null;
    }
    if (this.unsubLocalization) {
      this.unsubLocalization();
      this.unsubLocalization = null;
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
      this.flashTimer = null;
    }
  }

  /** Re-applies localization strings to all label DOM elements. */
  refreshLocalization(): void {
    if (this.currencyLabel) this.currencyLabel.textContent = localization.t('hud.currency');
    if (this.perTickLabel) this.perTickLabel.textContent = localization.t('hud.per_tick');
    if (this.desksLabel) this.desksLabel.textContent = localization.t('hud.desks');
    if (this.buyBtn) this.buyBtn.textContent = localization.t('hud.buy_desk');
    if (this.menuBtn) this.menuBtn.textContent = localization.t('hud.menu');
    if (this.pauseBtn) this.pauseBtn.title = localization.t('hud.pause');
    const speedKeys: Record<number, string> = {
      1: 'hud.speed_1x',
      2: 'hud.speed_2x',
      4: 'hud.speed_4x',
    };
    for (const [speed, btn] of this.speedBtns) {
      btn.textContent = localization.t(speedKeys[speed]);
    }
  }

  // ---------------------------------------------------------------------------
  // Currency animation
  // ---------------------------------------------------------------------------

  private animateCurrencyTo(target: number): void {
    this.targetCurrency = target;

    // Flash the value element
    this.flashCurrencyValue();

    // If already animating, just update the target
    if (this.animationFrameId !== null) return;

    const DURATION_MS = 400;
    const startValue = this.displayedCurrency;
    const startTime = performance.now();

    const step = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (this.targetCurrency - startValue) * eased;

      this.displayedCurrency = current;
      this.currencyValue.textContent = formatCurrency(current);

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.displayedCurrency = this.targetCurrency;
        this.currencyValue.textContent = formatCurrency(this.targetCurrency);
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  private flashCurrencyValue(): void {
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer);
      this.flashTimer = null;
    }
    this.currencyValue.classList.add('hud__stat-value--flash');
    this.flashTimer = setTimeout(() => {
      this.currencyValue.classList.remove('hud__stat-value--flash');
      this.flashTimer = null;
    }, 300);
  }
}
