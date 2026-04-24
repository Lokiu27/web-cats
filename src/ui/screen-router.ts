// Screen Router for Openspacemarin
// Requirements: 11.1, 11.2, 11.7
//
// Navigation state machine that manages HTML/CSS screen overlays.
// Each screen is a <div> with class `screen screen--<name>`.
// Transitions use CSS opacity fade (300ms) for smooth navigation.
// Emits `screen_changed` events via the event bus on every transition.

import type { ScreenType, IEventBus } from '../types/index.js';

// ---------------------------------------------------------------------------
// CSS injected once into the document head
// ---------------------------------------------------------------------------

const SCREEN_STYLES = `
.screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease-in-out;
  overflow: hidden;
}

.screen.screen--active {
  opacity: 1;
  pointer-events: auto;
}

/* Dark base for menu/info screens — NOT for the game screen (canvas renders behind it) */
.screen:not(.screen--game) {
  background: #1a1a2e;
  color: #ffffff;
  font-family: 'Courier New', Courier, monospace;
}

/* Game screen is transparent — canvas shows through */
.screen--game {
  background: transparent;
  overflow: hidden;
}
`;

function injectStyles(): void {
  if (document.getElementById('screen-router-styles')) return;
  const style = document.createElement('style');
  style.id = 'screen-router-styles';
  style.textContent = SCREEN_STYLES;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// ScreenRouter
// ---------------------------------------------------------------------------

export class ScreenRouter {
  private readonly container: HTMLElement;
  private readonly bus: IEventBus;
  private currentScreen: ScreenType | null = null;
  private readonly screenElements = new Map<ScreenType, HTMLDivElement>();
  private transitioning = false;

  /**
   * @param container - The DOM element that will hold all screen divs (e.g. #ui-overlay)
   * @param bus       - Event bus for emitting `screen_changed` events
   */
  constructor(container: HTMLElement, bus: IEventBus) {
    this.container = container;
    this.bus = bus;
    injectStyles();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Registers a screen element so the router can show/hide it.
   * The element should already be a child of the container, or will be appended.
   */
  registerScreen(type: ScreenType, element: HTMLDivElement): void {
    // Remove the old element if re-registering (e.g. after language change)
    const existing = this.screenElements.get(type);
    if (existing && existing !== element && this.container.contains(existing)) {
      this.container.removeChild(existing);
    }

    // Ensure the element has the base screen class
    element.classList.add('screen', `screen--${type.replace('_', '-')}`);

    // Preserve active state if this screen is currently shown
    if (this.currentScreen === type) {
      element.classList.add('screen--active');
    } else {
      element.classList.remove('screen--active');
    }

    if (!this.container.contains(element)) {
      this.container.appendChild(element);
    }

    this.screenElements.set(type, element);
  }

  /**
   * Transitions to the given screen with a CSS fade.
   * Emits `screen_changed` on the event bus.
   * If a transition is already in progress, the new navigation is queued
   * by waiting for the current fade-out to finish.
   */
  navigateTo(screen: ScreenType): void {
    if (this.currentScreen === screen) return;

    const from = this.currentScreen;
    const to = screen;

    // Update currentScreen immediately so renderFrame starts drawing right away
    this.currentScreen = to;

    const doTransition = (): void => {
      this.transitioning = true;

      // Fade out current screen
      if (from !== null) {
        const outEl = this.screenElements.get(from);
        if (outEl) {
          outEl.classList.remove('screen--active');
        }
      }

      // After fade-out duration, show the new screen
      const FADE_DURATION_MS = 300;
      setTimeout(() => {
        // Hide all screens (safety measure)
        for (const [, el] of this.screenElements) {
          el.classList.remove('screen--active');
        }

        // Show the target screen
        const inEl = this.screenElements.get(to);
        if (inEl) {
          inEl.classList.add('screen--active');
        }

        this.transitioning = false;

        // Emit event
        if (from !== null) {
          this.bus.emit({ type: 'screen_changed', from, to });
        }
      }, FADE_DURATION_MS);
    };

    if (this.transitioning) {
      setTimeout(doTransition, 350);
    } else {
      doTransition();
    }
  }

  /**
   * Immediately shows a screen without any fade animation.
   * Useful for the very first screen shown on startup.
   */
  showImmediate(screen: ScreenType): void {
    // Hide all
    for (const [, el] of this.screenElements) {
      el.classList.remove('screen--active');
    }

    const el = this.screenElements.get(screen);
    if (el) {
      el.classList.add('screen--active');
    }

    const from = this.currentScreen;
    this.currentScreen = screen;

    if (from !== null) {
      this.bus.emit({ type: 'screen_changed', from, to: screen });
    }
  }

  /** Returns the currently active screen type, or null if none shown yet. */
  getCurrentScreen(): ScreenType | null {
    return this.currentScreen;
  }

  /** Returns the DOM element for a registered screen, or undefined. */
  getScreenElement(type: ScreenType): HTMLDivElement | undefined {
    return this.screenElements.get(type);
  }
}
