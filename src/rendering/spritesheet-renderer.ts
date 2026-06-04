// SpritesheetRenderer — IPixelArtGenerator adapter using loaded sprites for game elements
// Routes hex/desk/cat sprite calls through SpriteLoader (with fallback chain),
// delegates UI/icon/particle/background calls directly to PixelArtGenerator.
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 2.1, 2.5, 6.3, 6.6, 8.2, 8.6

import type {
  IPixelArtGenerator,
  DeskTier,
  CatAppearance,
  AnimationFrame,
  UIElement,
  UIElementState,
  IconType,
  ParticleType,
  FurColor,
  Accessory,
} from '../types/index.js';
import { SpriteLoader, type SpriteManifestEntry } from './sprite-loader.js';
import { PixelArtGenerator } from './pixel-art-generator.js';
import { COLORS } from '../utils/colors.js';

// ---------------------------------------------------------------------------
// SPRITE_MANIFEST — complete list of all 61 game sprites
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
// ---------------------------------------------------------------------------

const FUR_COLORS = ['orange', 'gray', 'white', 'black', 'brown', 'tabby'] as const;
const ACCESSORIES = ['glasses', 'tie', 'bow', 'none'] as const;
const POSES = ['upright', 'leaning'] as const;

/** Complete manifest of all 61 game sprites (hex + desk + cat). */
export const SPRITE_MANIFEST: SpriteManifestEntry[] = [
  // --- 4 hex sprites (100×90 px, priority 'high') ---
  {
    key: 'hex/empty',
    filePath: 'hex/empty.png',
    width: 100,
    height: 90,
    description: 'Empty hex cell — unoccupied platform tile',
    priority: 'high',
  },
  {
    key: 'hex/occupied',
    filePath: 'hex/occupied.png',
    width: 100,
    height: 90,
    description: 'Occupied hex cell — platform tile with a desk on it',
    priority: 'high',
  },
  {
    key: 'hex/highlighted',
    filePath: 'hex/highlighted.png',
    width: 100,
    height: 90,
    description: 'Highlighted hex cell — hovered or selected platform tile',
    priority: 'high',
  },
  {
    key: 'hex/floor',
    filePath: 'hex/floor.png',
    width: 100,
    height: 90,
    description: 'Hex floor background tile — repeating floor pattern',
    priority: 'high',
  },

  // --- 4 desk sprites (90×80 px, priority 'high') ---
  {
    key: 'desk/basic',
    filePath: 'desk/basic.png',
    width: 90,
    height: 80,
    description: 'Basic desk — tier 0–4, simple wooden desk',
    priority: 'high',
  },
  {
    key: 'desk/improved',
    filePath: 'desk/improved.png',
    width: 90,
    height: 80,
    description: 'Improved desk — tier 5–9, desk with monitor',
    priority: 'high',
  },
  {
    key: 'desk/modern',
    filePath: 'desk/modern.png',
    width: 90,
    height: 80,
    description: 'Modern desk — tier 10–19, dual monitor setup',
    priority: 'high',
  },
  {
    key: 'desk/premium',
    filePath: 'desk/premium.png',
    width: 90,
    height: 80,
    description: 'Premium desk — tier 20+, full setup with lamp and plant',
    priority: 'high',
  },

  // --- 4 desk glow sprites (90×80 px, priority 'high') ---
  {
    key: 'desk/basic/glow',
    filePath: 'desk/basic/glow.png',
    width: 90,
    height: 80,
    description: 'Basic desk glow overlay — gray ambient glow',
    priority: 'high',
  },
  {
    key: 'desk/improved/glow',
    filePath: 'desk/improved/glow.png',
    width: 90,
    height: 80,
    description: 'Improved desk glow overlay — blue ambient glow',
    priority: 'high',
  },
  {
    key: 'desk/modern/glow',
    filePath: 'desk/modern/glow.png',
    width: 90,
    height: 80,
    description: 'Modern desk glow overlay — purple ambient glow',
    priority: 'high',
  },
  {
    key: 'desk/premium/glow',
    filePath: 'desk/premium/glow.png',
    width: 90,
    height: 80,
    description: 'Premium desk glow overlay — gold ambient glow',
    priority: 'high',
  },

  // --- 48 cat sprites (75×75 px, priority 'low') ---
  // 6 furColors × 4 accessories × 2 poses
  ...FUR_COLORS.flatMap((furColor) =>
    ACCESSORIES.flatMap((accessory) =>
      POSES.map(
        (pose): SpriteManifestEntry => ({
          key: `cat/${furColor}/${accessory}/${pose}`,
          filePath: `cat/${furColor}/${accessory}/${pose}.png`,
          width: 75,
          height: 75,
          description: `Cat sprite — ${furColor} fur, ${accessory} accessory, ${pose} pose`,
          priority: 'low',
        }),
      ),
    ),
  ),

  // --- 1 cat shadow (75×30 px, priority 'high') ---
  {
    key: 'cat/shadow',
    filePath: 'cat/shadow.png',
    width: 75,
    height: 30,
    description: 'Cat shadow — semi-transparent oval shadow beneath cat sprites',
    priority: 'high',
  },
];

