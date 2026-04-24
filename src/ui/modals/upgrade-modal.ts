// Upgrade Modal for Openspacemarin
// Requirements: 3.1, 3.5, 4.4, 4.5, 20.1–20.5
//
// Modal dialog for upgrading a desk.
// Shows desk/cat name, current level, generation, upgrade cost, and the
// generation increase after upgrading.
// Darkened overlay, click-outside-to-close, CSS scale+opacity transition.

import type { Desk } from '../../types/index.js';
import { localization } from '../../systems/localization.js';
import { formatCurrency } from '../../utils/formatting.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const UPGRADE_MODAL_STYLES = `
.upgrade-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
  z-index: 200;
}

.upgrade-modal-overlay.upgrade-modal-overlay--visible {
  opacity: 1;
  pointer-events: auto;
}

.upgrade-modal__panel {
  font-family: 'Courier New', Courier, monospace;
  background: #0d0d1a;
  border: 1px solid #ffd700;
  border-radius: 4px;
  padding: 1.75rem 1.5rem;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow:
    0 0 30px rgba(0, 0, 0, 0.9),
    0 0 20px rgba(255, 215, 0, 0.08);
  transform: scale(0.88);
  opacity: 0;
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

.upgrade-modal-overlay--visible .upgrade-modal__panel {
  transform: scale(1);
  opacity: 1;
}

.upgrade-modal__title {
  font-size: 1rem;
  font-weight: bold;
  letter-spacing: 0.18em;
  color: #ffd700;
  text-transform: uppercase;
  text-align: center;
}

.upgrade-modal__desk-name {
  font-size: 0.85rem;
  color: #aaaacc;
  text-align: center;
  letter-spacing: 0.08em;
}

.upgrade-modal__rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upgrade-modal__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  color: #ccccdd;
  letter-spacing: 0.06em;
}

.upgrade-modal__row-label {
  color: #888899;
}

.upgrade-modal__row-value {
  color: #ffd700;
  font-weight: bold;
}

.upgrade-modal__row-value--insufficient {
  color: #ff6666;
}

.upgrade-modal__row-value--increase {
  color: #44cc88;
}

.upgrade-modal__divider {
  height: 1px;
  background: #222244;
  margin: 0.25rem 0;
}

.upgrade-modal__warning {
  font-size: 0.72rem;
  color: #ff6666;
  text-align: center;
  letter-spacing: 0.08em;
  min-height: 1em;
}

.upgrade-modal__actions {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
}

.upgrade-modal__btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.8rem;
  color: #ccccdd;
  background: #0d0d1a;
  border: 1px solid #333355;
  padding: 0.55rem 1.25rem;
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: color 0.15s, border-color 0.15s, background 0.15s, transform 0.1s;
  flex: 1;
}

.upgrade-modal__btn:hover:not(:disabled) {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.upgrade-modal__btn:active:not(:disabled) {
  transform: scale(0.97);
}

.upgrade-modal__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.upgrade-modal__btn--upgrade {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.08);
}

