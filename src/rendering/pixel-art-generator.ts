// Pixel Art Generator — programmatic sprite creation for Openspacemarin
// Requirements: 25.1–25.10
// All sprites generated via Canvas pixel manipulation, cached after first creation.
// Uses palettes from src/utils/colors.ts, ≤32 colors per sprite category.

import type {
  IPixelArtGenerator,
  DeskTier,
  CatAppearance,
  AnimationFrame,
  UIElement,
  UIElementState,
  IconType,
  ParticleType,
} from '../types/index.js';
import { COLORS, getDeskTierColors } from '../utils/colors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base tile size for all game sprites (32×32 pixels). */
const BASE_SIZE = 32;

/** Half of BASE_SIZE, used frequently for centering. */
const HALF = BASE_SIZE / 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates an OffscreenCanvas with a 2D context.
 * Returns both so callers don't need to null-check the context.
 */
function makeCanvas(
  w: number,
  h: number,
): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  // Disable image smoothing for crisp pixel art (nearest-neighbor scaling)
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** Draws a single pixel-art "pixel" (a filled rectangle at integer coords). */
function px(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

/** Draws a filled rectangle with optional border. */
function rect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

/** Draws a flat-top hexagon path centered at (cx, cy) with the given radius. */
function hexPath(
  ctx: OffscreenCanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = cx + radius * Math.cos(angle);
    const hy = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
}

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Used for deterministic "random" details in sprites so the same
 * parameters always produce the same sprite.
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple string hash for cache keys and seeded randomness. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}


// ---------------------------------------------------------------------------
// Fur color helpers
// ---------------------------------------------------------------------------

/** Returns the palette shades for a given fur color. */
function furPalette(furColor: CatAppearance['furColor']): string[] {
  return COLORS.cats[furColor] as unknown as string[];
}

// ---------------------------------------------------------------------------
// PixelArtGenerator class
// ---------------------------------------------------------------------------

