// Achievement Notification for Openspacemarin
// Requirements: 7.4, 11.4, 20.1–20.5, 21.4
//
// Full-screen overlay shown when an achievement is unlocked.
// Displays achievement name, description, and bonus percentage.
// Auto-dismisses after 4 seconds; also has a manual "Continue" button.
// CSS fade+scale entrance animation, gold/yellow celebratory colour scheme.

import { localization } from '../../systems/localization.js';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ACHIEVEMENT_NOTIFICATION_STYLES = `
@keyframes achievement-pulse {
  0%   { box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), 0 0 60px rgba(255, 215, 0, 0.15); }
  50%  { box-shadow: 0 0 40px rgba(255, 215, 0, 0.7), 0 0 80px rgba(255, 215, 0, 0.3); }
  100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), 0 0 60px rgba(255, 215, 0, 0.15); }
}

@keyframes achievement-star-spin {
  from { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(180deg) scale(1.2); }
  to   { transform: rotate(360deg) scale(1); }
}

.achievement-notification-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease-in-out;
  z-index: 300;
}

.achievement-notification-overlay.achievement-notification-overlay--visible {
  opacity: 1;
  pointer-events: auto;
}

.achievement-notification__panel {
  font-family: 'Courier New', Courier, monospace;
  background: #0d0d1a;
  border: 2px solid #ffd700;
  border-radius: 6px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  transform: scale(0.75);
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out;
  text-align: center;
}

.achievement-notification-overlay--visible .achievement-notification__panel {
  transform: scale(1);
  opacity: 1;
  animation: achievement-pulse 2s ease-in-out infinite;
}

.achievement-notification__icon {
  font-size: 2.5rem;
  line-height: 1;
  animation: achievement-star-spin 3s linear infinite;
  display: inline-block;
}

.achievement-notification__header {
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  color: #ffd700;
  text-transform: uppercase;
  opacity: 0.8;
}

.achievement-notification__name {
  font-size: clamp(1.1rem, 4vw, 1.5rem);
  font-weight: bold;
  letter-spacing: 0.12em;
  color: #ffd700;
  text-shadow:
    0 0 10px rgba(255, 215, 0, 0.6),
    0 0 20px rgba(255, 215, 0, 0.3);
  text-transform: uppercase;
}

.achievement-notification__description {
  font-size: 0.82rem;
  color: #aaaacc;
  letter-spacing: 0.06em;
  line-height: 1.5;
  max-width: 300px;
}

.achievement-notification__bonus {
  font-size: 1.1rem;
  font-weight: bold;
  color: #44cc88;
  letter-spacing: 0.1em;
  background: rgba(68, 204, 136, 0.1);
  border: 1px solid rgba(68, 204, 136, 0.3);
  border-radius: 3px;
  padding: 0.3rem 0.8rem;
}

.achievement-notification__bonus-label {
  font-size: 0.65rem;
  color: #666688;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: -0.5rem;
}

.achievement-notification__timer {
  font-size: 0.65rem;
  color: #555577;
  letter-spacing: 0.1em;
}

.achievement-notification__btn {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.82rem;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid #ffd700;
  padding: 0.6rem 2rem;
  cursor: pointer;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border-radius: 2px;
  transition: background 0.15s, transform 0.1s;
  margin-top: 0.5rem;
}

.achievement-notification__btn:hover {
  background: rgba(255, 215, 0, 0.18);
}

.achievement-notification__btn:active {
  transform: scale(0.97);
}
`;

