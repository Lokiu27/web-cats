// Settings Screen for Openspacemarin
// Requirements: 13.1–13.5, 19.1–19.4
//
// Language selector, music/SFX volume sliders, and default speed toggle.

import type { GameSettings } from '../../types/index.js';
import { localization } from '../../systems/localization.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SETTINGS_SCREEN_STYLES = `
.screen--settings {
  display: flex;
  flex-direction: column;
  background: #0d0d1a;
  overflow: hidden;
}

.settings__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #333355;
  background: #0d0d1a;
}

.settings__title {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1rem, 3vw, 1.4rem);
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-transform: uppercase;
  flex: 1;
}

.settings__back-btn {
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

.settings__back-btn:hover {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.settings__content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 480px;
}

/* ---- Row ---- */
.settings__row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings__label {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.7rem;
  color: #8888aa;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* ---- Toggle group (language / speed) ---- */
.settings__toggle-group {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.settings__toggle-btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  color: #ccccdd;
  background: #0d0d1a;
  border: 1px solid #333355;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  user-select: none;
}

.settings__toggle-btn:hover {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.settings__toggle-btn--active {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.12);
}

/* ---- Slider row ---- */
.settings__slider-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.settings__slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: #1e1e3a;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.settings__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffd700;
  cursor: pointer;
  border: 2px solid #0d0d1a;
  box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
}

.settings__slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffd700;
  cursor: pointer;
  border: 2px solid #0d0d1a;
  box-shadow: 0 0 4px rgba(255, 215, 0, 0.5);
}