export class PixelArtGenerator implements IPixelArtGenerator {
  private cache = new Map<string, OffscreenCanvas>();

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  getFromCache(key: string): OffscreenCanvas | null {
    return this.cache.get(key) ?? null;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private _cached(key: string, generator: () => OffscreenCanvas): OffscreenCanvas {
    const existing = this.cache.get(key);
    if (existing) return existing;
    try {
      const canvas = generator();
      this.cache.set(key, canvas);
      return canvas;
    } catch (err) {
      console.error(`[PixelArtGenerator] Sprite generation failed for "${key}":`, err);
      return this._placeholder(key);
    }
  }

  /**
   * Returns a placeholder colored rectangle when sprite generation fails.
   * The placeholder is cached so repeated failures don't keep allocating.
   */
  private _placeholder(key: string): OffscreenCanvas {
    const placeholderKey = `__placeholder__:${key}`;
    const existing = this.cache.get(placeholderKey);
    if (existing) return existing;

    // Determine size from key prefix (best-effort)
    let w = 32;
    let h = 32;
    if (key.startsWith('bg:')) {
      // Background layers are wider
      const parts = key.split(':');
      w = parseInt(parts[2], 10) || 256;
      h = 64;
    } else if (key.startsWith('icon:')) {
      w = 16;
      h = 16;
    } else if (key.startsWith('particle:')) {
      w = 8;
      h = 8;
    } else if (key.startsWith('ui:button')) {
      w = 64;
      h = 24;
    } else if (key.startsWith('ui:panel')) {
      w = 128;
      h = 64;
    } else if (key.startsWith('ui:modal')) {
      w = 192;
      h = 128;
    }

    try {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Magenta placeholder — clearly visible for debugging
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, w, h);
        // Darker cross pattern so it's obviously a placeholder
        ctx.strokeStyle = '#aa00aa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, h);
        ctx.moveTo(w, 0);
        ctx.lineTo(0, h);
        ctx.stroke();
      }

      this.cache.set(placeholderKey, canvas);
      return canvas;
    } catch (err) {
      // OffscreenCanvas itself is unavailable — return a minimal stub
      console.error('[PixelArtGenerator] Cannot create placeholder canvas:', err);
      const stub = { width: w, height: h } as unknown as OffscreenCanvas;
      this.cache.set(placeholderKey, stub);
      return stub;
    }
  }

  // -------------------------------------------------------------------------
  // Hex cell sprites (32×32)
  // Requirement 25.2
  // -------------------------------------------------------------------------

  generateHexSprite(state: 'empty' | 'occupied' | 'highlighted'): OffscreenCanvas {
    return this._cached(`hex:${state}`, () => {
      const { canvas, ctx } = makeCanvas(BASE_SIZE, BASE_SIZE);
      const cx = HALF;
      const cy = HALF;
      const r = HALF - 2;

      // Fill
      hexPath(ctx, cx, cy, r);
      switch (state) {
        case 'empty':
          ctx.fillStyle = 'rgba(26, 26, 46, 0.55)';
          break;
        case 'occupied':
          ctx.fillStyle = COLORS.office.floor[2]; // '#0f3460'
          break;
        case 'highlighted':
          ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
          break;
      }
      ctx.fill();

      // Stroke
      hexPath(ctx, cx, cy, r);
      ctx.strokeStyle =
        state === 'highlighted'
          ? COLORS.ui.gold[0]
          : state === 'occupied'
            ? COLORS.ui.primary[3]
            : COLORS.office.wall[1];
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner highlight for depth
      if (state === 'occupied') {
        hexPath(ctx, cx, cy - 1, r - 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      return canvas;
    });
  }

  // -------------------------------------------------------------------------
  // Hex floor tile
  // -------------------------------------------------------------------------

  generateHexFloorTile(): OffscreenCanvas {
    return this._cached('hex-floor-tile', () => {
      const { canvas, ctx } = makeCanvas(64, 64);

      // Base floor
      ctx.fillStyle = COLORS.office.floor[1];
      ctx.fillRect(0, 0, 64, 64);

      // Grid lines
      ctx.strokeStyle = COLORS.office.floor[3];
      ctx.lineWidth = 1;
      for (let x = 0; x < 64; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 64);
        ctx.stroke();
      }
      for (let y = 0; y < 64; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(64, y);
        ctx.stroke();
      }

      return canvas;
    });
  }

  // -------------------------------------------------------------------------
  // Desk sprites (32×32) — 4 tiers with increasing detail
  // Requirement 25.3
  // -------------------------------------------------------------------------

  generateDeskSprite(tier: DeskTier): OffscreenCanvas {
    return this._cached(`desk:${tier}`, () => {
      const { canvas, ctx } = makeCanvas(BASE_SIZE, BASE_SIZE);
      const colors = getDeskTierColors(tier);

      // Desk surface (table top) — isometric rectangle
      const topY = 14;
      const deskH = 6;
      const deskW = 24;
      const deskX = (BASE_SIZE - deskW) / 2;

      // Table legs
      px(ctx, deskX + 2, topY + deskH, 2, 8, colors.primary);
      px(ctx, deskX + deskW - 4, topY + deskH, 2, 8, colors.primary);

      // Table top
      rect(ctx, deskX, topY, deskW, deskH, colors.secondary, colors.primary);

      // Top surface highlight
      px(ctx, deskX + 1, topY + 1, deskW - 2, 1, 'rgba(255,255,255,0.15)');

      // Tier-specific details
      if (tier === 'improved' || tier === 'modern' || tier === 'premium') {
        // Monitor
        const monW = 8;
        const monH = 6;
        const monX = HALF - monW / 2;
        const monY = topY - monH;
        rect(ctx, monX, monY, monW, monH, '#1a1a2e', colors.accent);
        // Screen glow
        px(ctx, monX + 1, monY + 1, monW - 2, monH - 2, '#2244aa');
        // Monitor stand
        px(ctx, HALF - 1, topY - 1, 2, 2, colors.primary);
      }

      if (tier === 'modern' || tier === 'premium') {
        // Second monitor
        const mon2X = HALF + 5;
        const mon2Y = topY - 5;
        rect(ctx, mon2X, mon2Y, 6, 5, '#1a1a2e', colors.accent);
        px(ctx, mon2X + 1, mon2Y + 1, 4, 3, '#224488');
      }

      if (tier === 'premium') {
        // Desk lamp
        px(ctx, deskX + 1, topY - 3, 2, 3, colors.accent);
        px(ctx, deskX, topY - 4, 4, 1, COLORS.ui.gold[0]);
        // Plant pot
        px(ctx, deskX + deskW - 4, topY - 3, 3, 3, '#006c27');
        px(ctx, deskX + deskW - 3, topY - 5, 1, 2, '#00a843');
        // Gold trim on desk edge
        px(ctx, deskX, topY + deskH - 1, deskW, 1, COLORS.ui.gold[1]);
      }

      return canvas;
    });
  }

  // -------------------------------------------------------------------------
  // Desk glow overlay (for premium tier)
  // Requirement 9.3
  // -------------------------------------------------------------------------

  generateDeskGlow(tier: DeskTier): OffscreenCanvas {
    return this._cached(`desk-glow:${tier}`, () => {
      const { canvas, ctx } = makeCanvas(BASE_SIZE, BASE_SIZE);

      if (tier === 'premium') {
        // Radial gold glow
        const grad = ctx.createRadialGradient(HALF, HALF, 2, HALF, HALF, HALF);
        grad.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
        grad.addColorStop(0.5, 'rgba(255, 215, 0, 0.1)');
        grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
      } else if (tier === 'modern') {
        // Subtle purple glow
        const grad = ctx.createRadialGradient(HALF, HALF, 2, HALF, HALF, HALF);
        grad.addColorStop(0, 'rgba(83, 52, 131, 0.2)');
        grad.addColorStop(1, 'rgba(83, 52, 131, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, BASE_SIZE, BASE_SIZE);
      }

      return canvas;
    });
  }


  // -------------------------------------------------------------------------
  // Cat sprites (32×32) — layered compositing
  // Requirement 25.4, 25.10
  // Body → fur color → pattern → expression → accessory, per animation frame
  // Idle: 2–3 frames, Working: 3–4 frames
  // -------------------------------------------------------------------------

  generateCatSprite(appearance: CatAppearance, frame: AnimationFrame): OffscreenCanvas {
    const key = `cat:${appearance.furColor}:${appearance.pattern}:${appearance.expression}:${appearance.accessory}:${appearance.pose}:${frame.action}:${frame.frame}`;
    return this._cached(key, () => {
      const { canvas, ctx } = makeCanvas(BASE_SIZE, BASE_SIZE);
      const pal = furPalette(appearance.furColor);

      // Animation offsets
      const idleFrames = 3;
      const workFrames = 4;
      const maxFrame =
        frame.action === 'idle' ? idleFrames : workFrames;
      const f = frame.frame % maxFrame;

      // Breathing / bobbing offset for idle
      const bobY = frame.action === 'idle' ? (f === 1 ? -1 : 0) : 0;
      // Working arm offset
      const armDx = frame.action === 'working' ? (f % 2 === 0 ? 0 : 1) : 0;

      // Pose offset (leaning shifts body right and tilts)
      const leanX = appearance.pose === 'leaning' ? 2 : 0;

      // --- Layer 1: Body shape ---
      const bodyX = 10 + leanX;
      const bodyY = 8 + bobY;
      const bodyW = 12;
      const bodyH = 16;

      // Torso
      rect(ctx, bodyX, bodyY + 4, bodyW, bodyH - 4, pal[0]);
      // Head (slightly wider)
      rect(ctx, bodyX - 1, bodyY, bodyW + 2, 7, pal[0]);

      // --- Layer 2: Fur color fill (already done via pal[0]) ---
      // Lighter belly
      px(ctx, bodyX + 2, bodyY + 8, bodyW - 4, 6, pal[2]);

      // --- Layer 3: Pattern overlay ---
      this._drawCatPattern(ctx, appearance.pattern, bodyX, bodyY, bodyW, bodyH, pal);

      // --- Layer 4: Ears ---
      // Left ear
      px(ctx, bodyX, bodyY - 2, 3, 3, pal[0]);
      px(ctx, bodyX + 1, bodyY - 1, 1, 1, pal[4]); // inner ear
      // Right ear
      px(ctx, bodyX + bodyW - 2, bodyY - 2, 3, 3, pal[0]);
      px(ctx, bodyX + bodyW - 1, bodyY - 1, 1, 1, pal[4]);

      // --- Layer 5: Expression (eyes + mouth) ---
      this._drawCatExpression(ctx, appearance.expression, bodyX, bodyY, bodyW, f);

      // --- Layer 6: Arms ---
      // Left arm
      px(ctx, bodyX - 1, bodyY + 7 + armDx, 2, 5, pal[1]);
      // Right arm
      px(ctx, bodyX + bodyW - 1, bodyY + 7 - armDx, 2, 5, pal[1]);

      // --- Layer 7: Tail ---
      if (appearance.pose === 'upright') {
        px(ctx, bodyX + bodyW, bodyY + bodyH - 2, 2, 1, pal[1]);
        px(ctx, bodyX + bodyW + 2, bodyY + bodyH - 3, 1, 2, pal[1]);
        px(ctx, bodyX + bodyW + 3, bodyY + bodyH - 5, 1, 3, pal[0]);
      } else {
        // Leaning tail goes down
        px(ctx, bodyX - 2, bodyY + bodyH - 1, 1, 2, pal[1]);
        px(ctx, bodyX - 3, bodyY + bodyH + 1, 1, 2, pal[0]);
      }

      // --- Layer 8: Accessory ---
      this._drawCatAccessory(ctx, appearance.accessory, bodyX, bodyY, bodyW);

      return canvas;
    });
  }

  /** Draws fur pattern overlay on the cat body. */
  private _drawCatPattern(
    ctx: OffscreenCanvasRenderingContext2D,
    pattern: CatAppearance['pattern'],
    bx: number,
    by: number,
    bw: number,
    bh: number,
    pal: string[],
  ): void {
    switch (pattern) {
      case 'solid':
        // No pattern overlay needed
        break;
      case 'spotted': {
        const dark = pal[5] ?? pal[3];
        px(ctx, bx + 2, by + 5, 2, 2, dark);
        px(ctx, bx + bw - 4, by + 7, 2, 2, dark);
        px(ctx, bx + 4, by + 12, 2, 2, dark);
        break;
      }
      case 'striped': {
        const stripe = pal[3];
        for (let i = 0; i < 3; i++) {
          px(ctx, bx + 1, by + 5 + i * 4, bw - 2, 1, stripe);
        }
        break;
      }
      case 'gradient': {
        // Gradient from dark at top to light at bottom
        const steps = 4;
        const stepH = Math.floor(bh / steps);
        for (let i = 0; i < steps; i++) {
          const shade = pal[Math.min(i + 1, pal.length - 1)];
          ctx.fillStyle = shade;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(bx, by + 4 + i * stepH, bw, stepH);
        }
        ctx.globalAlpha = 1;
        break;
      }
    }
  }

  /** Draws the cat's facial expression (eyes and mouth). */
  private _drawCatExpression(
    ctx: OffscreenCanvasRenderingContext2D,
    expression: CatAppearance['expression'],
    bx: number,
    by: number,
    bw: number,
    _frame: number,
  ): void {
    const eyeY = by + 2;
    const leftEyeX = bx + 3;
    const rightEyeX = bx + bw - 4;
    const mouthY = by + 5;
    const mouthX = bx + Math.floor(bw / 2) - 1;

    switch (expression) {
      case 'focused':
        // Determined eyes — small dots
        px(ctx, leftEyeX, eyeY, 2, 2, '#1a1a1a');
        px(ctx, rightEyeX, eyeY, 2, 2, '#1a1a1a');
        // Pupils
        px(ctx, leftEyeX, eyeY + 1, 1, 1, '#ffffff');
        px(ctx, rightEyeX + 1, eyeY + 1, 1, 1, '#ffffff');
        // Neutral mouth
        px(ctx, mouthX, mouthY, 2, 1, '#3a3a3a');
        break;
      case 'smiling':
        // Happy eyes — curved
        px(ctx, leftEyeX, eyeY, 2, 1, '#1a1a1a');
        px(ctx, leftEyeX, eyeY + 1, 1, 1, '#1a1a1a');
        px(ctx, rightEyeX, eyeY, 2, 1, '#1a1a1a');
        px(ctx, rightEyeX + 1, eyeY + 1, 1, 1, '#1a1a1a');
        // Smile
        px(ctx, mouthX - 1, mouthY, 1, 1, '#3a3a3a');
        px(ctx, mouthX, mouthY + 1, 2, 1, '#3a3a3a');
        px(ctx, mouthX + 2, mouthY, 1, 1, '#3a3a3a');
        break;
      case 'serious':
        // Flat eyes — horizontal lines
        px(ctx, leftEyeX, eyeY + 1, 2, 1, '#1a1a1a');
        px(ctx, rightEyeX, eyeY + 1, 2, 1, '#1a1a1a');
        // Flat mouth
        px(ctx, mouthX, mouthY, 3, 1, '#3a3a3a');
        break;
    }
  }

  /** Draws the cat's accessory. */
  private _drawCatAccessory(
    ctx: OffscreenCanvasRenderingContext2D,
    accessory: CatAppearance['accessory'],
    bx: number,
    by: number,
    bw: number,
  ): void {
    switch (accessory) {
      case 'none':
        break;
      case 'glasses': {
        const glassY = by + 2;
        const leftX = bx + 2;
        const rightX = bx + bw - 5;
        // Frames
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftX, glassY, 3, 2);
        ctx.strokeRect(rightX, glassY, 3, 2);
        // Bridge
        px(ctx, leftX + 3, glassY, rightX - leftX - 3, 1, '#4a4a4a');
        // Lens tint
        ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
        ctx.fillRect(leftX, glassY, 3, 2);
        ctx.fillRect(rightX, glassY, 3, 2);
        break;
      }
      case 'tie': {
        const tieX = bx + Math.floor(bw / 2) - 1;
        const tieY = by + 7;
        // Knot
        px(ctx, tieX, tieY, 2, 1, '#e94560');
        // Tie body
        px(ctx, tieX, tieY + 1, 2, 3, '#cc0000');
        // Tip
        px(ctx, tieX, tieY + 4, 2, 1, '#aa0000');
        px(ctx, tieX, tieY + 5, 1, 1, '#880000');
        break;
      }
      case 'bow': {
        const bowX = bx + Math.floor(bw / 2) - 2;
        const bowY = by + 6;
        // Left wing
        px(ctx, bowX, bowY, 2, 2, '#ff6bff');
        // Right wing
        px(ctx, bowX + 3, bowY, 2, 2, '#ff6bff');
        // Center knot
        px(ctx, bowX + 2, bowY, 1, 2, '#cc44cc');
        break;
      }
    }
  }


  // -------------------------------------------------------------------------
  // Cat shadow
  // -------------------------------------------------------------------------

  generateCatShadow(): OffscreenCanvas {
    return this._cached('cat-shadow', () => {
      const { canvas, ctx } = makeCanvas(BASE_SIZE, BASE_SIZE);
      // Elliptical shadow under the cat
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(HALF, BASE_SIZE - 4, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      return canvas;
    });
  }

  // -------------------------------------------------------------------------
  // UI element sprites
  // Requirement 25.5
  // -------------------------------------------------------------------------

  generateUISprite(element: UIElement, state: UIElementState): OffscreenCanvas {
    const key = `ui:${element}:${state}`;
    return this._cached(key, () => {
      switch (element) {
        case 'button':
          return this._generateButton(state);
        case 'panel':
          return this._generatePanel(state);
        case 'progress_bar':
          return this._generateProgressBar(state);
        case 'modal_frame':
          return this._generateModalFrame(state);
        case 'tab':
          return this._generateTab(state);
      }
    });
  }

  private _generateButton(state: UIElementState): OffscreenCanvas {
    const w = 64;
    const h = 24;
    const { canvas, ctx } = makeCanvas(w, h);

    let bg: string;
    let border: string;
    let highlight: string;

    switch (state) {
      case 'normal':
        bg = COLORS.ui.primary[2];
        border = COLORS.ui.primary[3];
        highlight = 'rgba(255,255,255,0.1)';
        break;
      case 'hover':
        bg = COLORS.ui.primary[3];
        border = COLORS.ui.accent[0];
        highlight = 'rgba(255,255,255,0.15)';
        break;
      case 'pressed':
        bg = COLORS.ui.primary[1];
        border = COLORS.ui.primary[3];
        highlight = 'rgba(0,0,0,0.1)';
        break;
      case 'disabled':
        bg = '#3a3a3a';
        border = '#5a5a5a';
        highlight = 'rgba(0,0,0,0.2)';
        break;
      case 'active':
        bg = COLORS.ui.accent[1];
        border = COLORS.ui.accent[0];
        highlight = 'rgba(255,255,255,0.2)';
        break;
    }

    // Button body
    rect(ctx, 0, 0, w, h, bg, border);
    // Top highlight
    px(ctx, 1, 1, w - 2, 1, highlight);
    // Bottom shadow
    px(ctx, 1, h - 2, w - 2, 1, 'rgba(0,0,0,0.2)');

    return canvas;
  }

  private _generatePanel(_state: UIElementState): OffscreenCanvas {
    const w = 128;
    const h = 64;
    const { canvas, ctx } = makeCanvas(w, h);

    // Semi-transparent dark panel
    ctx.fillStyle = 'rgba(26, 26, 46, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = COLORS.ui.primary[3];
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Inner highlight (top edge)
    px(ctx, 1, 1, w - 2, 1, 'rgba(255,255,255,0.05)');

    return canvas;
  }

  private _generateProgressBar(state: UIElementState): OffscreenCanvas {
    const w = 64;
    const h = 8;
    const { canvas, ctx } = makeCanvas(w, h);

    // Background track
    rect(ctx, 0, 0, w, h, '#1a1a2e', '#3a3a5a');

    // Fill (50% for the sprite — actual fill is done at render time)
    const fillColor =
      state === 'active' ? COLORS.ui.success[0] : COLORS.ui.primary[3];
    rect(ctx, 1, 1, Math.floor((w - 2) * 0.5), h - 2, fillColor);

    return canvas;
  }

  private _generateModalFrame(_state: UIElementState): OffscreenCanvas {
    const w = 192;
    const h = 128;
    const { canvas, ctx } = makeCanvas(w, h);

    // Darkened background overlay
    ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
    ctx.fillRect(0, 0, w, h);

    // Border with double-line pixel art style
    ctx.strokeStyle = COLORS.ui.primary[3];
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Inner border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4.5, 4.5, w - 9, h - 9);

    // Corner decorations
    const cornerSize = 4;
    const cornerColor = COLORS.ui.gold[0];
    // Top-left
    px(ctx, 2, 2, cornerSize, 1, cornerColor);
    px(ctx, 2, 2, 1, cornerSize, cornerColor);
    // Top-right
    px(ctx, w - 2 - cornerSize, 2, cornerSize, 1, cornerColor);
    px(ctx, w - 3, 2, 1, cornerSize, cornerColor);
    // Bottom-left
    px(ctx, 2, h - 3, cornerSize, 1, cornerColor);
    px(ctx, 2, h - 2 - cornerSize, 1, cornerSize, cornerColor);
    // Bottom-right
    px(ctx, w - 2 - cornerSize, h - 3, cornerSize, 1, cornerColor);
    px(ctx, w - 3, h - 2 - cornerSize, 1, cornerSize, cornerColor);

    return canvas;
  }

  private _generateTab(state: UIElementState): OffscreenCanvas {
    const w = 48;
    const h = 20;
    const { canvas, ctx } = makeCanvas(w, h);

    const isActive = state === 'active';
    const bg = isActive ? COLORS.ui.primary[3] : COLORS.ui.primary[1];
    const border = isActive ? COLORS.ui.accent[0] : COLORS.ui.primary[2];

    // Tab body (no bottom border when active)
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    // Top
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, 1);
    ctx.lineTo(w - 1, 1);
    ctx.lineTo(w - 1, h);
    ctx.stroke();

    if (!isActive) {
      // Bottom border for inactive tabs
      px(ctx, 0, h - 1, w, 1, border);
    }

    // Top highlight
    if (isActive) {
      px(ctx, 1, 2, w - 2, 1, COLORS.ui.accent[0]);
    }

    return canvas;
  }

  // -------------------------------------------------------------------------
  // Icon sprites (16×16)
  // Requirement 25.5
  // -------------------------------------------------------------------------

  generateIcon(type: IconType): OffscreenCanvas {
    return this._cached(`icon:${type}`, () => {
      const size = 16;
      const { canvas, ctx } = makeCanvas(size, size);
      const c = size / 2;

      switch (type) {
        case 'currency':
          // Gold coin
          ctx.fillStyle = COLORS.ui.gold[0];
          ctx.beginPath();
          ctx.arc(c, c, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.ui.gold[2];
          ctx.beginPath();
          ctx.arc(c, c, 4, 0, Math.PI * 2);
          ctx.fill();
          // $ symbol
          px(ctx, c - 1, c - 2, 2, 5, COLORS.ui.gold[4]);
          px(ctx, c - 2, c - 1, 1, 1, COLORS.ui.gold[4]);
          px(ctx, c + 1, c + 1, 1, 1, COLORS.ui.gold[4]);
          break;

        case 'desk':
          // Mini desk icon
          rect(ctx, 2, 6, 12, 3, COLORS.office.furniture[2], COLORS.office.furniture[0]);
          px(ctx, 3, 9, 2, 4, COLORS.office.furniture[0]);
          px(ctx, 11, 9, 2, 4, COLORS.office.furniture[0]);
          // Monitor
          rect(ctx, 5, 2, 6, 4, '#1a1a2e', '#4a5a8a');
          px(ctx, 6, 3, 4, 2, '#2244aa');
          break;

        case 'achievement_star':
          // 5-pointed star
          ctx.fillStyle = COLORS.ui.gold[0];
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const innerAngle = outerAngle + Math.PI / 5;
            const ox = c + 6 * Math.cos(outerAngle);
            const oy = c + 6 * Math.sin(outerAngle);
            const ix = c + 3 * Math.cos(innerAngle);
            const iy = c + 3 * Math.sin(innerAngle);
            if (i === 0) ctx.moveTo(ox, oy);
            else ctx.lineTo(ox, oy);
            ctx.lineTo(ix, iy);
          }
          ctx.closePath();
          ctx.fill();
          break;

        case 'settings_gear':
          // Gear shape
          ctx.fillStyle = COLORS.ui.primary[5]; // white
          ctx.beginPath();
          ctx.arc(c, c, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.ui.primary[2];
          ctx.beginPath();
          ctx.arc(c, c, 3, 0, Math.PI * 2);
          ctx.fill();
          // Teeth
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const tx = c + 6 * Math.cos(angle) - 1;
            const ty = c + 6 * Math.sin(angle) - 1;
            px(ctx, tx, ty, 2, 2, COLORS.ui.primary[5]);
          }
          break;

        case 'menu':
          // Hamburger menu (3 horizontal lines)
          for (let i = 0; i < 3; i++) {
            px(ctx, 3, 4 + i * 3, 10, 2, COLORS.ui.primary[5]);
          }
          break;

        case 'pause':
          // Two vertical bars
          px(ctx, 4, 3, 3, 10, COLORS.ui.primary[5]);
          px(ctx, 9, 3, 3, 10, COLORS.ui.primary[5]);
          break;

        case 'play':
          // Triangle pointing right
          ctx.fillStyle = COLORS.ui.primary[5];
          ctx.beginPath();
          ctx.moveTo(4, 2);
          ctx.lineTo(13, c);
          ctx.lineTo(4, 14);
          ctx.closePath();
          ctx.fill();
          break;
      }

      return canvas;
    });
  }


  // -------------------------------------------------------------------------
  // Particle sprites
  // Requirement 25.6
  // -------------------------------------------------------------------------

  generateParticleSprite(type: ParticleType): OffscreenCanvas {
    return this._cached(`particle:${type}`, () => {
      const size = 8;
      const { canvas, ctx } = makeCanvas(size, size);
      const c = size / 2;

      switch (type) {
        case 'coin':
          // Tiny gold coin
          ctx.fillStyle = COLORS.ui.gold[0];
          ctx.beginPath();
          ctx.arc(c, c, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.ui.gold[2];
          ctx.beginPath();
          ctx.arc(c, c, 2, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'upgrade_sparkle':
          // 4-pointed sparkle
          ctx.fillStyle = COLORS.effects.sparkle[0];
          // Vertical
          px(ctx, c - 0.5, 0, 1, size, COLORS.effects.sparkle[0]);
          // Horizontal
          px(ctx, 0, c - 0.5, size, 1, COLORS.effects.sparkle[0]);
          // Center bright
          px(ctx, c - 1, c - 1, 2, 2, COLORS.effects.sparkle[1]);
          break;

        case 'confetti':
          // Small colored rectangle (random-ish via deterministic pattern)
          ctx.fillStyle = COLORS.effects.confetti[0];
          ctx.fillRect(1, 1, 4, 6);
          // Highlight
          px(ctx, 1, 1, 4, 1, 'rgba(255,255,255,0.3)');
          break;

        case 'glow':
          // Soft radial glow
          const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
          grad.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
          grad.addColorStop(0.5, 'rgba(255, 255, 100, 0.2)');
          grad.addColorStop(1, 'rgba(255, 255, 0, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, size, size);
          break;
      }

      return canvas;
    });
  }

  // -------------------------------------------------------------------------
  // Background layers
  // Requirement 25.1
  // -------------------------------------------------------------------------

  generateBackgroundLayer(
    layer: 'wall' | 'floor' | 'decorations',
    width: number,
  ): OffscreenCanvas {
    // Background tiles are not cached by the standard key because width varies.
    // Use a specific cache key including width.
    const key = `bg:${layer}:${width}`;
    return this._cached(key, () => {
      const h = layer === 'wall' ? 64 : 64;
      const { canvas, ctx } = makeCanvas(width, h);
      const rng = seededRandom(hashStr(key));

      switch (layer) {
        case 'wall': {
          // Office wall with subtle brick/panel pattern
          ctx.fillStyle = COLORS.office.wall[1];
          ctx.fillRect(0, 0, width, h);

          // Horizontal panel lines
          ctx.strokeStyle = COLORS.office.wall[0];
          ctx.lineWidth = 1;
          for (let y = 0; y < h; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Vertical panel lines (offset every other row)
          for (let y = 0; y < h; y += 16) {
            const offset = (y / 16) % 2 === 0 ? 0 : 12;
            for (let x = offset; x < width; x += 24) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + 16);
              ctx.stroke();
            }
          }

          // Subtle noise for texture
          for (let i = 0; i < 20; i++) {
            const nx = Math.floor(rng() * width);
            const ny = Math.floor(rng() * h);
            px(ctx, nx, ny, 1, 1, 'rgba(255,255,255,0.03)');
          }
          break;
        }

        case 'floor': {
          // Office floor tiles
          ctx.fillStyle = COLORS.office.floor[1];
          ctx.fillRect(0, 0, width, h);

          // Tile grid
          ctx.strokeStyle = COLORS.office.floor[3];
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Diagonal shading
          ctx.strokeStyle = COLORS.office.floor[4];
          ctx.lineWidth = 0.5;
          for (let i = -h; i < width + h; i += 24) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + h, h);
            ctx.stroke();
          }
          break;
        }

        case 'decorations': {
          // Sparse office decorations (potted plants, water cooler outlines)
          // Transparent base — decorations are overlaid
          // Place a few small decorative elements at deterministic positions
          for (let x = 20; x < width; x += 80 + Math.floor(rng() * 40)) {
            const kind = rng();
            if (kind < 0.4) {
              // Potted plant
              px(ctx, x, h - 12, 6, 4, COLORS.office.furniture[2]);
              px(ctx, x + 1, h - 18, 4, 6, '#006c27');
              px(ctx, x + 2, h - 20, 2, 2, '#00a843');
            } else if (kind < 0.7) {
              // Water cooler
              px(ctx, x, h - 16, 5, 12, '#b3bac6');
              px(ctx, x + 1, h - 18, 3, 2, '#4d96ff');
              px(ctx, x, h - 4, 5, 4, '#7d8a96');
            } else {
              // Filing cabinet
              px(ctx, x, h - 14, 6, 14, COLORS.office.furniture[1]);
              px(ctx, x + 2, h - 12, 2, 1, '#8a7768');
              px(ctx, x + 2, h - 7, 2, 1, '#8a7768');
              px(ctx, x + 2, h - 2, 2, 1, '#8a7768');
            }
          }
          break;
        }
      }

      return canvas;
    });
  }
}
