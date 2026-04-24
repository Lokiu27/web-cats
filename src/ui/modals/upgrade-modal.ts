// Upgrade Modal for Openspacemarin
// Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 3.1, 3.5, 3.6, 3.7, 4.4, 4.5,
//               5.2, 5.3, 10.1, 10.2, 10.3, 10.4, 20.1–20.5
//
// Modal dialog for upgrading a desk.
// Shows cat+desk canvas preview, cat name, biography, current level, generation,
// upgrade cost, and the generation increase after upgrading.
// Darkened overlay, click-outside-to-close, CSS scale+opacity transition.
// Speech bubble appears after successful upgrade and auto-hides after 2500 ms.

import type { Desk, DeskTier, IPixelArtGenerator } from '../../types/index.js';
import { localization } from '../../systems/localization.js';
import { formatCurrency, formatGeneration } from '../../utils/formatting.js';
import { upgradeBarColor } from '../../rendering/hex-grid-renderer.js';

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
  padding: 0.75rem 1rem;
  width: 100%;
  max-width: 300px;
  max-height: 440px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
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
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.18em;
  color: #ffd700;
  text-transform: uppercase;
  text-align: center;
}

.upgrade-modal__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upgrade-modal__canvas {
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  border: 1px solid #222244;
  border-radius: 2px;
  background: #0a0a14;
}

.upgrade-modal__speech-bubble {
  position: relative;
  background: #ffd700;
  color: #0d0d1a;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  text-align: center;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s, transform 0.2s;
}

.upgrade-modal__speech-bubble--visible {
  opacity: 1;
  transform: translateY(0);
}

.upgrade-modal__speech-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #ffd700;
  border-bottom: none;
}

.upgrade-modal__desk-name {
  font-size: 0.75rem;
  color: #aaaacc;
  text-align: center;
  letter-spacing: 0.08em;
}

.upgrade-modal__biography {
  font-size: 0.72rem;
  color: #666688;
  text-align: center;
  letter-spacing: 0.04em;
  font-style: italic;
  line-height: 1.4;
}

