// Input Handlers for Openspacemarin
// Requirements: 1.4, 1.6, 18.1–18.5, 21.5, 21.6
//
// Normalises mouse, touch, and keyboard input into a unified set of game
// actions. Handles:
//   - Mouse: click, drag (scroll), scroll wheel
//   - Touch: tap, swipe (scroll)
//   - Keyboard: arrow keys for scrolling, Escape for menu/close
//   - Canvas resize on viewport changes (nearest-neighbor scaling)
//   - Debouncing rapid clicks to prevent accidental double-purchases
//
// Design:
//   - All handlers are attached to the canvas element (or window for resize).
//   - The class exposes callback properties that the caller wires up.
//   - Cleanup is handled via `destroy()` which removes all listeners.
//   - Touch and mouse events are unified so the same callbacks fire for both.

import type { HexCoord } from '../types/index.js';
import type { HexGridRenderer } from '../rendering/hex-grid-renderer.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum pixel movement before a mouse/touch press is treated as a drag. */
const DRAG_THRESHOLD_PX = 6;

/** Minimum time (ms) between two accepted click/tap events (debounce). */
const CLICK_DEBOUNCE_MS = 200;

/** Pixels scrolled per keyboard arrow key press. */
const KEYBOARD_SCROLL_STEP = 48;

/** Scroll velocity multiplier for mouse wheel events. */
const WHEEL_SCROLL_MULTIPLIER = 0.8;

/** Scroll velocity multiplier for touch swipe events. */
const TOUCH_SCROLL_MULTIPLIER = 1.0;

// ---------------------------------------------------------------------------
// InputHandlers class
// ---------------------------------------------------------------------------

export class InputHandlers {
  private readonly canvas: HTMLCanvasElement;
  private readonly hexRenderer: HexGridRenderer;

  // ---- Callbacks (wire these up from main.ts) ----

  /** Called when the player clicks/taps an empty hex cell. */
  onEmptyHexClick: (coord: HexCoord) => void = () => undefined;

  /** Called when the player clicks/taps an occupied hex cell. */
  onOccupiedHexClick: (coord: HexCoord) => void = () => undefined;

  /** Called when the player clicks/taps the canvas but not on a valid hex. */
  onCanvasClick: () => void = () => undefined;

  /** Called when the viewport scrolls (dx = pixels scrolled). */
  onScroll: (dx: number) => void = () => undefined;

  // ---- Internal state ----

  /** Whether a pointer drag is in progress. */
  private isDragging = false;

  /** Starting X position of the current drag. */
  private dragStartX = 0;

  /** Last X position seen during a drag (for velocity calculation). */
  private dragLastX = 0;

  /** Timestamp of the last accepted click (for debounce). */
  private lastClickTime = 0;

  /** Whether the primary pointer button is currently held down. */
  private pointerDown = false;

  /** Accumulated drag distance (to distinguish click from drag). */
  private dragDistance = 0;

  /** Bound event handler references (kept for removeEventListener). */
  private readonly _onMouseDown: (e: MouseEvent) => void;
  private readonly _onMouseMove: (e: MouseEvent) => void;
  private readonly _onMouseUp: (e: MouseEvent) => void;
  private readonly _onWheel: (e: WheelEvent) => void;
  private readonly _onTouchStart: (e: TouchEvent) => void;
  private readonly _onTouchMove: (e: TouchEvent) => void;
  private readonly _onTouchEnd: (e: TouchEvent) => void;
  private readonly _onKeyDown: (e: KeyboardEvent) => void;
  private readonly _onResize: () => void;

  // ---- Occupied hex lookup (updated each frame by the caller) ----
  private occupiedCoords = new Set<string>();