.upgrade-modal__btn--upgrade:hover:not(:disabled) {
  background: rgba(255, 215, 0, 0.18);
}
`;

function injectUpgradeModalStyles(): void {
  if (document.getElementById('upgrade-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'upgrade-modal-styles';
  style.textContent = UPGRADE_MODAL_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// UpgradeModal class
// ---------------------------------------------------------------------------

export class UpgradeModal {
  readonly element: HTMLDivElement;

  /** Called when the player confirms the upgrade. Receives the desk ID. */
  onUpgrade: (deskId: string) => void = () => undefined;

  /** Called when the player closes the modal. */
  onClose: () => void = () => undefined;

  // DOM refs
  private deskNameEl!: HTMLDivElement;
  private levelValueEl!: HTMLSpanElement;
  private genValueEl!: HTMLSpanElement;
  private costValueEl!: HTMLSpanElement;
  private increaseValueEl!: HTMLSpanElement;
  private balanceValueEl!: HTMLSpanElement;
  private warningEl!: HTMLDivElement;
  private upgradeBtn!: HTMLButtonElement;

  // State
  private currentDeskId = '';
  private currentCost = 0;
  private currentBalance = 0;

  constructor() {
    injectUpgradeModalStyles();
    this.element = this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'upgrade-modal-overlay';

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.onClose();
    });

    const panel = document.createElement('div');
    panel.className = 'upgrade-modal__panel';
    this._buildPanelContent(panel);

    overlay.appendChild(panel);
    return overlay;
  }

  private _buildPanelContent(panel: HTMLDivElement): void {
    // Title
    const title = document.createElement('div');
    title.className = 'upgrade-modal__title';
    title.textContent = localization.t('modal.upgrade.title');

    // Desk / cat name
    this.deskNameEl = document.createElement('div');
    this.deskNameEl.className = 'upgrade-modal__desk-name';

    // Rows
    const rows = document.createElement('div');
    rows.className = 'upgrade-modal__rows';

    this.levelValueEl = document.createElement('span');
    this.levelValueEl.className = 'upgrade-modal__row-value';

    this.genValueEl = document.createElement('span');
    this.genValueEl.className = 'upgrade-modal__row-value';

    this.costValueEl = document.createElement('span');
    this.costValueEl.className = 'upgrade-modal__row-value';

    this.increaseValueEl = document.createElement('span');
    this.increaseValueEl.className = 'upgrade-modal__row-value upgrade-modal__row-value--increase';

    this.balanceValueEl = document.createElement('span');
    this.balanceValueEl.className = 'upgrade-modal__row-value';

    rows.appendChild(this.makeRow(localization.t('modal.upgrade.level'), this.levelValueEl));
    rows.appendChild(this.makeRow(localization.t('modal.upgrade.generation'), this.genValueEl));

    const divider = document.createElement('div');
    divider.className = 'upgrade-modal__divider';
    rows.appendChild(divider);

    rows.appendChild(this.makeRow(localization.t('modal.upgrade.cost'), this.costValueEl));
    rows.appendChild(this.makeRow(localization.t('modal.upgrade.increase'), this.increaseValueEl));
    rows.appendChild(this.makeRow(localization.t('modal.purchase.balance'), this.balanceValueEl));

    // Warning
    this.warningEl = document.createElement('div');
    this.warningEl.className = 'upgrade-modal__warning';

    // Actions
    const actions = document.createElement('div');
    actions.className = 'upgrade-modal__actions';

    this.upgradeBtn = document.createElement('button');
    this.upgradeBtn.className = 'upgrade-modal__btn upgrade-modal__btn--upgrade';
    this.upgradeBtn.setAttribute('type', 'button');
    this.upgradeBtn.textContent = localization.t('modal.upgrade.upgrade');
    this.upgradeBtn.addEventListener('click', () => {
      if (!this.upgradeBtn.disabled) this.onUpgrade(this.currentDeskId);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'upgrade-modal__btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.textContent = localization.t('modal.upgrade.close');
    closeBtn.addEventListener('click', () => this.onClose());

    actions.appendChild(this.upgradeBtn);
    actions.appendChild(closeBtn);

    panel.appendChild(title);
    panel.appendChild(this.deskNameEl);
    panel.appendChild(rows);
    panel.appendChild(this.warningEl);
    panel.appendChild(actions);
  }

  private makeRow(label: string, valueEl: HTMLSpanElement): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'upgrade-modal__row';

    const labelEl = document.createElement('span');
    labelEl.className = 'upgrade-modal__row-label';
    labelEl.textContent = label;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Opens the modal with the given desk data.
   *
   * @param desk       - The desk being upgraded
   * @param cost       - Cost to upgrade
   * @param balance    - Player's current currency
   * @param currentGen - Current generation per tick for this desk
   * @param newGen     - Generation per tick after upgrade
   */
  show(desk: Desk, cost: number, balance: number, currentGen: number, newGen: number): void {
    this.currentDeskId = desk.id;
    this.currentCost = cost;
    this.currentBalance = balance;

    // Rebuild panel content with current language
    const panel = this.element.querySelector('.upgrade-modal__panel') as HTMLDivElement;
    if (panel) {
      panel.innerHTML = '';
      this._buildPanelContent(panel);
    }

    // Desk / cat name
    this.deskNameEl.textContent = desk.cat.name;

    // Static values
    this.levelValueEl.textContent = String(desk.upgradeLevel);
    this.genValueEl.textContent = `${formatCurrency(currentGen)}${localization.t('hud.per_tick')}`;
    this.costValueEl.textContent = formatCurrency(cost);
    this.increaseValueEl.textContent = `+${formatCurrency(newGen - currentGen)}${localization.t('hud.per_tick')}`;

    this.refreshBalance();
    this.element.classList.add('upgrade-modal-overlay--visible');
  }

  /**
   * Closes the modal.
   */
  hide(): void {
    this.element.classList.remove('upgrade-modal-overlay--visible');
  }

  /**
   * Updates the displayed balance and refreshes the button state.
   */
  updateBalance(balance: number): void {
    this.currentBalance = balance;
    this.refreshBalance();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private refreshBalance(): void {
    const canAfford = this.currentBalance >= this.currentCost;

    this.balanceValueEl.textContent = formatCurrency(this.currentBalance);
    this.balanceValueEl.classList.toggle(
      'upgrade-modal__row-value--insufficient',
      !canAfford,
    );

    this.warningEl.textContent = canAfford
      ? ''
      : localization.t('modal.upgrade.insufficient');

    this.upgradeBtn.disabled = !canAfford;
  }
}
