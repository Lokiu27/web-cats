// Tests for PixelArtGenerator error handling — placeholder fallback on failure
// Validates: Requirements 22.2, 25.9

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// OffscreenCanvas polyfill for jsdom (which doesn't provide it)
// ---------------------------------------------------------------------------

class MockOffscreenCanvasCtx {
  imageSmoothingEnabled = false;
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  globalAlpha = 1;

  fillRect() {}
  strokeRect() {}
  clearRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  fill() {}
  stroke() {}
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  setTargetAtTime() {}
  createRadialGradient() {
    return {
      addColorStop() {},
    };
  }
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  private ctx: MockOffscreenCanvasCtx;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.ctx = new MockOffscreenCanvasCtx();
  }

  getContext(_type: string) {
    return this.ctx;
  }
}

beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { PixelArtGenerator } from './pixel-art-generator.js';

describe('PixelArtGenerator error handling', () => {
  let gen: PixelArtGenerator;

  beforeEach(() => {
    gen = new PixelArtGenerator();
  });

  it('returns a valid canvas on successful sprite generation', () => {
    const sprite = gen.generateHexSprite('empty');
    expect(sprite).toBeDefined();
    expect(sprite.width).toBeGreaterThan(0);
    expect(sprite.height).toBeGreaterThan(0);
  });

  it('returns cached sprite on second call with same params', () => {
    const first = gen.generateHexSprite('occupied');
    const second = gen.generateHexSprite('occupied');
    expect(first).toBe(second);
  });

  it('returns a placeholder when sprite generation throws internally', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Save original and replace with a throwing constructor
    const Original = globalThis.OffscreenCanvas;
    let callCount = 0;

    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = class {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        callCount++;
        // First call is from the generator (should throw)
        // Second call is from the placeholder (should succeed)
        if (callCount === 1) {
          throw new Error('Simulated sprite generation failure');
        }
        this.width = w;
        this.height = h;
      }
      getContext() {
        return new MockOffscreenCanvasCtx();
      }
    };

    gen.clearCache();
    const result = gen.generateHexSprite('empty');

    // Should return a placeholder, not crash
    expect(result).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    // Error should have been logged
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PixelArtGenerator]'),
      expect.any(Error),
    );

    // Restore
    globalThis.OffscreenCanvas = Original;
    errorSpy.mockRestore();
  });

  it('caches the placeholder so repeated failures do not re-allocate', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Original = globalThis.OffscreenCanvas;

    // Make the generator always throw, but placeholder creation succeeds
    let generatorCallCount = 0;
    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = class {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        generatorCallCount++;
        // Odd calls are generator attempts (throw), even calls are placeholder creation (succeed)
        if (generatorCallCount % 2 === 1) {
          throw new Error('Simulated failure');
        }
        this.width = w;
        this.height = h;
      }
      getContext() {
        return new MockOffscreenCanvasCtx();
      }
    };

    gen.clearCache();
    const p1 = gen.generateHexSprite('highlighted');
    const p2 = gen.generateHexSprite('highlighted');

    // Both should be the same cached placeholder
    expect(p1).toBe(p2);

    globalThis.OffscreenCanvas = Original;
    errorSpy.mockRestore();
  });

  it('returns a stub when even placeholder creation fails', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Original = globalThis.OffscreenCanvas;

    // Make ALL OffscreenCanvas creation throw
    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = class {
      constructor() {
        throw new Error('Total OffscreenCanvas failure');
      }
    };

    gen.clearCache();
    const result = gen.generateHexSprite('empty');

    // Should still return something with width/height (the stub)
    expect(result).toBeDefined();
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    globalThis.OffscreenCanvas = Original;
    errorSpy.mockRestore();
  });

  it('generates desk sprites for all tiers without throwing', () => {
    const tiers = ['basic', 'improved', 'modern', 'premium'] as const;
    for (const tier of tiers) {
      const sprite = gen.generateDeskSprite(tier);
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(32);
      expect(sprite.height).toBe(32);
    }
  });

  it('generates icon sprites without throwing', () => {
    const icons = ['currency', 'desk', 'achievement_star', 'settings_gear', 'menu', 'pause', 'play'] as const;
    for (const icon of icons) {
      const sprite = gen.generateIcon(icon);
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(16);
      expect(sprite.height).toBe(16);
    }
  });

  it('generates particle sprites without throwing', () => {
    const particles = ['coin', 'upgrade_sparkle', 'confetti', 'glow'] as const;
    for (const p of particles) {
      const sprite = gen.generateParticleSprite(p);
      expect(sprite).toBeDefined();
      expect(sprite.width).toBe(8);
      expect(sprite.height).toBe(8);
    }
  });
});