  /**
   * @param canvas      - The game canvas element
   * @param hexRenderer - Hex grid renderer (used for coordinate conversion)
   */
  constructor(canvas: HTMLCanvasElement, hexRenderer: HexGridRenderer) {
    this.canvas = canvas;
    this.hexRenderer = hexRenderer;

    // Bind all handlers once so we can remove them later
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onResize = this._handleResize.bind(this);

    this._attachListeners();
    this._handleResize(); // set initial canvas size
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Updates the set of occupied hex coordinates.
   * Call this each frame (or whenever desks change) so click detection knows
   * whether a cell is empty or occupied.
   *
   * @param coords - Array of occupied hex coords from the current game state
   */
  updateOccupiedCoords(coords: Array<{ q: number; r: number }>): void {
    this.occupiedCoords.clear();
    for (const c of coords) {
      this.occupiedCoords.add(`${c.q},${c.r}`);
    }
  }

  /**
   * Removes all event listeners. Call when tearing down the game.
   */
  destroy(): void {
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('resize', this._onResize);
  }

  // ---------------------------------------------------------------------------
  // Canvas resize (Requirements 18.1, 21.5, 21.6)
  // ---------------------------------------------------------------------------

  /**
   * Handles window resize. The game uses a fixed 640×480 canvas centred on
   * the page (see index.html), so no canvas resizing is needed here.
   * We only ensure nearest-neighbor scaling stays enabled after any browser
   * context reset (Requirement 21.6).
   */
  private _handleResize(): void {
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Listener attachment
  // ---------------------------------------------------------------------------

  private _attachListeners(): void {
    // Mouse
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('mouseleave', this._onMouseUp); // treat leave as mouse-up
    this.canvas.addEventListener('wheel', this._onWheel, { passive: true });

    // Touch (Requirements 18.3)
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: true });

    // Keyboard (Requirements 18.2)
    window.addEventListener('keydown', this._onKeyDown);

    // Resize (Requirements 18.1, 18.4)
    window.addEventListener('resize', this._onResize);
  }

  // ---------------------------------------------------------------------------
  // Mouse handlers (Requirements 18.2)
  // ---------------------------------------------------------------------------

