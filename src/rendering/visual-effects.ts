// Visual Effects System for Openspacemarin
// Requirements: 3.7, 16.1–16.3, 16.6
//
// Manages a simple particle system for:
//   - Upgrade sparkles (colored pixel bursts at desk location)
//   - Floating currency numbers (+N drifting upward)
//   - Achievement confetti (screen-wide celebration)
//
// Design principles:
//   - Object pooling: particles are recycled from a fixed-size pool to avoid
//     GC pressure during gameplay.
//   - Each particle has: position, velocity, lifetime, alpha, and a draw fn.
//   - Updated per frame; dead particles are returned to the pool.
//   - Uses easing functions from src/utils/easing.ts for smooth motion.

import type { IPixelArtGenerator, ParticleType } from '../types/index.js';
import { COLORS } from '../utils/colors.js';
import { Easing } from '../utils/easing.js';

// ---------------------------------------------------------------------------
// Particle data structure
// ---------------------------------------------------------------------------

interface Particle {
  /** Whether this slot is currently active. */
  active: boolean;

  /** World-space position (screen pixels). */
  x: number;
  y: number;

  /** Velocity in pixels per millisecond. */
  vx: number;
  vy: number;

  /** Total lifetime in milliseconds. */
  lifetime: number;

  /** Elapsed time in milliseconds. */
  elapsed: number;

  /** Particle type — determines draw behavior. */
  type: ParticleType | 'float_text';

  /** For float_text: the string to render. */
  text?: string;

  /** For coin/sparkle/confetti: color index into the palette. */
  colorIndex: number;

  /** Sprite size in pixels. */
  size: number;

  /** Rotation in radians (for confetti). */
  rotation: number;

  /** Rotation velocity in radians/ms. */
  rotationVelocity: number;
}

// ---------------------------------------------------------------------------
// Pool configuration
// ---------------------------------------------------------------------------

/** Maximum number of simultaneously active particles. */
const POOL_SIZE = 256;

// ---------------------------------------------------------------------------
// Particle spawn helpers
// ---------------------------------------------------------------------------

/** Returns a random float in [min, max). */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// VisualEffects class
// ---------------------------------------------------------------------------

export class VisualEffects {
  private readonly pool: Particle[] = [];
  private readonly pixelArt: IPixelArtGenerator | null;

  /** Cached sprite canvases for particle types. */
  private readonly spriteCache = new Map<string, OffscreenCanvas>();

  constructor(pixelArt: IPixelArtGenerator | null = null) {
    this.pixelArt = pixelArt;
    // Pre-allocate the pool
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(this._makeParticle());
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Spawns upgrade sparkle particles at the given screen position.
   * Requirement 3.7, 16.1
   *
   * @param x       - Screen x of the desk center
   * @param y       - Screen y of the desk center
   * @param count   - Number of sparkle particles (default 12)
   */
  spawnUpgradeSparkles(x: number, y: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      if (!p) return;

      const angle = rand(0, Math.PI * 2);
      const speed = rand(0.04, 0.12); // px/ms

      p.active = true;
      p.x = x + rand(-6, 6);
      p.y = y + rand(-6, 6);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 0.06; // slight upward bias
      p.lifetime = rand(400, 700);
      p.elapsed = 0;
      p.type = 'upgrade_sparkle';
      p.colorIndex = Math.floor(rand(0, COLORS.effects.sparkle.length));
      p.size = rand(2, 5);
      p.rotation = 0;
      p.rotationVelocity = 0;
    }
  }

  /**
   * Spawns a floating currency number at the given screen position.
   * Requirement 16.2
   *
   * @param x      - Screen x (typically above the desk)
   * @param y      - Screen y
   * @param amount - Currency amount to display (e.g., "+5")
   */
  spawnFloatingCurrency(x: number, y: number, amount: number): void {
    const p = this._acquire();
    if (!p) return;

    p.active = true;
    p.x = x + rand(-8, 8);
    p.y = y;
    p.vx = rand(-0.01, 0.01);
    p.vy = -0.05; // drift upward
    p.lifetime = 900;
    p.elapsed = 0;
    p.type = 'float_text';
    p.text = `+${amount % 1 === 0 ? amount : amount.toFixed(1)}`;
    p.colorIndex = 0;
    p.size = 10; // font size
    p.rotation = 0;
    p.rotationVelocity = 0;
  }

