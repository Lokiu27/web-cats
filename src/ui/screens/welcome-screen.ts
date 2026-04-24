// Welcome Screen for Openspacemarin
// Requirements: 11.2, 11.7
//
// Shown only on first launch (firstLaunchDone === false).
// Displays a simple intro animation: lines of text fade in one by one.
// A "Skip" button lets the player jump straight to the main menu.
// Auto-transitions to main menu after ~8 seconds.
// After showing, sets firstLaunchDone = true in state via the provided callback.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Total duration before auto-transition to main menu (ms). */
const WELCOME_DURATION_MS = 8000;

/** Delay between each intro line appearing (ms). */
const LINE_DELAY_MS = 1800;

// ---------------------------------------------------------------------------
// Intro lines (bilingual — shown together for charm)
// ---------------------------------------------------------------------------

const INTRO_LINES: string[] = [
  'Добро пожаловать в Опенспейсмарин',
  'Welcome to Openspacemarin',
  '─────────────────────────────────',
  'Все как в жизни, только еще скучнее.',
  'Everything like in real life,',
  'only even more boring.',
  '─────────────────────────────────',
  'Нанимайте котов. Покупайте столы.',
  'Hire cats. Buy desks.',
  'Зарабатывайте валюту. Повторяйте.',
  'Earn currency. Repeat.',
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const WELCOME_STYLES = `
.screen--welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0d0d1a;
}

.welcome__lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  max-width: 600px;
  padding: 0 1.5rem;
  margin-bottom: 3rem;
}

.welcome__line {
  font-family: 'Courier New', Courier, monospace;
  font-size: clamp(0.75rem, 2.5vw, 1rem);
  color: #ccccdd;
  text-align: center;
  letter-spacing: 0.05em;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.welcome__line.welcome__line--visible {
  opacity: 1;
  transform: translateY(0);
}

.welcome__line--title {
  font-size: clamp(1rem, 3vw, 1.4rem);
  color: #ffd700;
  font-weight: bold;
  letter-spacing: 0.1em;
}

.welcome__line--separator {
  color: #333355;
  font-size: 0.8rem;
}

.welcome__skip {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85rem;
  color: #888899;
  background: transparent;
  border: 1px solid #333355;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: color 0.2s, border-color 0.2s, transform 0.1s;
  border-radius: 2px;
}

.welcome__skip:hover {
  color: #ffd700;
  border-color: #ffd700;
}

.welcome__skip:active {
  transform: scale(0.97);
}
`;

function injectWelcomeStyles(): void {
  if (document.getElementById('welcome-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'welcome-screen-styles';
  style.textContent = WELCOME_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// WelcomeScreen
// ---------------------------------------------------------------------------

export class WelcomeScreen {
  readonly element: HTMLDivElement;
  private lineElements: HTMLDivElement[] = [];
  private lineTimers: ReturnType<typeof setTimeout>[] = [];
  private autoTimer: ReturnType<typeof setTimeout> | null = null;
  private onCompleteCallback: (() => void) | null = null;

  constructor() {
    injectWelcomeStyles();
    this.element = this.buildDOM();
  }

  // ---------------------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------------------

  private buildDOM(): HTMLDivElement {
    const root = document.createElement('div');

    // Lines container
    const linesContainer = document.createElement('div');
    linesContainer.className = 'welcome__lines';

    INTRO_LINES.forEach((text, i) => {
      const line = document.createElement('div');
      line.className = 'welcome__line';

      // Style the first two lines as titles, separators differently
      if (i === 0 || i === 1) {
        line.classList.add('welcome__line--title');
      } else if (text.startsWith('─')) {
        line.classList.add('welcome__line--separator');
      }

      line.textContent = text;
      linesContainer.appendChild(line);
      this.lineElements.push(line);
    });

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.className = 'welcome__skip';
    skipBtn.textContent = 'Skip →';
    skipBtn.setAttribute('type', 'button');
    skipBtn.addEventListener('click', () => {
      this.complete();
    });

    root.appendChild(linesContainer);
    root.appendChild(skipBtn);

    return root;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Starts the welcome animation.
   * Lines fade in one by one, then auto-transitions after WELCOME_DURATION_MS.
   *
   * @param onComplete - Called when the screen should transition to main menu.
   *                     The caller is responsible for setting firstLaunchDone = true
   *                     and navigating to 'main_menu'.
   */
  start(onComplete: () => void): void {
    this.onCompleteCallback = onComplete;

    // Reset all lines to hidden
    for (const line of this.lineElements) {
      line.classList.remove('welcome__line--visible');
    }

    // Stagger each line's appearance
    this.lineElements.forEach((line, i) => {
      const timer = setTimeout(() => {
        line.classList.add('welcome__line--visible');
      }, i * LINE_DELAY_MS);
      this.lineTimers.push(timer);
    });

    // Auto-transition after full duration
    this.autoTimer = setTimeout(() => {
      this.complete();
    }, WELCOME_DURATION_MS);
  }

  /** Cancels all timers and calls the completion callback. */
  private complete(): void {
    this.stop();
    if (this.onCompleteCallback) {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  /** Cancels all pending timers without calling the callback. */
  stop(): void {
    for (const t of this.lineTimers) {
      clearTimeout(t);
    }
    this.lineTimers = [];

    if (this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }
}