.settings__slider-value {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.8rem;
  color: #ffd700;
  min-width: 1.5rem;
  text-align: right;
  flex-shrink: 0;
}
`;

function injectSettingsStyles(): void {
  if (document.getElementById('settings-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'settings-screen-styles';
  style.textContent = SETTINGS_SCREEN_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// SettingsScreen
// ---------------------------------------------------------------------------

export class SettingsScreen {
  readonly element: HTMLDivElement;

  /** Called when the player clicks the Back button. */
  onBack: () => void = () => undefined;

  /** Called whenever a setting changes. */
  onSettingsChange: (settings: Partial<GameSettings>) => void = () => undefined;

  // DOM refs for updating active states
  private langBtns!: Map<'en' | 'ru', HTMLButtonElement>;
  private speedBtns!: Map<1 | 2 | 4, HTMLButtonElement>;
  private musicSlider!: HTMLInputElement;
  private musicValueEl!: HTMLSpanElement;
  private sfxSlider!: HTMLInputElement;
  private sfxValueEl!: HTMLSpanElement;

  constructor() {
    injectSettingsStyles();
    this.element = this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');

    // Header
    const header = document.createElement('div');
    header.className = 'settings__header';

    const backBtn = document.createElement('button');
    backBtn.className = 'settings__back-btn';
    backBtn.setAttribute('type', 'button');
    backBtn.textContent = localization.t('ui.back');
    backBtn.addEventListener('click', () => this.onBack());

    const title = document.createElement('div');
    title.className = 'settings__title';
    title.textContent = localization.t('settings.title');

    header.appendChild(backBtn);
    header.appendChild(title);

    // Content
    const content = document.createElement('div');
    content.className = 'settings__content';

    content.appendChild(this.buildLanguageRow());
    content.appendChild(this.buildMusicRow());
    content.appendChild(this.buildSfxRow());
    content.appendChild(this.buildSpeedRow());

    root.appendChild(header);
    root.appendChild(content);

    return root;
  }

  private buildLanguageRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'settings__row';

    const label = document.createElement('div');
    label.className = 'settings__label';
    label.textContent = localization.t('settings.language');

    const group = document.createElement('div');
    group.className = 'settings__toggle-group';

    this.langBtns = new Map();

    const langs: Array<{ value: 'en' | 'ru'; labelKey: string }> = [
      { value: 'en', labelKey: 'settings.language_en' },
      { value: 'ru', labelKey: 'settings.language_ru' },
    ];

    for (const { value, labelKey } of langs) {
      const btn = document.createElement('button');
      btn.className = 'settings__toggle-btn';
      btn.setAttribute('type', 'button');
      btn.textContent = localization.t(labelKey);
      btn.addEventListener('click', () => {
        this.setActiveLang(value);
        this.onSettingsChange({ language: value });
      });
      this.langBtns.set(value, btn);
      group.appendChild(btn);
    }

    row.appendChild(label);
    row.appendChild(group);
    return row;
  }

  private buildMusicRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'settings__row';

    const label = document.createElement('div');
    label.className = 'settings__label';
    label.textContent = localization.t('settings.music_volume');

    const sliderRow = document.createElement('div');
    sliderRow.className = 'settings__slider-row';

    this.musicSlider = document.createElement('input');
    this.musicSlider.type = 'range';
    this.musicSlider.className = 'settings__slider';
    this.musicSlider.min = '0';
    this.musicSlider.max = '10';
    this.musicSlider.step = '1';
    this.musicSlider.value = '5';

    this.musicValueEl = document.createElement('span');
    this.musicValueEl.className = 'settings__slider-value';
    this.musicValueEl.textContent = '5';

    this.musicSlider.addEventListener('input', () => {
      const val = Number(this.musicSlider.value);
      this.musicValueEl.textContent = String(val);
      this.onSettingsChange({ musicVolume: val });
    });

    sliderRow.appendChild(this.musicSlider);
    sliderRow.appendChild(this.musicValueEl);

    row.appendChild(label);
    row.appendChild(sliderRow);
    return row;
  }

  private buildSfxRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'settings__row';

    const label = document.createElement('div');
    label.className = 'settings__label';
    label.textContent = localization.t('settings.sfx_volume');

    const sliderRow = document.createElement('div');
    sliderRow.className = 'settings__slider-row';

    this.sfxSlider = document.createElement('input');
    this.sfxSlider.type = 'range';
    this.sfxSlider.className = 'settings__slider';
    this.sfxSlider.min = '0';
    this.sfxSlider.max = '10';
    this.sfxSlider.step = '1';
    this.sfxSlider.value = '5';

    this.sfxValueEl = document.createElement('span');
    this.sfxValueEl.className = 'settings__slider-value';
    this.sfxValueEl.textContent = '5';

    this.sfxSlider.addEventListener('input', () => {
      const val = Number(this.sfxSlider.value);
      this.sfxValueEl.textContent = String(val);
      this.onSettingsChange({ sfxVolume: val });
    });

    sliderRow.appendChild(this.sfxSlider);
    sliderRow.appendChild(this.sfxValueEl);

    row.appendChild(label);
    row.appendChild(sliderRow);
    return row;
  }

  private buildSpeedRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'settings__row';

    const label = document.createElement('div');
    label.className = 'settings__label';
    label.textContent = localization.t('settings.default_speed');

    const group = document.createElement('div');
    group.className = 'settings__toggle-group';

    this.speedBtns = new Map();

    const speeds: Array<{ value: 1 | 2 | 4; label: string }> = [
      { value: 1, label: localization.t('hud.speed_1x') },
      { value: 2, label: localization.t('hud.speed_2x') },
      { value: 4, label: localization.t('hud.speed_4x') },
    ];

    for (const { value, label: btnLabel } of speeds) {
      const btn = document.createElement('button');
      btn.className = 'settings__toggle-btn';
      btn.setAttribute('type', 'button');
      btn.textContent = btnLabel;
      btn.addEventListener('click', () => {
        this.setActiveSpeed(value);
        this.onSettingsChange({ defaultSpeed: value });
      });
      this.speedBtns.set(value, btn);
      group.appendChild(btn);
    }

    row.appendChild(label);
    row.appendChild(group);
    return row;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Refreshes the screen to reflect the given settings.
   * Requirements: 13.1–13.5, 19.1–19.4
   */
  refresh(settings: GameSettings): void {
    this.setActiveLang(settings.language);
    this.setActiveSpeed(settings.defaultSpeed);

    this.musicSlider.value = String(settings.musicVolume);
    this.musicValueEl.textContent = String(settings.musicVolume);

    this.sfxSlider.value = String(settings.sfxVolume);
    this.sfxValueEl.textContent = String(settings.sfxVolume);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private setActiveLang(lang: 'en' | 'ru'): void {
    for (const [l, btn] of this.langBtns) {
      btn.classList.toggle('settings__toggle-btn--active', l === lang);
    }
  }

  private setActiveSpeed(speed: 1 | 2 | 4): void {
    for (const [s, btn] of this.speedBtns) {
      btn.classList.toggle('settings__toggle-btn--active', s === speed);
    }
  }
}
