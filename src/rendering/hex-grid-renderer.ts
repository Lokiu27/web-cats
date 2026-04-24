// Hex Grid Renderer for Openspacemarin
// Requirements: 1.1–1.6, 9.1–9.4, 21.2, 21.6, 22.3
//
// Isometric 4-row office layout expanding to the right.
// Only occupied cells (desks) are drawn — no empty hex grid.
// Row 3 = back (top), Row 0 = front (bottom).
// Odd rows shift right by half a cell for isometric stagger.

import type {
  Desk,
  HexCoord,
  IHexGridRenderer,
  IPixelArtGenerator,
  Viewport,
} from '../types/index.js';
import { COLORS } from '../utils/colors.js';
import { Easing } from '../utils/easing.js';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

/** Number of rows in the office grid. */
const NUM_ROWS = 4;

/** Horizontal distance between column centres. */
const CELL_W = 100;

/** Vertical distance between row centres. */
const ROW_GAP = 90;

/** Odd rows shift right by half a cell (isometric stagger). */
const ROW_STAGGER = CELL_W / 2;

/** Left margin for column 0. */
const LEFT_MARGIN = 80;

/** Front row (row 0) Y position — near the bottom of the 480px canvas. */
const FRONT_ROW_Y = 420;

/** Upgrade bar dimensions. */
const UPGRADE_BAR_W = 60;
const UPGRADE_BAR_H = 5;

/** Scroll physics. */
const SCROLL_FRICTION = 0.88;
const SCROLL_MIN_VELOCITY = 0.5;

// ---------------------------------------------------------------------------
// Upgrade bar color (Requirement 9.2, 21.3)
// ---------------------------------------------------------------------------

export function upgradeBarColor(level: number): string {
  if (level >= 20) return '#ffd700';
  if (level >= 10) return '#a855f7';
  if (level >= 5)  return '#3b82f6';
  return '#22c55e';
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function isoToScreen(q: number, r: number, offsetX: number): { x: number; y: number } {
  const stagger = (r % 2 === 1) ? ROW_STAGGER : 0;
  const x = LEFT_MARGIN + q * CELL_W + stagger - offsetX;
  const y = FRONT_ROW_Y - r * ROW_GAP;
  return { x, y };
}

function screenToIso(sx: number, sy: number, offsetX: number): HexCoord | null {
  // Find closest row by Y
  let bestR = 0;
  let bestDist = Infinity;
  for (let r = 0; r < NUM_ROWS; r++) {
    const rowY = FRONT_ROW_Y - r * ROW_GAP;
    const dist = Math.abs(sy - rowY);
    if (dist < bestDist) { bestDist = dist; bestR = r; }
  }
  if (bestDist > ROW_GAP / 2) return null; // too far from any row

  const stagger = (bestR % 2 === 1) ? ROW_STAGGER : 0;
  const q = Math.round((sx + offsetX - LEFT_MARGIN - stagger) / CELL_W);
  if (q < 0) return null;
  return { q, r: bestR };
}

// ---------------------------------------------------------------------------
// Fallback drawing helpers
// ---------------------------------------------------------------------------

function drawFallbackDesk(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, level: number,
): void {
  const w = CELL_W * 0.7;
  const h = 30;
  const colors = ['#6a5748', '#0f3460', '#533483', '#ffd700'];
  const ti = level >= 20 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0;
  ctx.fillStyle = colors[ti];
  ctx.fillRect(cx - w / 2, cy - h / 2 + 10, w, h);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, cy - h / 2 + 10, w, h);
}