.upgrade-modal__rows {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.upgrade-modal__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.7rem;
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
  font-size: 0.7rem;
  color: #ccccdd;
  background: #0d0d1a;
  border: 1px solid #333355;
  padding: 0.4rem 0.9rem;
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

.upgrade-modal__max-label {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9rem;
  font-weight: bold;
  color: #ffd700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-align: center;
  padding: 0.55rem 1.25rem;
  flex: 1;
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
// Helpers
// ---------------------------------------------------------------------------

/** Maps upgradeLevel (0-3) to DeskTier, matching HexGridRenderer logic. */
function levelToTier(level: number): DeskTier {
  if (level >= 3) return 'premium';
  if (level >= 2) return 'modern';
  if (level >= 1) return 'improved';
  return 'basic';
}

const CANVAS_WIDTH = 140;
const CANVAS_HEIGHT = 100;

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
  private canvasEl!: HTMLCanvasElement;
  private speechBubbleEl!: HTMLDivElement;
  private deskNameEl!: HTMLDivElement;
  private biographyEl!: HTMLDivElement;
  private levelValueEl!: HTMLSpanElement;
  private genValueEl!: HTMLSpanElement;
  private costValueEl!: HTMLSpanElement;
  private increaseValueEl!: HTMLSpanElement;
  private balanceValueEl!: HTMLSpanElement;
  private warningEl!: HTMLDivElement;
  private upgradeBtn!: HTMLButtonElement;
  private maxLabelEl!: HTMLDivElement;
  private actionsEl!: HTMLDivElement;

  // State
  private currentDeskId = '';
  private currentCost = 0;
  private currentBalance = 0;
  private pixelArt: IPixelArtGenerator | null = null;
  private currentDesk: Desk | null = null;
  private speechBubbleTimer: ReturnType<typeof setTimeout> | null = null;

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

    // Preview section: canvas + speech bubble
    const preview = document.createElement('div');
    preview.className = 'upgrade-modal__preview';

    this.canvasEl = document.createElement('canvas');
    this.canvasEl.className = 'upgrade-modal__canvas';
    this.canvasEl.width = CANVAS_WIDTH;
    this.canvasEl.height = CANVAS_HEIGHT;

    this.speechBubbleEl = document.createElement('div');
    this.speechBubbleEl.className = 'upgrade-modal__speech-bubble';

    preview.appendChild(this.canvasEl);
    preview.appendChild(this.speechBubbleEl);

    // Desk / cat name
    this.deskNameEl = document.createElement('div');
    this.deskNameEl.className = 'upgrade-modal__desk-name';

    // Biography
    this.biographyEl = document.createElement('div');
    this.biographyEl.className = 'upgrade-modal__biography';

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
    this.actionsEl = document.createElement('div');
    this.actionsEl.className = 'upgrade-modal__actions';

    this.upgradeBtn = document.createElement('button');
    this.upgradeBtn.className = 'upgrade-modal__btn upgrade-modal__btn--upgrade';
    this.upgradeBtn.setAttribute('type', 'button');
    this.upgradeBtn.textContent = localization.t('modal.upgrade.upgrade');
    this.upgradeBtn.addEventListener('click', () => {
      if (!this.upgradeBtn.disabled) this.onUpgrade(this.currentDeskId);
    });

    this.maxLabelEl = document.createElement('div');
    this.maxLabelEl.className = 'upgrade-modal__max-label';
    this.maxLabelEl.textContent = localization.t('modal.upgrade.max_level');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'upgrade-modal__btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.textContent = localization.t('modal.upgrade.close');
    closeBtn.addEventListener('click', () => this.onClose());

    this.actionsEl.appendChild(this.upgradeBtn);
    this.actionsEl.appendChild(this.maxLabelEl);
    this.actionsEl.appendChild(closeBtn);

    panel.appendChild(title);
    panel.appendChild(preview);
    panel.appendChild(this.deskNameEl);
    panel.appendChild(this.biographyEl);
    panel.appendChild(rows);
    panel.appendChild(this.warningEl);
    panel.appendChild(this.actionsEl);
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
   * @param cost       - Cost to upgrade (0 if at max level)
   * @param balance    - Player's current currency
   * @param currentGen - Current generation per tick for this desk
   * @param newGen     - Generation per tick after upgrade
   * @param pixelArt   - Pixel art generator for rendering cat+desk sprites
   */
  show(
    desk: Desk,
    cost: number,
    balance: number,
    currentGen: number,
    newGen: number,
    pixelArt: IPixelArtGenerator,
  ): void {
    this.currentDeskId = desk.id;
    this.currentCost = cost;
    this.currentBalance = balance;
    this.pixelArt = pixelArt;
    this.currentDesk = desk;

    // Rebuild panel content with current language
    const panel = this.element.querySelector('.upgrade-modal__panel') as HTMLDivElement;
    if (panel) {
      panel.innerHTML = '';
      this._buildPanelContent(panel);
    }

    this._populateValues(desk, cost, currentGen, newGen);
    this.refreshBalance();
    this._renderCanvas(desk);
    this.element.classList.add('upgrade-modal-overlay--visible');
  }

  /**
   * Closes the modal.
   */
  hide(): void {
    this.element.classList.remove('upgrade-modal-overlay--visible');
    this._clearSpeechBubbleTimer();
  }

  /**
   * Updates the displayed balance and refreshes the button state.
   */
  updateBalance(balance: number): void {
    this.currentBalance = balance;
    this.refreshBalance();
  }

  /**
   * Updates the modal in-place after a successful upgrade (modal stays open).
   *
   * @param desk       - The updated desk (with new upgradeLevel)
   * @param cost       - Cost for the next upgrade (0 if now at max level)
   * @param balance    - Player's updated currency balance
   * @param currentGen - New generation per tick for this desk
   * @param newGen     - Generation per tick after the next upgrade
   */
  refreshAfterUpgrade(
    desk: Desk,
    cost: number,
    balance: number,
    currentGen: number,
    newGen: number,
  ): void {
    this.currentDeskId = desk.id;
    this.currentCost = cost;
    this.currentBalance = balance;
    this.currentDesk = desk;

    this._populateValues(desk, cost, currentGen, newGen);
    this.refreshBalance();
    this._renderCanvas(desk);
  }

  /**
   * Shows a localized speech bubble ("Meow! I got promoted!") that
   * auto-hides after 2500 ms.
   */
  showPromotionMessage(): void {
    if (!this.speechBubbleEl) return;

    this._clearSpeechBubbleTimer();

    this.speechBubbleEl.textContent = localization.t('modal.upgrade.promoted_message');
    this.speechBubbleEl.classList.add('upgrade-modal__speech-bubble--visible');

    this.speechBubbleTimer = setTimeout(() => {
      this.speechBubbleEl.classList.remove('upgrade-modal__speech-bubble--visible');
      this.speechBubbleTimer = null;
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Populates all text values in the modal for the given desk state.
   */
  private _populateValues(
    desk: Desk,
    cost: number,
    currentGen: number,
    newGen: number,
  ): void {
    const isMax = desk.upgradeLevel >= 3;

    // Cat name and biography
    this.deskNameEl.textContent = desk.cat.name;
    this.biographyEl.textContent = desk.cat.biography ?? '';

    // Level display: "Level: X/3" or "Level: MAX"
    if (isMax) {
      this.levelValueEl.textContent = localization.t('modal.upgrade.level_max');
    } else {
      this.levelValueEl.textContent = localization.t('modal.upgrade.level_format', {
        level: desk.upgradeLevel,
      });
    }

    // Generation
    this.genValueEl.textContent = `${formatGeneration(currentGen)}${localization.t('hud.per_tick')}`;

    // Cost and increase rows
    if (isMax) {
      this.costValueEl.textContent = '—';
      this.increaseValueEl.textContent = '—';
    } else {
      this.costValueEl.textContent = formatCurrency(cost);
      this.increaseValueEl.textContent = `+${formatGeneration(newGen - currentGen)}${localization.t('hud.per_tick')}`;
    }

    // Show/hide upgrade button vs MAX label
    this.upgradeBtn.style.display = isMax ? 'none' : '';
    this.maxLabelEl.style.display = isMax ? '' : 'none';
  }

  /**
   * Renders the cat sprite and desk sprite onto the canvas element.
   */
  private _renderCanvas(desk: Desk): void {
    if (!this.pixelArt || !this.canvasEl) return;

    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.imageSmoothingEnabled = false;

    const tier = levelToTier(desk.upgradeLevel);
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT * 0.55;

    try {
      // --- Cat sprite (drawn first, desk overlaps bottom) ---
      const catSprite = this.pixelArt.generateCatSprite(desk.cat.appearance, {
        action: 'idle',
        frame: 0,
      });
      const catScale = 0.65;
      const cw = CANVAS_WIDTH * catScale;
      const ch = catSprite.height * (cw / catSprite.width);
      ctx.drawImage(catSprite, cx - cw / 2 + 14, cy - ch * 0.55, cw, ch);

      // --- Desk sprite (drawn after cat) ---
      const deskSprite = this.pixelArt.generateDeskSprite(tier);
      const deskScale = 0.75;
      const dw = CANVAS_WIDTH * deskScale;
      const dh = deskSprite.height * (dw / deskSprite.width);
      ctx.drawImage(deskSprite, cx - dw / 2, cy - dh / 2 + 20, dw, dh);

      // --- Glow for premium/modern ---
      if (tier === 'premium' || tier === 'modern') {
        try {
          const glow = this.pixelArt.generateDeskGlow(tier);
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glow, cx - dw / 2, cy - dh / 2 + 20, dw, dh);
          ctx.restore();
        } catch { /* ignore glow errors */ }
      }
    } catch {
      // Graceful degradation: if sprite generation fails, leave canvas blank
    }

    // --- Upgrade bar ---
    const barW = 50;
    const barH = 4;
    const barX = cx - barW / 2;
    const barY = 6;
    const barColor = upgradeBarColor(desk.upgradeLevel);
    const barFill = Math.min(1, (desk.upgradeLevel + 1) / 4);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, Math.round(barW * barFill), barH);

    // Level number above bar
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(desk.upgradeLevel), cx, barY - 1);
  }

  private refreshBalance(): void {
    const isMax = this.currentDesk ? this.currentDesk.upgradeLevel >= 3 : false;

    if (isMax) {
      this.balanceValueEl.textContent = formatCurrency(this.currentBalance);
      this.balanceValueEl.classList.remove('upgrade-modal__row-value--insufficient');
      this.warningEl.textContent = '';
      this.upgradeBtn.disabled = true;
      return;
    }

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

  private _clearSpeechBubbleTimer(): void {
    if (this.speechBubbleTimer !== null) {
      clearTimeout(this.speechBubbleTimer);
      this.speechBubbleTimer = null;
    }
  }
}
