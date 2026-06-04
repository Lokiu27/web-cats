# Hex Cell Sprites

This directory contains sprites for the hexagonal game field cells.

## Specifications

| File           | Sprite Key        | Size     | Description                                      |
|----------------|-------------------|----------|--------------------------------------------------|
| `empty.png`    | `hex/empty`       | 100×90px | Unoccupied hex platform tile                     |
| `occupied.png` | `hex/occupied`    | 100×90px | Hex platform tile with a desk placed on it       |
| `highlighted.png` | `hex/highlighted` | 100×90px | Hovered or selected hex platform tile         |
| `floor.png`    | `hex/floor`       | 100×90px | Repeating background floor tile beneath the grid |

## Visual Style

- **Size:** 100×90 px (matches `CELL_W=100` and `ROW_GAP=90` in the renderer)
- **Shape:** Isometric hexagon / flat-top diamond
- **Format:** PNG with transparency (alpha channel required)
- **Art style:** Pseudo-3D isometric, pixel art or stylized vector

## Color Guidance (for placeholder reference)

- `empty` — blue tones (`#4488ff`)
- `occupied` — green tones (`#44cc44`)
- `highlighted` — yellow tones (`#ffcc00`)
- `floor` — dark blue tones from the office floor palette (`#16213e`)

## Notes

- The hex cells are drawn with an isometric perspective — the top face is visible
- Transparency is used for the areas outside the hexagon shape
- The floor tile is tiled as a repeating background beneath the hex grid
