# Sprite Assets — OpenSpaceMarin

This directory contains all PNG sprite assets for the game's visual elements.
The sprite system replaces procedural generation for game field elements (hex cells, desks, cats)
while keeping UI, icons, particles, and backgrounds procedural.

## Directory Structure

```
public/sprites/
├── manifest.json          — Machine-readable list of all 61 sprites with dimensions
├── hex/                   — Hex cell sprites (100×90 px)
├── desk/                  — Desk sprites and glow overlays (90×80 px)
└── cat/                   — Cat character sprites (75×75 px) and shadow (75×30 px)
```

## How It Works

The `SpriteLoader` reads `manifest.json` at startup and loads all PNG files listed there.
If a PNG file is missing, the game falls back to a programmatically generated placeholder sprite
so the game remains fully playable before final artwork is delivered.

## manifest.json Format

```json
{
  "sprites": {
    "hex/empty": { "path": "hex/empty.png", "width": 100, "height": 90 },
    "desk/basic": { "path": "desk/basic.png", "width": 90, "height": 80 }
  }
}
```

Each entry maps a **Sprite Key** (used in code) to a file path and expected dimensions.
The path is relative to this `public/sprites/` directory.

## Sprite Key Convention

| Entity         | Key format                          | Example                        |
|----------------|-------------------------------------|--------------------------------|
| Hex cell       | `hex/{state}`                       | `hex/empty`                    |
| Hex floor tile | `hex/floor`                         | `hex/floor`                    |
| Desk           | `desk/{tier}`                       | `desk/basic`                   |
| Desk glow      | `desk/{tier}/glow`                  | `desk/modern/glow`             |
| Cat            | `cat/{furColor}/{accessory}/{pose}` | `cat/orange/glasses/upright`   |
| Cat shadow     | `cat/shadow`                        | `cat/shadow`                   |

## Total Sprites: 61

- 4 hex sprites (100×90 px)
- 4 desk sprites (90×80 px)
- 4 desk glow overlays (90×80 px)
- 48 cat sprites (75×75 px) — 6 colors × 4 accessories × 2 poses
- 1 cat shadow (75×30 px)