// ---------------------------------------------------------------------------
// SpritesheetRenderer
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for PixelArtGenerator that uses loaded PNG sprites for
 * game field elements (hex cells, desks, cats) and delegates all UI/icon/
 * particle/background calls to the fallback PixelArtGenerator.
 *
 * Requirements: 2.1, 2.5, 6.3, 6.6
 */
export class SpritesheetRenderer implements IPixelArtGenerator {
  private readonly spriteLoader: SpriteLoader;
  private readonly fallback: PixelArtGenerator;
  private readonly cache: Map<string, OffscreenCanvas> = new Map();
  private ready: boolean = false;

  /**
   * @param spriteLoader - SpriteLoader instance with sprites pre-loaded (or loading)
   * @param fallback     - PixelArtGenerator used for UI/icons/particles/bg and as last-resort fallback
   */
  constructor(spriteLoader: SpriteLoader, fallback: PixelArtGenerator) {
    this.spriteLoader = spriteLoader;
    this.fallback = fallback;
  }

  // -------------------------------------------------------------------------
  // Status and utilities
  // -------------------------------------------------------------------------

  /**
   * Returns true after all high-priority sprites are loaded.
   * Requirement 6.6, 8.2
   */
  isReady(): boolean {
    if (this.ready) return true;

    // Check that all high-priority sprites are loaded
    const highPriority = SPRITE_MANIFEST.filter((e) => e.priority === 'high');
    const allLoaded = highPriority.every((e) => this.spriteLoader.isLoaded(e.key));
    if (allLoaded) {
      this.ready = true;
    }
    return this.ready;
  }

  /**
   * Forces preload of all sprites (useful on a loading screen).
   * Requirement 8.6
   */
  async preloadAll(): Promise<void> {
    await Promise.allSettled(
      SPRITE_MANIFEST.map((entry) => this.spriteLoader.loadSingle(entry.key)),
    );
    this.ready = true;
  }

  /**
   * Prints a formatted table of all 61 sprites to the console.
   * Requirement 5.8
   */
  printSpriteManifest(): void {
    console.log('=== SPRITE MANIFEST ===');
    console.log(
      `${'Key'.padEnd(40)} ${'File'.padEnd(45)} ${'Size'.padEnd(10)} ${'Priority'.padEnd(8)} Description`,
    );
    console.log('-'.repeat(140));
    for (const entry of SPRITE_MANIFEST) {
      const size = `${entry.width}×${entry.height}`;
      console.log(
        `${entry.key.padEnd(40)} ${entry.filePath.padEnd(45)} ${size.padEnd(10)} ${entry.priority.padEnd(8)} ${entry.description}`,
      );
    }
    console.log('-'.repeat(140));
    console.log(`Total: ${SPRITE_MANIFEST.length} sprites`);
  }

  // -------------------------------------------------------------------------
  // Cache management
  // Requirements: 2.5, 8.2, 8.3
  // -------------------------------------------------------------------------

  /**
   * Returns a sprite from the internal cache by key, or null if not cached.
   * Requirement 2.5
   */
  getFromCache(key: string): OffscreenCanvas | null {
    return this.cache.get(key) ?? null;
  }

