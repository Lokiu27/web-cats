# Cat Sprites

This directory contains sprites for cat characters and their shadow.

## Directory Structure

```
cat/
├── shadow.png                    — Cat shadow (75×30 px)
├── orange/
│   ├── glasses/
│   │   ├── upright.png
│   │   └── leaning.png
│   ├── tie/
│   │   ├── upright.png
│   │   └── leaning.png
│   ├── bow/
│   │   ├── upright.png
│   │   └── leaning.png
│   └── none/
│       ├── upright.png
│       └── leaning.png
├── gray/   (same structure as orange/)
├── white/  (same structure as orange/)
├── black/  (same structure as orange/)
├── brown/  (same structure as orange/)
└── tabby/  (same structure as orange/)
```

## Specifications

### Cat sprites

- **Sprite Key:** `cat/{furColor}/{accessory}/{pose}`
- **Size:** 75×75 px (= `CELL_W * 0.75`, square for designer convenience)
- **Total:** 48 sprites (6 colors × 4 accessories × 2 poses)

### Cat shadow

- **Sprite Key:** `cat/shadow`
- **File:** `shadow.png`
- **Size:** 75×30 px (width of cat, height is the shadow oval)

## Parameters

### Fur Colors (6)

| Value    | Description                        |
|----------|------------------------------------|
| `orange` | Orange / ginger cat                |
| `gray`   | Gray cat                           |
| `white`  | White cat                          |
| `black`  | Black cat                          |
| `brown`  | Brown / chocolate cat              |
| `tabby`  | Tabby (striped) cat                |

### Accessories (4)

| Value     | Description                        |
|-----------|------------------------------------|
| `glasses` | Wearing glasses                    |
| `tie`     | Wearing a tie                      |
| `bow`     | Wearing a bow / bow tie            |
| `none`    | No accessory                       |

### Poses (2)

| Value     | Description                                      |
|-----------|--------------------------------------------------|
| `upright` | Sitting upright, facing forward                  |
| `leaning` | Leaning forward, working at the desk             |

## Visual Style

- **Format:** PNG with transparency (alpha channel required)
- **Art style:** Pixel art or stylized vector, matching the office theme
- **Perspective:** Slight top-down isometric angle to match the hex grid

## Notes

- The shadow sprite is drawn beneath the cat and is semi-transparent
- All cat sprites should be centered within the 75×75 canvas
- The `leaning` pose should visually suggest the cat is working at the desk
- Accessories should be clearly visible at the sprite's size
