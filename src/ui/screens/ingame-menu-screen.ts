// In-Game Menu Screen for Openspacemarin
// Requirements: 10.2, 11.3, 11.5, 11.6
//
// A modal overlay panel that appears over the game screen.
// Opening the menu pauses the game (caller handles pause via onOpen callback).
// Provides: Continue, Save Game, Statistics, Settings, Main Menu.
// Clicking the semi-transparent backdrop closes the menu.

import type { ScreenType } from '../../types/index.js';
import { localization } from '../../systems/localization.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const INGAME_MENU_STYLES = `
.ingame-menu-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
  z-index: 100;
}

.ingame-menu-overlay.ingame-menu-overlay--visible {
  opacity: 1;
  pointer-events: auto;
}

.ingame-menu__panel {
  font-family: 'Courier New', Courier, monospace;
  background: #0d0d1a;
  border: 1px solid #333355;
  border-radius: 4px;
  padding: 2rem 1.5rem;
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  box-shadow:
    0 0 30px rgba(0, 0, 0, 0.8),
    0 0 60px rgba(0, 0, 0, 0.4);
  /* Prevent backdrop click from propagating through the panel */
  position: relative;
}

.ingame-menu__title {
  font-size: clamp(0.9rem, 3vw, 1.1rem);
  font-weight: bold;
  letter-spacing: 0.2em;
  color: #ffd700;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  text-align: center;
}

.ingame-menu__buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
}

.ingame-menu__btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(0.75rem, 2.5vw, 0.9rem);
  color: #ccccdd;
  background: #0d0d1a;
  border: 1px solid #333355;
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  width: 100%;
  text-align: center;
  border-radius: 2px;
  transition: color 0.2s, border-color 0.2s, transform 0.1s, background 0.2s;
  user-select: none;
}

.ingame-menu__btn:hover {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.05);
}

.ingame-menu__btn:active {
  transform: scale(0.97);
}

.ingame-menu__btn--continue {
  color: #ffd700;
  border-color: #ffd700;
}

.ingame-menu__btn--continue:hover {
  background: rgba(255, 215, 0, 0.1);
}

.ingame-menu__save-feedback {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  color: #44cc88;
  letter-spacing: 0.1em;
  text-align: center;
  height: 1.2em;
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}