  /**
   * Spawns achievement confetti across the screen.
   * Requirement 16.3
   *
   * @param screenWidth  - Canvas width (confetti spawns across the top)
   * @param screenHeight - Canvas height
   * @param count        - Number of confetti pieces (default 60)
   */
  spawnAchievementConfetti(
    screenWidth: number,
    screenHeight: number,
    count = 60,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      if (!p) return;

      p.active = true;
      p.x = rand(0, screenWidth);
      p.y = rand(-20, 0); // start just above the canvas
      p.vx = rand(-0.03, 0.03);
      p.vy = rand(0.04, 0.10); // fall downward
      p.lifetime = rand(1500, 3000);
      p.elapsed = 0;
      p.type = 'confetti';
      p.colorIndex = Math.floor(rand(0, COLORS.effects.confetti.length));
      p.size = rand(4, 9);
      p.rotation = rand(0, Math.PI * 2);
      p.rotationVelocity = rand(-0.003, 0.003);

      void screenHeight; // used implicitly via lifetime
    }
  }

  /**
   * Spawns coin particles at the given position (currency generation tick).
   * Requirement 16.2
   */
  spawnCoinParticle(x: number, y: number): void {
    const p = this._acquire();
    if (!p) return;

    p.active = true;
    p.x = x + rand(-4, 4);
    p.y = y;
    p.vx = rand(-0.02, 0.02);
    p.vy = rand(-0.08, -0.04);
    p.lifetime = 600;
    p.elapsed = 0;
    p.type = 'coin';
    p.colorIndex = Math.floor(rand(0, COLORS.ui.gold.length));
    p.size = rand(3, 6);
    p.rotation = 0;
    p.rotationVelocity = rand(-0.004, 0.004);
  }

  /**
   * Updates all active particles by `deltaMs` milliseconds.
   * Dead particles are returned to the pool.
   * Call this once per frame from the game loop.
   */
  update(deltaMs: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;

      p.elapsed += deltaMs;
      if (p.elapsed >= p.lifetime) {
        p.active = false;
        continue;
      }

      // Move
      p.x += p.vx * deltaMs;
      p.y += p.vy * deltaMs;
      p.rotation += p.rotationVelocity * deltaMs;

      // Apply gravity to confetti
      if (p.type === 'confetti') {
        p.vy += 0.00005 * deltaMs; // gentle gravity
      }
    }
  }

  /**
   * Draws all active particles onto `ctx`.
   * Call this once per frame after `update()`.
   * Requirement 16.1–16.3, 16.6
   */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const p of this.pool) {
      if (!p.active) continue;

      const t = p.elapsed / p.lifetime; // 0 → 1
      const alpha = this._particleAlpha(p.type, t);
      if (alpha <= 0) continue;

      ctx.globalAlpha = alpha;

      switch (p.type) {
        case 'upgrade_sparkle':
          this._drawSparkle(ctx, p, t);
          break;
        case 'float_text':
          this._drawFloatText(ctx, p, t);
          break;
        case 'confetti':
          this._drawConfetti(ctx, p);
          break;
        case 'coin':
          this._drawCoin(ctx, p, t);
          break;
        case 'glow':
          this._drawGlow(ctx, p, t);
          break;
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * Returns the number of currently active particles.
   * Useful for performance monitoring.
   */
  getActiveCount(): number {
    return this.pool.filter(p => p.active).length;
  }

  /**
   * Deactivates all particles immediately.
   */
  clear(): void {
    for (const p of this.pool) {
      p.active = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private draw helpers
  // ---------------------------------------------------------------------------

  /**
   * Draws a sparkle pixel burst.
   * Uses the pixel art generator sprite if available, otherwise draws a
   * simple colored square.
   */
  private _drawSparkle(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    t: number,
  ): void {
    // Scale up then down: peak at t=0.3
    const scale = t < 0.3
      ? Easing.easeOutBack(t / 0.3)
      : Easing.easeOutQuad(1 - (t - 0.3) / 0.7);
    const size = Math.max(1, p.size * scale);

    if (this.pixelArt) {
      const sprite = this._getParticleSprite('upgrade_sparkle');
      if (sprite) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(size / sprite.width, size / sprite.height);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        ctx.restore();
        return;
      }
    }

    // Fallback: colored pixel square
    const color = COLORS.effects.sparkle[p.colorIndex % COLORS.effects.sparkle.length];
    ctx.fillStyle = color;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }

  /**
   * Draws a floating "+N" currency text.
   * Drifts upward and fades out.
   */
  private _drawFloatText(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    _t: number,
  ): void {
    ctx.font = `bold ${p.size}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Gold color with dark shadow for readability
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(p.text ?? '', p.x + 1, p.y + 1);
    ctx.fillStyle = COLORS.ui.gold[0]; // '#ffd700'
    ctx.fillText(p.text ?? '', p.x, p.y);
  }

  /**
   * Draws a confetti rectangle with rotation.
   */
  private _drawConfetti(ctx: CanvasRenderingContext2D, p: Particle): void {
    const color = COLORS.effects.confetti[p.colorIndex % COLORS.effects.confetti.length];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }

  /**
   * Draws a coin particle — a small gold circle that scales and fades.
   */
  private _drawCoin(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    t: number,
  ): void {
    if (this.pixelArt) {
      const sprite = this._getParticleSprite('coin');
      if (sprite) {
        const scale = Easing.easeOutQuad(1 - t) * 0.8 + 0.2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(scale, scale);
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        ctx.restore();
        return;
      }
    }

    // Fallback: gold circle
    const color = COLORS.ui.gold[p.colorIndex % COLORS.ui.gold.length];
    const radius = Math.max(1, p.size * (1 - t * 0.5));
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /**
   * Draws a glow particle — a radial gradient circle.
   */
  private _drawGlow(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    t: number,
  ): void {
    const radius = p.size * (1 + t * 2); // expands outward
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    const color = COLORS.effects.glow[p.colorIndex % COLORS.effects.glow.length];
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // ---------------------------------------------------------------------------
  // Alpha curves per particle type
  // ---------------------------------------------------------------------------

  /**
   * Returns the alpha (0–1) for a particle at normalized time `t` (0→1).
   */
  private _particleAlpha(type: Particle['type'], t: number): number {
    switch (type) {
      case 'upgrade_sparkle':
        // Fade in quickly, hold, then fade out
        if (t < 0.2) return Easing.easeOutQuad(t / 0.2);
        return Easing.easeOutQuad(1 - (t - 0.2) / 0.8);

      case 'float_text':
        // Hold for 60%, then fade out
        if (t < 0.6) return 1;
        return Easing.easeOutQuad(1 - (t - 0.6) / 0.4);

      case 'confetti':
        // Fade in at start, fade out at end
        if (t < 0.1) return t / 0.1;
        if (t > 0.8) return (1 - t) / 0.2;
        return 1;

      case 'coin':
        return Easing.easeOutQuad(1 - t);

      case 'glow':
        return (1 - t) * 0.7;

      default:
        return 1 - t;
    }
  }

  // ---------------------------------------------------------------------------
  // Object pool helpers
  // ---------------------------------------------------------------------------

  /** Creates a blank (inactive) particle for the pool. */
  private _makeParticle(): Particle {
    return {
      active: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      lifetime: 1,
      elapsed: 0,
      type: 'upgrade_sparkle',
      colorIndex: 0,
      size: 4,
      rotation: 0,
      rotationVelocity: 0,
    };
  }

  /**
   * Acquires an inactive particle from the pool.
   * Returns `null` if the pool is exhausted (all slots active).
   */
  private _acquire(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return null; // pool exhausted — silently drop the particle
  }

  // ---------------------------------------------------------------------------
  // Sprite cache helper
  // ---------------------------------------------------------------------------

  /**
   * Returns a cached particle sprite from the pixel art generator.
   * Returns `null` if the generator is unavailable or throws.
   */
  private _getParticleSprite(type: ParticleType): OffscreenCanvas | null {
    if (!this.pixelArt) return null;
    const cached = this.spriteCache.get(type);
    if (cached) return cached;
    try {
      const sprite = this.pixelArt.generateParticleSprite(type);
      this.spriteCache.set(type, sprite);
      return sprite;
    } catch {
      return null;
    }
  }
}
