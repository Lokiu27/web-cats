// SpriteLoader — loads PNG sprites from public/sprites/, caches as OffscreenCanvas
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.4, 8.5

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Entry in the sprite manifest describing a single sprite asset. */
export interface SpriteManifestEntry {
  /** Sprite_Key, e.g. "hex/empty" */
  key: string;
  /** Path relative to public/sprites/ */
  filePath: string;
  /** Expected width in pixels */
  width: number;
  /** Expected height in pixels */
  height: number;
  /** Human-readable description for designers */
  description: string;
  /** Loading priority: high = loaded before game starts, low = background */
  priority: 'high' | 'low';
}

/** Region within a sprite atlas for slicing. */
export interface AtlasRegion {
  /** Path to the atlas PNG (relative to basePath) */
  atlasPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Manifest JSON shape (optional file at public/sprites/manifest.json)
// ---------------------------------------------------------------------------

interface ManifestSpriteEntry {
  path: string;
  width: number;
  height: number;
  atlas?: { x: number; y: number; width: number; height: number };
}

interface ManifestJson {
  sprites: Record<string, ManifestSpriteEntry>;
}

// ---------------------------------------------------------------------------
// Canvas factory — falls back to HTMLCanvasElement when OffscreenCanvas is
// unavailable (Requirement 6.5 / 8.5)
// ---------------------------------------------------------------------------

function createCanvas(width: number, height: number): OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  // Fallback: HTMLCanvasElement cast to OffscreenCanvas for API compatibility
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  return el as unknown as OffscreenCanvas;
}

// ---------------------------------------------------------------------------
// SpriteLoader
// ---------------------------------------------------------------------------

export class SpriteLoader {
  private readonly cache: Map<string, OffscreenCanvas> = new Map();
  private manifest: SpriteManifestEntry[] | null = null;
  /** Parsed manifest.json entries keyed by sprite key */
  private manifestOverrides: Map<string, ManifestSpriteEntry> = new Map();
  private readonly basePath: string;

