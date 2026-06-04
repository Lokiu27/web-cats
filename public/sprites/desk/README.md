# Desk Sprites

This directory contains sprites for office desks and their glow overlays.

## Specifications

### Desk sprites

| File           | Sprite Key       | Size    | Description                                  |
|----------------|------------------|---------|----------------------------------------------|
| `basic.png`    | `desk/basic`     | 90×80px | Basic desk — tier 0–4, simple wooden desk    |
| `improved.png` | `desk/improved`  | 90×80px | Improved desk — tier 5–9, desk with monitor  |
| `modern.png`   | `desk/modern`    | 90×80px | Modern desk — tier 10–19, dual monitor setup |
| `premium.png`  | `desk/premium`   | 90×80px | Premium desk — tier 20+, full setup          |

### Glow overlay sprites

Glow overlays are placed on top of the desk sprite to indicate activity.
They are stored in subdirectories named after the tier.

| File                  | Sprite Key            | Size    | Description                        |
|-----------------------|-----------------------|---------|------------------------------------|
| `basic/glow.png`      | `desk/basic/glow`     | 90×80px | Gray ambient glow for basic desk   |
| `improved/glow.png`   | `desk/improved/glow`  | 90×80px | Blue ambient glow for improved desk |
| `modern/glow.png`     | `desk/modern/glow`    | 90×80px | Purple ambient glow for modern desk |
| `premium/glow.png`    | `desk/premium/glow`   | 90×80px | Gold ambient glow for premium desk  |

## Visual Style

- **Size:** 90×80 px (= `CELL_W * 0.9` × proportional height)
- **Format:** PNG with transparency (alpha channel required)
- **Art style:** Pseudo-3D isometric, pixel art or stylized vector
- **Perspective:** Matches the hex cell isometric angle

## Color Guidance (for placeholder reference)

- `basic` — gray tones (`#888888`)
- `improved` — blue tones (`#4488ff`)
- `modern` — purple tones (`#aa44ff`)
- `premium` — gold tones (`#ffaa00`)

## Notes

- Glow overlays must have significant transparency — they are composited on top of the desk
- The desk sprite should fit within the hex cell (100×90) with some padding
- Desks are drawn centered on the hex cell
