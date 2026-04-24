// Splash Screen for Openspacemarin
// Requirements: 11.1, 11.7
//
// Shown on every application start for 2–3 seconds.
// Displays the game logo, version number, and a simple loading indicator.
// After the timer expires, auto-transitions to:
//   - Welcome screen  (first launch: firstLaunchDone === false)
//   - Main Menu       (returning player: firstLaunchDone === true)

import type { ScreenType } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GAME_VERSION = '0.1.0';

/** Duration the splash screen is shown before auto-transitioning (ms). */
const SPLASH_DURATION_MS = 2500;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SPLASH_STYLES = `
.screen--splash {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0d0d1a;
}

.splash__logo {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(1.5rem, 5vw, 3rem);
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #ffd700;
  text-shadow:
    0 0 10px rgba(255, 215, 0, 0.6),
    0 0 20px rgba(255, 215, 0, 0.3);
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  animation: splash-logo-pulse 2s ease-in-out infinite;
}

.splash__subtitle {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(0.6rem, 2vw, 0.9rem);
  color: #8888aa;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-bottom: 3rem;
}

.splash__version {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.75rem;
  color: #555577;
  letter-spacing: 0.1em;
  margin-bottom: 2rem;
}

.splash__progress-track {
  width: clamp(160px, 40vw, 320px);
  height: 4px;
  background: #1e1e3a;
  border-radius: 2px;
  overflow: hidden;
}

.splash__progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #ffd700, #ffaa00);
  border-radius: 2px;
  transition: width linear;
}

@keyframes splash-logo-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.85; }
}
`;

function injectSplashStyles(): void {
  if (document.getElementById('splash-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'splash-screen-styles';
  style.textContent = SPLASH_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// SplashScreen
// ---------------------------------------------------------------------------

export class SplashScreen {
  readonly element: HTMLDivElement;
  private progressFill: HTMLDivElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private animFrame: ReturnType<typeof requestAnimationFrame> | null = null;
  private startTime = 0;

  constructor() {
    injectSplashStyles();
    this.element = this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');

    const logo = document.createElement('div');
    logo.className = 'splash__logo';
    logo.textContent = 'OPENSPACEMARIN';

    const subtitle = document.createElement('div');
    subtitle.className = 'splash__subtitle';
    subtitle.textContent = 'Все как в жизни, только еще скучнее';

    const version = document.createElement('div');
    version.className = 'splash__version';
    version.textContent = `v${GAME_VERSION}`;

    const track = document.createElement('div');
    track.className = 'splash__progress-track';

    const fill = document.createElement('div');
    fill.className = 'splash__progress-fill';
    track.appendChild(fill);
    this.progressFill = fill;

    root.appendChild(logo);
    root.appendChild(subtitle);
    root.appendChild(version);
    root.appendChild(track);

    return root;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Starts the splash timer and progress bar animation.
   * Calls `onComplete` with the target screen when done.
   *
   * @param firstLaunchDone - Whether the welcome animation has already been shown
   * @param onComplete      - Callback receiving the next screen to navigate to
   */
  start(firstLaunchDone: boolean, onComplete: (next: ScreenType) => void): void {
    this.startTime = performance.now();

    // Animate the progress bar
    const animate = (now: number): void => {
      const elapsed = now - this.startTime;
      const progress = Math.min(elapsed / SPLASH_DURATION_MS, 1);
      if (this.progressFill) {
        this.progressFill.style.width = `${progress * 100}%`;
      }
      if (progress < 1) {
        this.animFrame = requestAnimationFrame(animate);
      }
    };
    this.animFrame = requestAnimationFrame(animate);

    // Auto-transition after the splash duration
    this.timer = setTimeout(() => {
      this.stop();
      const next: ScreenType = firstLaunchDone ? 'main_menu' : 'welcome';
      onComplete(next);
    }, SPLASH_DURATION_MS);
  }

  /** Cancels any pending timer/animation (e.g. if the screen is dismissed early). */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }
}
