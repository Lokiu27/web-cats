// Time Controller for Openspacemarin
// Requirements: 5.1–5.6, 22.1, 22.3
//
// Manages tick scheduling, game speed multipliers (1x/2x/4x), pause/resume,
// and auto-save triggers. Tick callbacks are invoked by the Game Loop — the
// Time Controller only tracks elapsed time and decides when a tick is due.

import type { ITimeController, IEventBus } from '../types/index.js';
import { ECONOMY } from '../data/economy.js';

export class TimeController implements ITimeController {
  // Tick interval in real milliseconds at 1x speed
  private baseIntervalMs: number;
  // Current speed multiplier
  private speedMultiplier: 1 | 2 | 4;
  // Whether the game is paused
  private paused: boolean;
  // Accumulated real time since the last tick (ms)
  private accumulatedMs: number;
  // Total ticks processed
  private tickCount: number;
  // Registered tick callbacks
  private readonly tickCallbacks: Set<() => void>;
  // Auto-save callback (set externally)
  private autoSaveCallback: (() => void) | null;
  // Event bus for emitting speed/pause events
  private readonly bus: IEventBus;

  constructor(bus: IEventBus) {
    this.bus = bus;
    this.baseIntervalMs = 1000; // default: 1 tick per second
    this.speedMultiplier = 1;
    this.paused = false;
    this.accumulatedMs = 0;
    this.tickCount = 0;
    this.tickCallbacks = new Set();
    this.autoSaveCallback = null;
  }

  // ---------------------------------------------------------------------------
  // ITimeController interface
  // ---------------------------------------------------------------------------

  setSpeed(multiplier: 1 | 2 | 4): void {
    this.speedMultiplier = multiplier;
    this.bus.emit({ type: 'speed_changed', multiplier });
  }

  getSpeed(): number {
    return this.speedMultiplier;
  }

  pause(): void {
    if (!this.paused) {
      this.paused = true;
      this.bus.emit({ type: 'pause_toggled', paused: true });
    }
  }

  resume(): void {
    if (this.paused) {
      this.paused = false;
      // Reset accumulated time so we don't fire a burst of ticks after unpausing
      this.accumulatedMs = 0;
      this.bus.emit({ type: 'pause_toggled', paused: false });
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  /**
   * Returns the effective tick interval in milliseconds at the current speed.
   * e.g., base 1000ms at 2x → 500ms effective interval.
   */
  getTickIntervalMs(): number {
    return this.baseIntervalMs / this.speedMultiplier;
  }

  /**
   * Sets the base tick interval (1, 3, or 5 real seconds at 1x speed).
   * Requirement 5.1.
   */
  setTickInterval(seconds: 1 | 3 | 5): void {
    this.baseIntervalMs = seconds * 1000;
    // Reset accumulator to avoid an immediate tick burst
    this.accumulatedMs = 0;
  }

  /**
   * Register a callback to be invoked on every tick.
   */
  onTick(callback: () => void): void {
    this.tickCallbacks.add(callback);
  }

  /**
   * Remove a previously registered tick callback.
   */
  offTick(callback: () => void): void {
    this.tickCallbacks.delete(callback);
  }

  // ---------------------------------------------------------------------------
  // Auto-save
  // ---------------------------------------------------------------------------

  /**
   * Register a callback to be invoked every AUTO_SAVE_INTERVAL_TICKS ticks.
   * Requirement 5.5.
   */
  onAutoSave(callback: () => void): void {
    this.autoSaveCallback = callback;
  }

  // ---------------------------------------------------------------------------
  // Called by the Game Loop each animation frame
  // ---------------------------------------------------------------------------

  /**
   * Advances the time controller by `deltaMs` real milliseconds.
   * Fires tick callbacks for each tick that has elapsed.
   * Should be called from the requestAnimationFrame loop.
   *
   * @param deltaMs - Real elapsed time since the last frame (ms)
   */
  update(deltaMs: number): void {
    if (this.paused) return;

    this.accumulatedMs += deltaMs;
    const effectiveInterval = this.getTickIntervalMs();

    // Process as many ticks as have accumulated (handles speed-up correctly)
    while (this.accumulatedMs >= effectiveInterval) {
      this.accumulatedMs -= effectiveInterval;
      this.tickCount++;
      this._fireTick();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _fireTick(): void {
    for (const cb of this.tickCallbacks) {
      cb();
    }

    // Auto-save every AUTO_SAVE_INTERVAL_TICKS ticks (Requirement 5.5)
    if (this.tickCount % ECONOMY.AUTO_SAVE_INTERVAL_TICKS === 0 && this.autoSaveCallback) {
      this.autoSaveCallback();
    }
  }
}
