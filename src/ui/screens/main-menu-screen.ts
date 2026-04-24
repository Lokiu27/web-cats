// Main Menu Screen for Openspacemarin
// Requirements: 10.2, 10.5, 11.3, 11.5, 11.6
//
// Shown after the splash screen for returning players, or after the welcome
// screen for first-time players.
// Displays the game title, subtitle, and navigation buttons.
// The "Load Game" button is disabled when no save data exists.

import type { ScreenType } from '../../types/index.js';
import { saveSystem } from '../../systems/save-system.js';
import { localization } from '../../systems/localization.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MAIN_MENU_STYLES = `
.screen--main-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0d0d1a;
  padding: 10px 0;
}

.main-menu__title {
  font-family: 'Courier New', Courier, monospace;
  font-size: 1.6rem;
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-shadow:
    0 0 10px rgba(255, 215, 0, 0.6),
    0 0 20px rgba(255, 215, 0, 0.3);
  text-transform: uppercase;
  margin-bottom: 2px;
  text-align: center;
}

.main-menu__subtitle {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.65rem;
  color: #8888aa;
  letter-spacing: 0.2em;
  margin-bottom: 1.2rem;
  text-align: center;
  padding: 0 1rem;
}

.main-menu__buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  max-width: 260px;
}

.main-menu__btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.8rem;
  color: #ccccdd;
  background: #0d0d1a;
  border: 1px solid #333355;
  padding: 0.4rem 1.2rem;
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  width: 100%;
  text-align: center;
  border-radius: 2px;
  transition: color 0.2s, border-color 0.2s, transform 0.1s, background 0.2s;
  user-select: none;
}

.main-menu__btn:hover:not(:disabled) {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.05);
}

.main-menu__btn:active:not(:disabled) {
  transform: scale(0.97);
}

.main-menu__btn:disabled {
  color: #444466;
  border-color: #222244;
  cursor: not-allowed;
  opacity: 0.5;
}
`;

function injectMainMenuStyles(): void {
  if (document.getElementById('main-menu-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'main-menu-screen-styles';
  style.textContent = MAIN_MENU_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Button configuration
// ---------------------------------------------------------------------------

type MenuAction = 'new_game' | 'load_game';

interface ButtonConfig {
  labelKey: string;
  screen: ScreenType | null;
  action?: MenuAction;
  id: string;
}

const BUTTON_CONFIGS: ButtonConfig[] = [
  { id: 'new-game',     labelKey: 'menu.new_game',     screen: 'game',         action: 'new_game' },
  { id: 'load-game',    labelKey: 'menu.load_game',    screen: 'game',         action: 'load_game' },
  { id: 'achievements', labelKey: 'menu.achievements', screen: 'achievements' },
  { id: 'statistics',   labelKey: 'menu.statistics',   screen: 'statistics' },
  { id: 'settings',     labelKey: 'menu.settings',     screen: 'settings' },
  { id: 'help',         labelKey: 'menu.help',         screen: 'help' },
  { id: 'about',        labelKey: 'menu.about',        screen: 'about' },
];

// ---------------------------------------------------------------------------
// MainMenuScreen
// ---------------------------------------------------------------------------

export class MainMenuScreen {
  readonly element: HTMLDivElement;

  /**
   * Called when the player selects a navigation option.
   * The caller (e.g. the app bootstrap) handles the actual routing.
   *
   * @param screen - Target screen to navigate to
   * @param action - Optional action qualifier ('new_game' | 'load_game')
   */
  onNavigate: (screen: ScreenType, action?: MenuAction) => void = () => undefined;

  private loadGameBtn: HTMLButtonElement | null = null;

  // Label refs for refreshLocalization
  private subtitleEl!: HTMLDivElement;
  private menuBtns: HTMLButtonElement[] = [];

  // Localization unsubscribe handle
  private unsubLocalization: (() => void) | null = null;

  constructor() {
    injectMainMenuStyles();
    this.element = this.buildDOM();
    this.unsubLocalization = localization.onChange(() => this.refreshLocalization());
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');

    // Title
    const title = document.createElement('div');
    title.className = 'main-menu__title';
    title.textContent = 'OPENSPACEMARIN';

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.className = 'main-menu__subtitle';
    subtitle.textContent = localization.t('ui.slogan');
    this.subtitleEl = subtitle;

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'main-menu__buttons';

    for (const config of BUTTON_CONFIGS) {
      const btn = this.createButton(config);
      buttonsContainer.appendChild(btn);

      if (config.id === 'load-game') {
        this.loadGameBtn = btn;
      }
    }

    root.appendChild(title);
    root.appendChild(subtitle);
    root.appendChild(buttonsContainer);

    // Set initial disabled state for Load Game
    this.updateLoadGameState();

    return root;
  }

  private createButton(config: ButtonConfig): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'main-menu__btn';
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-menu-id', config.id);
    btn.textContent = localization.t(config.labelKey);

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (config.screen !== null) {
        this.onNavigate(config.screen, config.action);
      }
    });

    this.menuBtns.push(btn);
    return btn;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Refreshes the disabled state of the "Load Game" button based on whether
   * save data currently exists.
   *
   * Call this whenever the screen becomes visible (e.g. after returning from
   * the game screen where a save may have been created or deleted).
   *
   * Requirements: 10.2, 10.5
   */
  refresh(): void {
    this.updateLoadGameState();
  }

  /** Re-applies localization strings to all static label DOM elements. */
  refreshLocalization(): void {
    if (this.subtitleEl) this.subtitleEl.textContent = localization.t('ui.slogan');
    for (const btn of this.menuBtns) {
      const menuId = btn.getAttribute('data-menu-id');
      const config = BUTTON_CONFIGS.find(c => c.id === menuId);
      if (config) btn.textContent = localization.t(config.labelKey);
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

  private updateLoadGameState(): void {
    if (this.loadGameBtn === null) return;
    const hasSave = saveSystem.hasSaveData();
    this.loadGameBtn.disabled = !hasSave;
  }
}