  /**
   * Clears the internal sprite cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Scales a source OffscreenCanvas to the given dimensions using nearest-neighbor
   * interpolation (imageSmoothingEnabled = false).
   * Requirements: 2.6, 8.2
   */
  private _scaleSprite(source: OffscreenCanvas, width: number, height: number): OffscreenCanvas {
    if (source.width === width && source.height === height) {
      return source;
    }
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, width, height);
    return canvas;
  }

  /**
   * Fallback chain helper: check cache → SpriteLoader → placeholder → PixelArtGenerator fallback.
   *
   * @param key         - Sprite_Key used for cache lookup and SpriteLoader
   * @param width       - Target width for scaling
   * @param height      - Target height for scaling
   * @param pagFallback - Callback to PixelArtGenerator as last resort
   * Requirements: 2.2, 2.4, 6.2, 8.2, 8.3
   */
  private _resolveSprite(
    key: string,
    width: number,
    height: number,
    pagFallback: () => OffscreenCanvas,
  ): OffscreenCanvas {
    // 1. Check internal cache — return if found (Req 8.3)
    const cached = this.cache.get(key);
    if (cached) return cached;

    // 2. Check SpriteLoader — if found, scale, cache and return (Req 2.2)
    const loaded = this.spriteLoader.get(key);
    if (loaded) {
      const scaled = this._scaleSprite(loaded, width, height);
      this.cache.set(key, scaled);
      return scaled;
    }

    // 3. Generate placeholder — if successful, cache and return (Req 2.4)
    const placeholder = this._generatePlaceholder(key);
    if (placeholder !== null) {
      this.cache.set(key, placeholder);
      return placeholder;
    }

    // 4. Delegate to PixelArtGenerator as last resort (Req 6.2)
    return pagFallback();
  }

  // -------------------------------------------------------------------------
  // Placeholder generation
  // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
  // -------------------------------------------------------------------------

  /**
   * Generates a placeholder sprite for the given key by parsing the key prefix
   * and delegating to the appropriate helper.
   * Returns null only if the key is completely unrecognized.
   * Requirements: 4.1, 4.8
   */
  private _generatePlaceholder(key: string): OffscreenCanvas | null {
    // hex/{state} or hex/floor
    if (key === 'hex/floor') {
      return this._placeholderHexFloor();
    }
    if (key.startsWith('hex/')) {
      const state = key.slice(4) as 'empty' | 'occupied' | 'highlighted';
      return this._placeholderHex(state);
    }

    // desk/{tier}/glow
    if (key.startsWith('desk/') && key.endsWith('/glow')) {
      const tier = key.slice(5, -5) as DeskTier;
      return this._placeholderDeskGlow(tier);
    }

    // desk/{tier}
    if (key.startsWith('desk/')) {
      const tier = key.slice(5) as DeskTier;
      return this._placeholderDesk(tier);
    }

    // cat/shadow
    if (key === 'cat/shadow') {
      return this._placeholderCatShadow();
    }

    // cat/{furColor}/{accessory}/{pose}
    if (key.startsWith('cat/')) {
      const parts = key.split('/');
      if (parts.length === 4) {
        const furColor = parts[1] as FurColor;
        const accessory = parts[2] as Accessory;
        return this._placeholderCat(furColor, accessory);
      }
    }

    return null;
  }

  /**
   * Generates all 61 placeholder sprites and returns them as a Map.
   * Requirement 4.9
   */
  generatePlaceholderSprites(): Map<string, OffscreenCanvas> {
    const result = new Map<string, OffscreenCanvas>();
    for (const entry of SPRITE_MANIFEST) {
      const placeholder = this._generatePlaceholder(entry.key);
      if (placeholder !== null) {
        result.set(entry.key, placeholder);
        // Also cache them (Req 4.8)
        this.cache.set(entry.key, placeholder);
      }
    }
    return result;
  }

  /**
   * Creates an OffscreenCanvas (or HTMLCanvasElement fallback).
   * Requirement 6.5
   */
  private _createCanvas(width: number, height: number): OffscreenCanvas {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    return el as unknown as OffscreenCanvas;
  }

  /**
   * Returns the 2D context for a canvas (works for both OffscreenCanvas and HTMLCanvasElement).
   */
  private _getCtx(
    canvas: OffscreenCanvas,
  ): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
    if (canvas instanceof OffscreenCanvas) {
      return canvas.getContext('2d')!;
    }
    return (canvas as unknown as HTMLCanvasElement).getContext('2d')!;
  }

  /**
   * Draws a small key label in the bottom-left corner of the canvas for debugging.
   */
  private _drawKeyLabel(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    key: string,
    _w: number,
    h: number,
  ): void {
    ctx.save();
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    // Truncate long keys to fit
    const label = key.length > 18 ? key.slice(-18) : key;
    ctx.fillText(label, 2, h - 3);
    ctx.restore();
  }

  /**
   * Draws an isometric hexagon placeholder for hex cell sprites (100×90).
   * Color-coded by state: empty=blue, occupied=green, highlighted=yellow.
   * Requirement 4.2
   */
  private _placeholderHex(state: 'empty' | 'occupied' | 'highlighted'): OffscreenCanvas {
    const W = 100;
    const H = 90;
    const canvas = this._createCanvas(W, H);
    const ctx = this._getCtx(canvas);

    // Color coding by state
    let fillColor: string;
    let borderColor: string;
    switch (state) {
      case 'empty':
        fillColor = '#4488ff';
        borderColor = '#2266dd';
        break;
      case 'occupied':
        fillColor = '#44cc44';
        borderColor = '#22aa22';
        break;
      case 'highlighted':
        fillColor = '#ffcc00';
        borderColor = '#ddaa00';
        break;
    }

    // Draw isometric diamond/hexagon shape matching CELL_W=100, ROW_GAP=90
    // Isometric hex: flat-top diamond with 6 points
    const cx = W / 2;
    const cy = H / 2;
    // Points for an isometric hexagon (flat-top, matching game's visual style)
    // Top, top-right, bottom-right, bottom, bottom-left, top-left
    const hw = W / 2 - 2;  // half-width
    const hh = H / 2 - 2;  // half-height
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh);           // top
    ctx.lineTo(cx + hw, cy - hh / 2);  // top-right
    ctx.lineTo(cx + hw, cy + hh / 2);  // bottom-right
    ctx.lineTo(cx, cy + hh);           // bottom
    ctx.lineTo(cx - hw, cy + hh / 2);  // bottom-left
    ctx.lineTo(cx - hw, cy - hh / 2);  // top-left
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight for depth
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh + 4);
    ctx.lineTo(cx + hw - 4, cy - hh / 2 + 2);
    ctx.lineTo(cx + hw - 4, cy + hh / 2 - 2);
    ctx.lineTo(cx, cy + hh - 4);
    ctx.lineTo(cx - hw + 4, cy + hh / 2 - 2);
    ctx.lineTo(cx - hw + 4, cy - hh / 2 + 2);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    this._drawKeyLabel(ctx, `hex/${state}`, W, H);
    return canvas;
  }

  /**
   * Draws a floor tile placeholder (100×90) with repeating pattern in dark blue tones.
   * Requirement 4.3
   */
  private _placeholderHexFloor(): OffscreenCanvas {
    const W = 100;
    const H = 90;
    const canvas = this._createCanvas(W, H);
    const ctx = this._getCtx(canvas);

    // Base floor color from COLORS.office.floor
    const floorBase = COLORS.office.floor[1]; // '#16213e'
    const floorGrid = COLORS.office.floor[3]; // '#1a2a4a'
    const floorAccent = COLORS.office.floor[4]; // '#2a3a5a'

    ctx.fillStyle = floorBase;
    ctx.fillRect(0, 0, W, H);

    // Repeating grid pattern
    ctx.strokeStyle = floorGrid;
    ctx.lineWidth = 1;
    const step = 16;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Diagonal accent lines for floor texture
    ctx.strokeStyle = floorAccent;
    ctx.lineWidth = 0.5;
    for (let i = -H; i < W + H; i += step * 2) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H, H);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = COLORS.office.floor[2]; // '#0f3460'
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    this._drawKeyLabel(ctx, 'hex/floor', W, H);
    return canvas;
  }

  /**
   * Draws a desk placeholder (90×80) as a colored rectangle with tier text.
   * Color-coded: basic=gray, improved=blue, modern=purple, premium=gold.
   * Requirement 4.4
   */
  private _placeholderDesk(tier: DeskTier): OffscreenCanvas {
    const W = 90;
    const H = 80;
    const canvas = this._createCanvas(W, H);
    const ctx = this._getCtx(canvas);

    let fillColor: string;
    let borderColor: string;
    switch (tier) {
      case 'basic':
        fillColor = '#888888';
        borderColor = '#555555';
        break;
      case 'improved':
        fillColor = '#4488ff';
        borderColor = '#2266dd';
        break;
      case 'modern':
        fillColor = '#aa44ff';
        borderColor = '#8822dd';
        break;
      case 'premium':
        fillColor = '#ffaa00';
        borderColor = '#dd8800';
        break;
    }

    // Background
    ctx.fillStyle = fillColor + '33'; // semi-transparent fill
    ctx.fillRect(0, 0, W, H);

    // Desk rectangle body (centered)
    const deskX = 8;
    const deskY = 20;
    const deskW = W - 16;
    const deskH = 30;
    ctx.fillStyle = fillColor;
    ctx.fillRect(deskX, deskY, deskW, deskH);

    // Desk legs
    ctx.fillStyle = borderColor;
    ctx.fillRect(deskX + 4, deskY + deskH, 6, 16);
    ctx.fillRect(deskX + deskW - 10, deskY + deskH, 6, 16);

    // Top surface highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(deskX + 1, deskY + 1, deskW - 2, 3);

    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    // Tier text
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(tier.toUpperCase(), W / 2, deskY + deskH / 2 + 4);
    ctx.textAlign = 'left';

    this._drawKeyLabel(ctx, `desk/${tier}`, W, H);
    return canvas;
  }

  /**
   * Draws a desk glow placeholder (90×80) as a semi-transparent radial glow.
   * Color matches the tier color.
   * Requirement 4.7
   */
  private _placeholderDeskGlow(tier: DeskTier): OffscreenCanvas {
    const W = 90;
    const H = 80;
    const canvas = this._createCanvas(W, H);
    const ctx = this._getCtx(canvas);

    let glowColor: string;
    switch (tier) {
      case 'basic':
        glowColor = '136,136,136';
        break;
      case 'improved':
        glowColor = '68,136,255';
        break;
      case 'modern':
        glowColor = '170,68,255';
        break;
      case 'premium':
        glowColor = '255,170,0';
        break;
    }

    // Radial gradient glow
    const cx = W / 2;
    const cy = H / 2;
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(W, H) / 2);
    grad.addColorStop(0, `rgba(${glowColor},0.45)`);
    grad.addColorStop(0.5, `rgba(${glowColor},0.2)`);
    grad.addColorStop(1, `rgba(${glowColor},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle border
    ctx.strokeStyle = `rgba(${glowColor},0.5)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    this._drawKeyLabel(ctx, `desk/${tier}/glow`, W, H);
    return canvas;
  }

  /**
   * Draws a cat placeholder (75×75) with fur color and accessory symbol.
   * Requirement 4.5
   */
  private _placeholderCat(furColor: FurColor, accessory: Accessory): OffscreenCanvas {
    const W = 75;
    const H = 75;
    const canvas = this._createCanvas(W, H);
    const ctx = this._getCtx(canvas);

    // Get fur color from COLORS.cats palette
    const palette = COLORS.cats[furColor];
    const bodyColor = palette[0];
    const lightColor = palette[2];
    const borderColor = palette[3];

    // Background
    ctx.fillStyle = bodyColor + '22';
    ctx.fillRect(0, 0, W, H);

    // Cat body (simplified silhouette)
    const bx = 20;
    const by = 20;
    const bw = 35;
    const bh = 40;

    // Torso
    ctx.fillStyle = bodyColor;
    ctx.fillRect(bx, by + 10, bw, bh - 10);

    // Head
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(bx + bw / 2, by + 8, bw / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly highlight
    ctx.fillStyle = lightColor;
    ctx.fillRect(bx + 8, by + 22, bw - 16, 16);

    // Ears
    ctx.fillStyle = bodyColor;
    // Left ear
    ctx.beginPath();
    ctx.moveTo(bx + 4, by + 2);
    ctx.lineTo(bx, by - 6);
    ctx.lineTo(bx + 10, by + 2);
    ctx.closePath();
    ctx.fill();
    // Right ear
    ctx.beginPath();
    ctx.moveTo(bx + bw - 4, by + 2);
    ctx.lineTo(bx + bw, by - 6);
    ctx.lineTo(bx + bw - 10, by + 2);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(bx + 10, by + 8, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + bw - 10, by + 8, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + 11, by + 7, 1, 1);
    ctx.fillRect(bx + bw - 9, by + 7, 1, 1);

    // Tail
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + bh - 5);
    ctx.quadraticCurveTo(bx + bw + 14, by + bh, bx + bw + 10, by + bh - 14);
    ctx.stroke();

    // Accessory symbol
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    switch (accessory) {
      case 'glasses':
        ctx.fillStyle = '#4a4a4a';
        ctx.fillText('👓', bx + bw / 2, by + 12);
        break;
      case 'tie':
        ctx.fillStyle = '#e94560';
        ctx.fillText('👔', bx + bw / 2, by + bh / 2 + 4);
        break;
      case 'bow':
        ctx.fillStyle = '#ff6bff';
        ctx.fillText('🎀', bx + bw / 2, by + 12);
        break;
      case 'none':
        // No accessory
        break;
    }
    ctx.textAlign = 'left';

    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    this._drawKeyLabel(ctx, `cat/${furColor}/${accessory}`, W, H);
    return canvas;
  }

  /**
   * Draws a cat shadow placeholder (75×30) as a semi-transparent black oval.
   * Requirement 4.6
   */
  private _placeholderCatShadow(): OffscreenCanvas {
    const W = 75;
    const H = 30;
    const canvas = this._createCanvas(W, H);
    const ctx = this._getCtx(canvas);

    // Semi-transparent black oval
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, W / 2 - 4, H / 2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    this._drawKeyLabel(ctx, 'cat/shadow', W, H);
    return canvas;
  }

  // -------------------------------------------------------------------------
  // Game sprite methods — fallback chain implementations
  // Requirements: 2.2, 2.4, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.2, 8.2, 8.3
  // -------------------------------------------------------------------------

  /**
   * Returns a hex cell sprite for the given state.
   * Sprite_Key: `hex/{state}` (Req 3.1)
   */
  generateHexSprite(state: 'empty' | 'occupied' | 'highlighted'): OffscreenCanvas {
    const key = `hex/${state}`;
    return this._resolveSprite(key, 100, 90, () => this.fallback.generateHexSprite(state));
  }

  /**
   * Returns the hex floor background tile.
   * Sprite_Key: `hex/floor` (Req 3.2)
   */
  generateHexFloorTile(): OffscreenCanvas {
    const key = 'hex/floor';
    return this._resolveSprite(key, 100, 90, () => this.fallback.generateHexFloorTile());
  }

  /**
   * Returns a desk sprite for the given tier.
   * Sprite_Key: `desk/{tier}` (Req 3.3)
   */
  generateDeskSprite(tier: DeskTier): OffscreenCanvas {
    const key = `desk/${tier}`;
    return this._resolveSprite(key, 90, 80, () => this.fallback.generateDeskSprite(tier));
  }

  /**
   * Returns a desk glow overlay for the given tier.
   * Sprite_Key: `desk/{tier}/glow` (Req 3.4)
   */
  generateDeskGlow(tier: DeskTier): OffscreenCanvas {
    const key = `desk/${tier}/glow`;
    return this._resolveSprite(key, 90, 80, () => this.fallback.generateDeskGlow(tier));
  }

  /**
   * Returns a cat sprite for the given appearance and animation frame.
   * Sprite_Key: `cat/{furColor}/{accessory}/{pose}` — three most visually significant params (Req 3.5)
   */
  generateCatSprite(appearance: CatAppearance, frame: AnimationFrame): OffscreenCanvas {
    const key = `cat/${appearance.furColor}/${appearance.accessory}/${appearance.pose}`;
    return this._resolveSprite(key, 75, 75, () =>
      this.fallback.generateCatSprite(appearance, frame),
    );
  }

  /**
   * Returns the cat shadow sprite.
   * Sprite_Key: `cat/shadow` (Req 3.6)
   */
  generateCatShadow(): OffscreenCanvas {
    const key = 'cat/shadow';
    return this._resolveSprite(key, 75, 30, () => this.fallback.generateCatShadow());
  }

  generateUISprite(_element: UIElement, _state: UIElementState): OffscreenCanvas {
    return this.fallback.generateUISprite(_element, _state);
  }

  generateIcon(_type: IconType): OffscreenCanvas {
    return this.fallback.generateIcon(_type);
  }

  generateParticleSprite(_type: ParticleType): OffscreenCanvas {
    return this.fallback.generateParticleSprite(_type);
  }

  generateBackgroundLayer(
    _layer: 'wall' | 'floor' | 'decorations',
    _width: number,
  ): OffscreenCanvas {
    return this.fallback.generateBackgroundLayer(_layer, _width);
  }
}