  private _handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // left button only
    this.pointerDown = true;
    this.isDragging = false;
    this.dragDistance = 0;
    this.dragStartX = e.clientX;
    this.dragLastX = e.clientX;
  }

  private _handleMouseMove(e: MouseEvent): void {
    if (!this.pointerDown) {
      // Update hover highlight even without dragging
      this._updateHoverHighlight(e.clientX, e.clientY);
      return;
    }

    const dx = e.clientX - this.dragLastX;
    this.dragDistance += Math.abs(e.clientX - this.dragStartX);
    this.dragLastX = e.clientX;

    if (this.dragDistance > DRAG_THRESHOLD_PX) {
      this.isDragging = true;
      // Scroll the viewport (drag left → scroll right, so negate dx)
      this.onScroll(-dx * WHEEL_SCROLL_MULTIPLIER);
      this.hexRenderer.scrollBy(-dx * WHEEL_SCROLL_MULTIPLIER);
    }
  }

  private _handleMouseUp(e: MouseEvent): void {
    if (!this.pointerDown) return;
    this.pointerDown = false;

    if (!this.isDragging) {
      // It was a click, not a drag
      this._handleClick(e.clientX, e.clientY);
    }

    this.isDragging = false;
    this.dragDistance = 0;
  }

  private _handleWheel(e: WheelEvent): void {
    const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    const scrollAmount = dx * WHEEL_SCROLL_MULTIPLIER;
    this.onScroll(scrollAmount);
    this.hexRenderer.scrollBy(scrollAmount);
  }

  // ---------------------------------------------------------------------------
  // Touch handlers (Requirements 18.3)
  // ---------------------------------------------------------------------------

  private touchStartX = 0;
  private touchStartY = 0;
  private touchLastX = 0;
  private touchMoved = false;

  private _handleTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchLastX = touch.clientX;
    this.touchMoved = false;
  }

  private _handleTouchMove(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this.touchLastX;
    const totalDx = Math.abs(touch.clientX - this.touchStartX);
    const totalDy = Math.abs(touch.clientY - this.touchStartY);

    // Only scroll if horizontal movement dominates (prevents scroll during vertical swipe)
    if (totalDx > DRAG_THRESHOLD_PX || totalDy > DRAG_THRESHOLD_PX) {
      this.touchMoved = true;
    }

    if (this.touchMoved && totalDx > totalDy) {
      // Horizontal swipe → scroll
      e.preventDefault(); // prevent page scroll
      const scrollAmount = -dx * TOUCH_SCROLL_MULTIPLIER;
      this.onScroll(scrollAmount);
      this.hexRenderer.scrollBy(scrollAmount);
    }

    this.touchLastX = touch.clientX;
  }

  private _handleTouchEnd(e: TouchEvent): void {
    if (e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];

    if (!this.touchMoved) {
      // It was a tap
      this._handleClick(touch.clientX, touch.clientY);
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard handler (Requirements 18.2)
  // ---------------------------------------------------------------------------

  private _handleKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowRight':
        this.onScroll(KEYBOARD_SCROLL_STEP);
        this.hexRenderer.scrollBy(KEYBOARD_SCROLL_STEP);
        e.preventDefault();
        break;
      case 'ArrowLeft':
        this.onScroll(-KEYBOARD_SCROLL_STEP);
        this.hexRenderer.scrollBy(-KEYBOARD_SCROLL_STEP);
        e.preventDefault();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Unified click/tap handler
  // ---------------------------------------------------------------------------

  /**
   * Handles a confirmed click or tap at the given CSS pixel coordinates.
   * Debounces rapid clicks to prevent accidental double-purchases.
   */
  private _handleClick(clientX: number, clientY: number): void {
    const now = performance.now();
    if (now - this.lastClickTime < CLICK_DEBOUNCE_MS) return;
    this.lastClickTime = now;

    // Convert CSS pixels → logical canvas pixels.
    // The canvas CSS size may differ from its logical pixel size (640×480),
    // so we scale the click position proportionally.
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // DEBUG: remove after fixing click issues
    const coord = this.hexRenderer.screenToHex(x, y);
    const key = coord ? `${coord.q},${coord.r}` : null;
    console.log('[Click]', { logical: [Math.round(x), Math.round(y)], rect: [Math.round(rect.width), Math.round(rect.height)], coord, key, isOccupied: key ? this.occupiedCoords.has(key) : false, occupiedKeys: [...this.occupiedCoords] });

    if (coord === null) {
      this.onCanvasClick();
      return;
    }

    if (this.occupiedCoords.has(key!)) {
      this.onOccupiedHexClick(coord);
    } else {
      // Check neighboring hexes — cat sprites extend beyond their cell center,
      // so a click near a desk might land on an adjacent empty cell.
      const neighbors = [
        { q: coord.q - 1, r: coord.r },
        { q: coord.q + 1, r: coord.r },
        { q: coord.q, r: coord.r - 1 },
        { q: coord.q, r: coord.r + 1 },
        { q: coord.q - 1, r: coord.r - 1 },
        { q: coord.q - 1, r: coord.r + 1 },
        { q: coord.q + 1, r: coord.r - 1 },
        { q: coord.q + 1, r: coord.r + 1 },
      ];
      let found = false;
      for (const n of neighbors) {
        const nKey = `${n.q},${n.r}`;
        if (this.occupiedCoords.has(nKey)) {
          // Check if the click is close enough to this neighbor's screen position
          const nScreen = this.hexRenderer.hexToScreen(n);
          const dx = x - nScreen.x;
          const dy = y - nScreen.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 70) { // within ~70px of a desk center
            this.onOccupiedHexClick(n);
            found = true;
            break;
          }
        }
      }
      if (!found) {
        this.onEmptyHexClick(coord);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Hover highlight
  // ---------------------------------------------------------------------------

  /**
   * Updates the hex grid renderer's highlighted cell based on mouse position.
   * Called on every mousemove (without dragging).
   */
  private _updateHoverHighlight(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const coord = this.hexRenderer.screenToHex(x, y);
    this.hexRenderer.setHighlighted(coord);
  }
}
