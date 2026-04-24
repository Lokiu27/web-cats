// Purchase Modal for Openspacemarin
// Requirements: 2.1, 2.4, 20.1–20.5
//
// Modal dialog for purchasing a new desk.
// Shows cost, current balance, and a Buy button (disabled when insufficient).
// Darkened overlay, click-outside-to-close, CSS scale+opacity transition.

import { localization } from '../../systems/localization.js';
import { formatCurrency } from '../../utils/formatting.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PURCHASE_MODAL_STYLES = `
.purchase-modal-overlay {
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

.purchase-modal-overlay.purchase-modal-overlay--visible {
  opacity: 1;
  pointer-events: auto;
}

.purchase-modal__panel {
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

.purchase-modal-overlay--visible .purchase-modal__panel {
  transform: scale(1);
  opacity: 1;
}

.purchase-modal__title {
  font-size: 1rem;
  font-weight: bold;
  letter-spacing: 0.18em;
  color: #ffd700;
  text-transform: uppercase;
  text-align: center;
}

.purchase-modal__rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.purchase-modal__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  color: #ccccdd;
  letter-spacing: 0.06em;
}

.purchase-modal__row-label {
  color: #888899;
}

.purchase-modal__row-value {
  color: #ffd700;
  font-weight: bold;
}

.purchase-modal__row-value--insufficient {
  color: #ff6666;
}

.purchase-modal__warning {
  font-size: 0.72rem;
  color: #ff6666;
  text-align: center;
  letter-spacing: 0.08em;
  min-height: 1em;
}

.purchase-modal__actions {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
}

.purchase-modal__btn {
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

.purchase-modal__btn:hover:not(:disabled) {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.07);
}

.purchase-modal__btn:active:not(:disabled) {
  transform: scale(0.97);
}

.purchase-modal__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.purchase-modal__btn--buy {
  color: #ffd700;
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.08);
}

.purchase-modal__btn--buy:hover:not(:disabled) {
  background: rgba(255, 215, 0, 0.18);
}
`;

function injectPurchaseModalStyles(): void {
  if (document.getElementById('purchase-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'purchase-modal-styles';
  style.textContent = PURCHASE_MODAL_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// PurchaseModal class
// ---------------------------------------------------------------------------

export class PurchaseModal {
  readonly element: HTMLDivElement;

  /** Called when the player confirms the purchase. */
  onBuy: () => void = () => undefined;

  /** Called when the player cancels or clicks outside. */
  onClose: () => void = () => undefined;

  // DOM refs
  private costValueEl!: HTMLSpanElement;
  private balanceValueEl!: HTMLSpanElement;
  private warningEl!: HTMLDivElement;
  private buyBtn!: HTMLButtonElement;
  private titleEl!: HTMLDivElement;
  private costLabelEl!: HTMLSpanElement;
  private balanceLabelEl!: HTMLSpanElement;
  private cancelBtn!: HTMLButtonElement;

  // State
  private currentCost = 0;
  private currentBalance = 0;

  constructor() {
    injectPurchaseModalStyles();
    this.element = this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'purchase-modal-overlay';

    // Click outside panel → close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.onClose();
    });

    const panel = document.createElement('div');
    panel.className = 'purchase-modal__panel';

    // Title
    const title = document.createElement('div');
    title.className = 'purchase-modal__title';
    title.textContent = localization.t('modal.purchase.title');
    this.titleEl = title;

    // Rows
    const rows = document.createElement('div');
    rows.className = 'purchase-modal__rows';

    this.costValueEl = document.createElement('span');
    this.costValueEl.className = 'purchase-modal__row-value';

    this.balanceValueEl = document.createElement('span');
    this.balanceValueEl.className = 'purchase-modal__row-value';

    this.costLabelEl = document.createElement('span');
    this.costLabelEl.className = 'purchase-modal__row-label';
    this.costLabelEl.textContent = localization.t('modal.purchase.cost');

    this.balanceLabelEl = document.createElement('span');
    this.balanceLabelEl.className = 'purchase-modal__row-label';
    this.balanceLabelEl.textContent = localization.t('modal.purchase.balance');

    rows.appendChild(this._makeRow(this.costLabelEl, this.costValueEl));
    rows.appendChild(this._makeRow(this.balanceLabelEl, this.balanceValueEl));

    // Warning
    this.warningEl = document.createElement('div');
    this.warningEl.className = 'purchase-modal__warning';

    // Actions
    const actions = document.createElement('div');
    actions.className = 'purchase-modal__actions';

    this.buyBtn = document.createElement('button');
    this.buyBtn.className = 'purchase-modal__btn purchase-modal__btn--buy';
    this.buyBtn.setAttribute('type', 'button');
    this.buyBtn.textContent = localization.t('modal.purchase.buy');
    this.buyBtn.addEventListener('click', () => {
      if (!this.buyBtn.disabled) this.onBuy();
    });

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.className = 'purchase-modal__btn';
    this.cancelBtn.setAttribute('type', 'button');
    this.cancelBtn.textContent = localization.t('modal.purchase.cancel');
    this.cancelBtn.addEventListener('click', () => this.onClose());

    actions.appendChild(this.buyBtn);
    actions.appendChild(this.cancelBtn);

    panel.appendChild(title);
    panel.appendChild(rows);
    panel.appendChild(this.warningEl);
    panel.appendChild(actions);
    overlay.appendChild(panel);

    return overlay;
  }

  private _makeRow(labelEl: HTMLSpanElement, valueEl: HTMLSpanElement): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'purchase-modal__row';
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  private _refreshLabels(): void {
    this.titleEl.textContent = localization.t('modal.purchase.title');
    this.costLabelEl.textContent = localization.t('modal.purchase.cost');
    this.balanceLabelEl.textContent = localization.t('modal.purchase.balance');
    this.buyBtn.textContent = localization.t('modal.purchase.buy');
    this.cancelBtn.textContent = localization.t('modal.purchase.cancel');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Opens the modal with the given cost and balance.
   */
  show(cost: number, balance: number): void {
    this.currentCost = cost;
    this.currentBalance = balance;
    // Refresh all localized text (in case language changed since DOM was built)
    this._refreshLabels();
    this.refreshDisplay();
    this.element.classList.add('purchase-modal-overlay--visible');
  }

  /**
   * Closes the modal.
   */
  hide(): void {
    this.element.classList.remove('purchase-modal-overlay--visible');
  }

  /**
   * Updates the displayed balance and refreshes the button state.
   * Call this when the player's currency changes while the modal is open.
   */
  updateBalance(balance: number): void {
    this.currentBalance = balance;
    this.refreshDisplay();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private refreshDisplay(): void {
    const canAfford = this.currentBalance >= this.currentCost;

    this.costValueEl.textContent = formatCurrency(this.currentCost);

    this.balanceValueEl.textContent = formatCurrency(this.currentBalance);
    this.balanceValueEl.classList.toggle(
      'purchase-modal__row-value--insufficient',
      !canAfford,
    );

    this.warningEl.textContent = canAfford
      ? ''
      : localization.t('modal.purchase.insufficient');

    this.buyBtn.disabled = !canAfford;
  }
}