function drawFallbackCat(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
): void {
  const s = 20;
  ctx.fillStyle = '#ff8c42';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 4, s * 0.7, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy - s * 1.1, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// HexGridRenderer
// ---------------------------------------------------------------------------

export class HexGridRenderer implements IHexGridRenderer {
  private viewport: Viewport;
  private highlightedCoord: HexCoord | null = null;
  private readonly pixelArt: IPixelArtGenerator | null;

  private scrollVelocity = 0;
  private isScrolling = false;
  private bgTile: OffscreenCanvas | null = null;

  constructor(viewport: Viewport, pixelArt: IPixelArtGenerator | null = null) {
    this.viewport = { ...viewport };
    this.pixelArt = pixelArt;
  }

  getViewport(): Viewport { return { ...this.viewport }; }

  scrollBy(dx: number): void {
    this.viewport = { ...this.viewport, offsetX: Math.max(0, this.viewport.offsetX + dx) };
  }

  applyScrollImpulse(velocity: number): void {
    this.scrollVelocity += velocity;
    this.isScrolling = true;
  }

  updateScroll(): void {
    if (!this.isScrolling) return;
    this.scrollBy(this.scrollVelocity);
    this.scrollVelocity *= SCROLL_FRICTION;
    if (Math.abs(this.scrollVelocity) < SCROLL_MIN_VELOCITY) {
      this.scrollVelocity = 0;
      this.isScrolling = false;
    }
  }

  setHighlighted(coord: HexCoord | null): void { this.highlightedCoord = coord; }

  screenToHex(screenX: number, screenY: number): HexCoord | null {
    return screenToIso(screenX, screenY, this.viewport.offsetX);
  }

  hexToScreen(coord: HexCoord): { x: number; y: number } {
    return isoToScreen(coord.q, coord.r, this.viewport.offsetX);
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport, desks: Desk[]): void {
    this.viewport = { ...viewport };

    // 1. Background
    this._drawBackground(ctx);

    // 2. Sort desks back-to-front: higher r first (back row), then lower q first
    const sorted = [...desks].sort((a, b) => {
      if (a.hexCoord.r !== b.hexCoord.r) return b.hexCoord.r - a.hexCoord.r;
      return a.hexCoord.q - b.hexCoord.q;
    });

    // 3. Draw only occupied cells (no empty hexes)
    for (const desk of sorted) {
      const screen = isoToScreen(desk.hexCoord.q, desk.hexCoord.r, this.viewport.offsetX);
      // Viewport culling
      if (screen.x < -CELL_W || screen.x > this.viewport.width + CELL_W) continue;

      const highlighted =
        this.highlightedCoord !== null &&
        this.highlightedCoord.q === desk.hexCoord.q &&
        this.highlightedCoord.r === desk.hexCoord.r;

      this._drawOccupiedCell(ctx, screen.x, screen.y, desk, highlighted);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _drawBackground(ctx: CanvasRenderingContext2D): void {
    if (!this.bgTile) this.bgTile = this._makeBgTile();
    const tw = this.bgTile.width;
    const th = this.bgTile.height;
    const ox = this.viewport.offsetX % tw;
    for (let x = -ox; x < this.viewport.width + tw; x += tw) {
      for (let y = 0; y < this.viewport.height + th; y += th) {
        ctx.drawImage(this.bgTile, x, y);
      }
    }
  }

  private _makeBgTile(): OffscreenCanvas {
    if (this.pixelArt) {
      try { return this.pixelArt.generateBackgroundLayer('floor', 64); } catch { /* fall through */ }
    }
    const tile = new OffscreenCanvas(64, 64);
    const c = tile.getContext('2d')!;
    c.fillStyle = COLORS.office.floor[1];
    c.fillRect(0, 0, 64, 64);
    c.strokeStyle = COLORS.office.floor[3];
    c.lineWidth = 1;
    for (let x = 0; x < 64; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 64); c.stroke(); }
    for (let y = 0; y < 64; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(64, y); c.stroke(); }
    return tile;
  }

  private _drawOccupiedCell(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    desk: Desk, highlighted: boolean,
  ): void {
    // --- Hex base (subtle platform under the desk) ---
    this._drawHexPlatform(ctx, cx, cy, highlighted);

    const tier = this._tier(desk.upgradeLevel);

    // --- Desk sprite (scaled up) ---
    if (this.pixelArt) {
      try {
        const ds = this.pixelArt.generateDeskSprite(tier);
        const dw = CELL_W * 0.9;
        const dh = ds.height * (dw / ds.width);
        ctx.drawImage(ds, cx - dw / 2, cy - dh / 2 + 10, dw, dh);
        if (tier === 'premium' || tier === 'modern') {
          const glow = this.pixelArt.generateDeskGlow(tier);
          ctx.globalAlpha = 0.5;
          ctx.drawImage(glow, cx - dw / 2, cy - dh / 2 + 10, dw, dh);
          ctx.globalAlpha = 1;
        }
      } catch { drawFallbackDesk(ctx, cx, cy, desk.upgradeLevel); }
    } else {
      drawFallbackDesk(ctx, cx, cy, desk.upgradeLevel);
    }

    // --- Cat sprite (scaled up, sitting above desk) ---
    if (this.pixelArt) {
      try {
        const cs = this.pixelArt.generateCatSprite(desk.cat.appearance, { action: 'idle', frame: 0 });
        const cw = CELL_W * 0.75;
        const ch = cs.height * (cw / cs.width);
        ctx.drawImage(cs, cx - cw / 2, cy - ch - 6, cw, ch);
      } catch { drawFallbackCat(ctx, cx, cy); }
    } else {
      drawFallbackCat(ctx, cx, cy);
    }

    // --- Upgrade bar ---
    this._drawUpgradeBar(ctx, cx, cy, desk.upgradeLevel);

    // --- Cat name ---
    this._drawCatName(ctx, cx, cy, desk.cat.name);
  }

  private _drawHexPlatform(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    highlighted: boolean,
  ): void {
    // Isometric diamond platform
    const hw = CELL_W / 2 - 4;
    const hh = 22;
    ctx.beginPath();
    ctx.moveTo(cx,      cy - hh + 16);
    ctx.lineTo(cx + hw, cy + 16);
    ctx.lineTo(cx,      cy + hh + 16);
    ctx.lineTo(cx - hw, cy + 16);
    ctx.closePath();

    ctx.fillStyle = highlighted ? 'rgba(255,215,0,0.3)' : 'rgba(15,52,96,0.6)';
    ctx.fill();
    ctx.strokeStyle = highlighted ? '#ffd700' : 'rgba(83,52,131,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private _drawUpgradeBar(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, level: number,
  ): void {
    const barX = cx - UPGRADE_BAR_W / 2;
    const barY = cy - 50;
    const color = upgradeBarColor(level);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 1, barY - 1, UPGRADE_BAR_W + 2, UPGRADE_BAR_H + 2);

    const fill = Math.round(UPGRADE_BAR_W * this._barFill(level));
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, fill, UPGRADE_BAR_H);

    if (level >= 20) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillRect(barX, barY, fill, UPGRADE_BAR_H);
      ctx.restore();
    }

    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(level), cx, barY - 2);
  }

  private _barFill(level: number): number {
    if (level >= 20) return Math.min(1, (level - 20) / 10);
    if (level >= 10) return (level - 10) / 10;
    if (level >= 5)  return (level - 5) / 5;
    return level / 5;
  }

  private _drawCatName(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, name: string,
  ): void {
    ctx.save();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(name, cx + 1, cy + 38);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(name, cx, cy + 37);
    ctx.restore();
  }

  private _tier(level: number): 'basic' | 'improved' | 'modern' | 'premium' {
    if (level >= 20) return 'premium';
    if (level >= 10) return 'modern';
    if (level >= 5)  return 'improved';
    return 'basic';
  }
}

// ---------------------------------------------------------------------------
// Upgrade bar animation helper (Requirement 9.4)
// ---------------------------------------------------------------------------

export function animateUpgradeBar(
  fromLevel: number,
  toLevel: number,
  durationMs: number,
  onUpdate: (level: number) => void,
  onComplete?: () => void,
): () => void {
  let startTime: number | null = null;
  let rafId: number;
  let cancelled = false;

  function step(ts: number): void {
    if (cancelled) return;
    if (startTime === null) startTime = ts;
    const t = Math.min((ts - startTime) / durationMs, 1);
    onUpdate(fromLevel + (toLevel - fromLevel) * Easing.easeInOutCubic(t));
    if (t < 1) { rafId = requestAnimationFrame(step); }
    else { onComplete?.(); }
  }

  rafId = requestAnimationFrame(step);
  return () => { cancelled = true; cancelAnimationFrame(rafId); };
}