.ingame-menu__save-feedback--visible {
  opacity: 1;
}
`;

function injectInGameMenuStyles(): void {
  if (document.getElementById('ingame-menu-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'ingame-menu-screen-styles';
  style.textContent = INGAME_MENU_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// InGameMenuScreen
// ---------------------------------------------------------------------------

export class InGameMenuScreen {
  /** The root overlay element. Register this with the container, not the router. */
  readonly element: HTMLDivElement;

  /**
   * Called when the player selects a navigation option or closes the menu.
   * Pass `'close'` to simply hide the menu and resume the game.
   */
  onNavigate: (screen: ScreenType | 'close') => void = () => undefined;

  /**
   * Called when the player clicks "Save Game".
   * The caller is responsible for performing the actual save operation.
   */
  onSave: () => void = () => undefined;

  private saveFeedback: HTMLDivElement | null = null;
  private saveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  // Button refs for refreshLocalization
  private continueBtn!: HTMLButtonElement;
  private saveBtn!: HTMLButtonElement;
  private statsBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private mainMenuBtn!: HTMLButtonElement;

  // Localization unsubscribe handle
  private unsubLocalization: (() => void) | null = null;

  constructor() {
    injectInGameMenuStyles();
    this.element = this.buildDOM();
    this.unsubLocalization = localization.onChange(() => this.refreshLocalization());
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    // Outer overlay (semi-transparent backdrop)
    const overlay = document.createElement('div');
    overlay.className = 'ingame-menu-overlay';

    // Clicking the backdrop (but not the panel) closes the menu
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.onNavigate('close');
      }
    });

    // Inner panel
    const panel = document.createElement('div');
    panel.className = 'ingame-menu__panel';

    // Panel title
    const title = document.createElement('div');
    title.className = 'ingame-menu__title';
    title.textContent = 'PAUSE';

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'ingame-menu__buttons';

    // Continue button
    const continueBtn = this.createButton(
      localization.t('ingame_menu.continue'),
      'ingame-menu__btn--continue',
      () => this.onNavigate('close'),
    );
    this.continueBtn = continueBtn;

    // Save Game button
    const saveBtn = this.createButton(
      localization.t('ingame_menu.save_game'),
      null,
      () => this.handleSave(),
    );
    this.saveBtn = saveBtn;

    // Save feedback message (shown briefly after saving)
    const saveFeedback = document.createElement('div');
    saveFeedback.className = 'ingame-menu__save-feedback';
    saveFeedback.textContent = localization.t('modal.save_confirm.title');
    this.saveFeedback = saveFeedback;

    // Statistics button
    const statsBtn = this.createButton(
      localization.t('ingame_menu.statistics'),
      null,
      () => this.onNavigate('statistics'),
    );
    this.statsBtn = statsBtn;

    // Settings button
    const settingsBtn = this.createButton(
      localization.t('ingame_menu.settings'),
      null,
      () => this.onNavigate('settings'),
    );
    this.settingsBtn = settingsBtn;

    // Main Menu button
    const mainMenuBtn = this.createButton(
      localization.t('ingame_menu.main_menu'),
      null,
      () => this.onNavigate('main_menu'),
    );
    this.mainMenuBtn = mainMenuBtn;

    buttonsContainer.appendChild(continueBtn);
    buttonsContainer.appendChild(saveBtn);
    buttonsContainer.appendChild(saveFeedback);
    buttonsContainer.appendChild(statsBtn);
    buttonsContainer.appendChild(settingsBtn);
    buttonsContainer.appendChild(mainMenuBtn);

    panel.appendChild(title);
    panel.appendChild(buttonsContainer);
    overlay.appendChild(panel);

    return overlay;
  }

  private createButton(
    label: string,
    extraClass: string | null,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'ingame-menu__btn';
    if (extraClass !== null) {
      btn.classList.add(extraClass);
    }
    btn.setAttribute('type', 'button');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Shows the in-game menu overlay. */
  show(): void {
    this.element.classList.add('ingame-menu-overlay--visible');
  }

  /** Hides the in-game menu overlay. */
  hide(): void {
    this.element.classList.remove('ingame-menu-overlay--visible');
    this.clearSaveFeedback();
  }

  /** Re-applies localization strings to all button DOM elements. */
  refreshLocalization(): void {
    if (this.continueBtn) this.continueBtn.textContent = localization.t('ingame_menu.continue');
    if (this.saveBtn) this.saveBtn.textContent = localization.t('ingame_menu.save_game');
    if (this.statsBtn) this.statsBtn.textContent = localization.t('ingame_menu.statistics');
    if (this.settingsBtn) this.settingsBtn.textContent = localization.t('ingame_menu.settings');
    if (this.mainMenuBtn) this.mainMenuBtn.textContent = localization.t('ingame_menu.main_menu');
  }

  /** Cleans up localization subscription. */
  destroy(): void {
    if (this.unsubLocalization) {
      this.unsubLocalization();
      this.unsubLocalization = null;
    }
    this.clearSaveFeedback();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private handleSave(): void {
    this.onSave();
    this.showSaveFeedback();
  }

  private showSaveFeedback(): void {
    if (this.saveFeedback === null) return;

    // Clear any existing timer
    this.clearSaveFeedback();

    this.saveFeedback.classList.add('ingame-menu__save-feedback--visible');

    // Hide the feedback after 2 seconds
    this.saveFeedbackTimer = setTimeout(() => {
      this.clearSaveFeedback();
    }, 2000);
  }

  private clearSaveFeedback(): void {
    if (this.saveFeedbackTimer !== null) {
      clearTimeout(this.saveFeedbackTimer);
      this.saveFeedbackTimer = null;
    }
    if (this.saveFeedback !== null) {
      this.saveFeedback.classList.remove('ingame-menu__save-feedback--visible');
    }
  }
}
