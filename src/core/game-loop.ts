// Game Loop for Openspacemarin
// Requirements: 5.1–5.6, 22.1, 22.3
//
// Drives the requestAnimationFrame render loop. Each frame:
//   1. Calculates delta time since the last frame (capped to avoid spiral-of-death)
//   2. Advances the Time Controller (which fires tick callbacks when due)
//   3. Calls the registered render callback with the current canvas context
//
// Single-canvas rendering — no double-buffering needed at this scale.

import type { IGameLoop } from '../types/index.js';
import type { TimeController } from './time-controller.js';

// Maximum delta time per frame (ms). Caps the simulation step when the tab
// is backgrounded or the device is slow, preventing a burst of ticks on resume.
const MAX_DELTA_MS = 100;

export type RenderCallback = (ctx: CanvasRenderingContext2D, deltaMs: number) => void;

export class GameLoop implements IGameLoop {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly timeController: TimeController;
  private readonly renderCallback: RenderCallback;

  private rafHandle: number | null = null;
  private lastTimestamp: number | null = null;
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;
  private currentFps: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    timeController: TimeController,
    renderCallback: RenderCallback,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context from canvas');
    }
    this.ctx = ctx;
    this.timeController = timeController;
    this.renderCallback = renderCallback;
  }

  // ---------------------------------------------------------------------------
  // IGameLoop interface
  // ---------------------------------------------------------------------------

  /**
   * Starts the requestAnimationFrame loop.
   * Safe to call multiple times — subsequent calls are no-ops if already running.
   */
  start(): void {
    if (this.rafHandle !== null) return;
    this.lastTimestamp = null;
    this.rafHandle = requestAnimationFrame(this._frame);
  }

  /**
   * Stops the loop and cancels the pending animation frame.
   */
  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastTimestamp = null;
  }

  /**
   * Returns true if the Time Controller is paused.
   * The render loop itself keeps running during pause (so the UI stays responsive).
   */
  isPaused(): boolean {
    return this.timeController.isPaused();
  }

  /**
   * Returns the measured frames-per-second over the last second.
   */
  getFrameRate(): number {
    return this.currentFps;
  }

  // ---------------------------------------------------------------------------
  // Canvas resize
  // ---------------------------------------------------------------------------

  /**
   * Resizes the canvas to match the current CSS display size.
   * Should be called on window resize events.
   * Uses nearest-neighbor scaling for pixel-art crispness (Requirement 21.6).
   */
  resizeToDisplay(): void {
    const dpr = window.devicePixelRatio ?? 1;
    const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
    const displayHeight = Math.floor(this.canvas.clientHeight * dpr);

    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;

      // Nearest-neighbor scaling preserves pixel-art crispness
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private frame loop
  // ---------------------------------------------------------------------------

  private readonly _frame = (timestamp: number): void => {
    // Schedule the next frame immediately so we keep running even if this
    // frame throws (errors are caught below).
    this.rafHandle = requestAnimationFrame(this._frame);

    try {
      // Calculate delta time
      const deltaMs = this.lastTimestamp !== null
        ? Math.min(timestamp - this.lastTimestamp, MAX_DELTA_MS)
        : 0;
      this.lastTimestamp = timestamp;

      // Advance tick scheduling
      this.timeController.update(deltaMs);

      // Render the current frame
      this.renderCallback(this.ctx, deltaMs);

      // FPS tracking
      this._trackFps(deltaMs);
    } catch (err) {
      console.error('[GameLoop] Error in frame:', err);
    }
  };

  private _trackFps(deltaMs: number): void {
    this.frameCount++;
    this.fpsAccumulator += deltaMs;

    if (this.fpsAccumulator >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / this.fpsAccumulator);
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }
  }
}