  constructor(basePath?: string) {
    const base = import.meta.env.BASE_URL ?? '/';
    this.basePath = basePath ?? `${base}sprites/`;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Returns a cached sprite canvas or null if not yet loaded. */
  get(key: string): OffscreenCanvas | null {
    return this.cache.get(key) ?? null;
  }

  /** Returns true if the sprite for the given key is in the cache. */
  isLoaded(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Loads all sprites listed in manifest.json (if present).
   * High-priority sprites are awaited; low-priority sprites are loaded in the
   * background without blocking the caller (Requirement 8.5).
   */
  async loadAll(): Promise<void> {
    // Attempt to read manifest.json — failure is non-fatal (Req 7.5)
    await this._loadManifest();

    if (!this.manifest || this.manifest.length === 0) {
      // Nothing to load from manifest
      return;
    }

    const highPriority = this.manifest.filter((e) => e.priority === 'high');
    const lowPriority = this.manifest.filter((e) => e.priority === 'low');

    // Load high-priority sprites and wait for all of them (Req 8.1)
    await Promise.allSettled(highPriority.map((entry) => this._loadEntry(entry)));

    // Start background loading of low-priority sprites without awaiting (Req 8.5)
    void Promise.allSettled(lowPriority.map((entry) => this._loadEntry(entry)));
  }

  /**
   * Loads a single sprite by key.
   * Resolves the file path from manifest overrides or the default convention.
   * Caches the result; returns null on any error (Req 1.3, 1.4).
   */
  async loadSingle(key: string): Promise<OffscreenCanvas | null> {
    // Return cached value immediately (Req 1.5)
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const override = this.manifestOverrides.get(key);

    if (override?.atlas) {
      // Atlas region defined in manifest
      const region: AtlasRegion = {
        atlasPath: override.path,
        x: override.atlas.x,
        y: override.atlas.y,
        width: override.atlas.width,
        height: override.atlas.height,
      };
      return this.loadAtlasRegion(key, region);
    }

    // Resolve file path: manifest override path or default convention (Req 7.3)
    const filePath = override ? override.path : `${key}.png`;
    const url = `${this.basePath}${filePath}`;

    return this._loadImageToCanvas(key, url, override?.width, override?.height);
  }

  /**
   * Loads a region from a sprite atlas PNG and caches it under the given key.
   * Uses drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh) for extraction (Req 1.6).
   */
  async loadAtlasRegion(key: string, region: AtlasRegion): Promise<OffscreenCanvas | null> {
    // Return cached value immediately (Req 1.5)
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const url = `${this.basePath}${region.atlasPath}`;

    try {
      const img = await this._loadImage(url);
      const canvas = createCanvas(region.width, region.height);
      const ctx = this._getContext(canvas);
      if (!ctx) {
        console.warn(`[SpriteLoader] Could not get 2D context for atlas region "${key}"`);
        return null;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        img as CanvasImageSource,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        region.width,
        region.height,
      );

      this.cache.set(key, canvas);
      return canvas;
    } catch (err) {
      console.warn(`[SpriteLoader] Failed to load atlas region "${key}" from "${url}":`, err);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Reads and parses public/sprites/manifest.json. Non-fatal on any error. */
  private async _loadManifest(): Promise<void> {
    const manifestUrl = `${this.basePath}manifest.json`;
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        // manifest.json is optional — 404 is expected and fine (Req 7.5)
        return;
      }
      let json: ManifestJson;
      try {
        json = (await response.json()) as ManifestJson;
      } catch (parseErr) {
        console.warn('[SpriteLoader] manifest.json is not valid JSON:', parseErr);
        return;
      }

      const entries: SpriteManifestEntry[] = [];
      for (const [key, entry] of Object.entries(json.sprites ?? {})) {
        this.manifestOverrides.set(key, entry);
        entries.push({
          key,
          filePath: entry.path,
          width: entry.width,
          height: entry.height,
          description: '',
          priority: 'high',
        });
      }
      this.manifest = entries;
    } catch (_err) {
      // Network error or other failure — use default conventions silently
    }
  }

  /** Loads a single manifest entry (handles atlas vs plain PNG). */
  private async _loadEntry(entry: SpriteManifestEntry): Promise<void> {
    const override = this.manifestOverrides.get(entry.key);
    if (override?.atlas) {
      const region: AtlasRegion = {
        atlasPath: override.path,
        x: override.atlas.x,
        y: override.atlas.y,
        width: override.atlas.width,
        height: override.atlas.height,
      };
      await this.loadAtlasRegion(entry.key, region);
    } else {
      await this.loadSingle(entry.key);
    }
  }

  /**
   * Loads a PNG from the given URL, draws it to an OffscreenCanvas with
   * imageSmoothingEnabled = false, caches it, and returns it.
   * Returns null on HTTP 404 or any other error (Req 1.3, 1.4).
   */
  private async _loadImageToCanvas(
    key: string,
    url: string,
    width?: number,
    height?: number,
  ): Promise<OffscreenCanvas | null> {
    try {
      const img = await this._loadImage(url);
      const w = width ?? img.naturalWidth;
      const h = height ?? img.naturalHeight;
      const canvas = createCanvas(w, h);
      const ctx = this._getContext(canvas);
      if (!ctx) {
        console.warn(`[SpriteLoader] Could not get 2D context for sprite "${key}"`);
        return null;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);

      this.cache.set(key, canvas);
      return canvas;
    } catch (err) {
      console.warn(`[SpriteLoader] Failed to load sprite "${key}" from "${url}":`, err);
      return null;
    }
  }

  /**
   * Loads an HTMLImageElement from a URL.
   * Rejects with an error on HTTP 404 or load failure.
   */
  private _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  /**
   * Returns the 2D rendering context for a canvas.
   * Works for both OffscreenCanvas and HTMLCanvasElement fallback.
   */
  private _getContext(
    canvas: OffscreenCanvas,
  ): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
    if (canvas instanceof OffscreenCanvas) {
      return canvas.getContext('2d');
    }
    // HTMLCanvasElement fallback
    return (canvas as unknown as HTMLCanvasElement).getContext('2d');
  }
}