function injectAchievementNotificationStyles(): void {
  if (document.getElementById('achievement-notification-styles')) return;
  const style = document.createElement('style');
  style.id = 'achievement-notification-styles';
  style.textContent = ACHIEVEMENT_NOTIFICATION_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// AchievementNotification class
// ---------------------------------------------------------------------------

/** Data required to display an achievement notification. */
export interface AchievementNotificationData {
  name: string;
  description: string;
  bonusPercent: number;
}

const AUTO_DISMISS_MS = 4000;

export class AchievementNotification {
  readonly element: HTMLDivElement;

  /** Called when the notification is dismissed (auto or manual). */
  onDismiss: () => void = () => undefined;

  // DOM refs
  private nameEl!: HTMLDivElement;
  private descriptionEl!: HTMLDivElement;
  private bonusEl!: HTMLDivElement;
  private timerEl!: HTMLDivElement;

  // Label refs for refreshLocalization
  private headerEl!: HTMLDivElement;
  private bonusLabelEl!: HTMLDivElement;
  private continueBtnEl!: HTMLButtonElement;

  // Localization unsubscribe handle
  private unsubLocalization: (() => void) | null = null;

  // Auto-dismiss timer
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    injectAchievementNotificationStyles();
    this.element = this.buildDOM();
    this.unsubLocalization = localization.onChange(() => this.refreshLocalization());
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'achievement-notification-overlay';

    const panel = document.createElement('div');
    panel.className = 'achievement-notification__panel';

    // Spinning star icon
    const icon = document.createElement('div');
    icon.className = 'achievement-notification__icon';
    icon.textContent = '★';

    // "Achievement Unlocked!" header
    const header = document.createElement('div');
    header.className = 'achievement-notification__header';
    header.textContent = localization.t('achievement.notification.title');
    this.headerEl = header;

    // Achievement name
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'achievement-notification__name';

    // Description
    this.descriptionEl = document.createElement('div');
    this.descriptionEl.className = 'achievement-notification__description';

    // Bonus label + value
    const bonusLabel = document.createElement('div');
    bonusLabel.className = 'achievement-notification__bonus-label';
    bonusLabel.textContent = localization.t('achievement.notification.bonus');
    this.bonusLabelEl = bonusLabel;

    this.bonusEl = document.createElement('div');
    this.bonusEl.className = 'achievement-notification__bonus';

    // Auto-dismiss countdown
    this.timerEl = document.createElement('div');
    this.timerEl.className = 'achievement-notification__timer';

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.className = 'achievement-notification__btn';
    continueBtn.setAttribute('type', 'button');
    continueBtn.textContent = localization.t('achievement.notification.continue');
    continueBtn.addEventListener('click', () => this.dismiss());
    this.continueBtnEl = continueBtn;

    panel.appendChild(icon);
    panel.appendChild(header);
    panel.appendChild(this.nameEl);
    panel.appendChild(this.descriptionEl);
    panel.appendChild(bonusLabel);
    panel.appendChild(this.bonusEl);
    panel.appendChild(this.timerEl);
    panel.appendChild(continueBtn);
    overlay.appendChild(panel);

    return overlay;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Shows the achievement notification overlay.
   * Auto-dismisses after AUTO_DISMISS_MS milliseconds.
   */
  show(achievement: AchievementNotificationData): void {
    // Clear any existing timers
    this.clearTimers();

    // Populate content
    this.nameEl.textContent = achievement.name;
    this.descriptionEl.textContent = achievement.description;
    this.bonusEl.textContent = `+${achievement.bonusPercent}%`;

    // Show overlay
    this.element.classList.add('achievement-notification-overlay--visible');

    // Start countdown display
    let remaining = Math.ceil(AUTO_DISMISS_MS / 1000);
    this.updateTimerText(remaining);

    this.timerInterval = setInterval(() => {
      remaining -= 1;
      this.updateTimerText(remaining);
    }, 1000);

    // Auto-dismiss
    this.dismissTimer = setTimeout(() => {
      this.dismiss();
    }, AUTO_DISMISS_MS);
  }

  /**
   * Hides the notification immediately.
   */
  hide(): void {
    this.clearTimers();
    this.element.classList.remove('achievement-notification-overlay--visible');
  }

  /** Re-applies localization strings to all static label DOM elements. */
  refreshLocalization(): void {
    if (this.headerEl) this.headerEl.textContent = localization.t('achievement.notification.title');
    if (this.bonusLabelEl) this.bonusLabelEl.textContent = localization.t('achievement.notification.bonus');
    if (this.continueBtnEl) this.continueBtnEl.textContent = localization.t('achievement.notification.continue');
  }

  /** Cleans up localization subscription. */
  destroy(): void {
    if (this.unsubLocalization) {
      this.unsubLocalization();
      this.unsubLocalization = null;
    }
    this.clearTimers();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private dismiss(): void {
    this.hide();
    this.onDismiss();
  }

  private clearTimers(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private updateTimerText(secondsRemaining: number): void {
    this.timerEl.textContent = secondsRemaining > 0
      ? `(${secondsRemaining}s)`
      : '';
  }
}
