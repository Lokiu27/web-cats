// Cat Appearance Generator for Openspacemarin
// Requirements: 6.1, 6.2, 6.3
//
// Generates random cat appearances by combining 6 fur colors × 4 patterns ×
// 3 expressions × 4 accessories × 2 poses = 576 unique visual combinations.
// Also assigns unique names from a per-language name pool.

import type {
  Accessory,
  CatAppearance,
  Expression,
  FurColor,
  FurPattern,
  ICatAppearanceGenerator,
  Pose,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Trait pools (Requirement 6.1)
// ---------------------------------------------------------------------------

const FUR_COLORS: FurColor[] = ['orange', 'gray', 'white', 'black', 'brown', 'tabby'];
const FUR_PATTERNS: FurPattern[] = ['solid', 'spotted', 'striped', 'gradient'];
const EXPRESSIONS: Expression[] = ['focused', 'smiling', 'serious'];
const ACCESSORIES: Accessory[] = ['glasses', 'tie', 'bow', 'none'];
const POSES: Pose[] = ['upright', 'leaning'];

// ---------------------------------------------------------------------------
// Name pools (Requirement 6.3)
// ---------------------------------------------------------------------------

// English cat names — office-themed with a playful twist
const CAT_NAMES_EN: string[] = [
  'Whiskers', 'Mittens', 'Shadow', 'Biscuit', 'Mochi',
  'Pixel', 'Byte', 'Chip', 'Dot', 'Nano',
  'Cheddar', 'Brie', 'Gouda', 'Feta', 'Colby',
  'Espresso', 'Latte', 'Mocha', 'Chai', 'Matcha',
  'Pebble', 'Cobble', 'Gravel', 'Slate', 'Flint',
  'Doodle', 'Noodle', 'Pudding', 'Muffin', 'Waffle',
  'Sprocket', 'Cog', 'Bolt', 'Rivet', 'Wrench',
  'Quill', 'Inkblot', 'Smudge', 'Blot', 'Scribble',
  'Zigzag', 'Squiggle', 'Wobble', 'Jiggle', 'Wiggle',
  'Pumpkin', 'Acorn', 'Hazel', 'Maple', 'Cedar',
  'Cosmo', 'Orbit', 'Comet', 'Nebula', 'Quasar',
  'Ratchet', 'Socket', 'Gasket', 'Piston', 'Valve',
];

// Russian cat names — a mix of classic and quirky office-themed names
const CAT_NAMES_RU: string[] = [
  'Мурзик', 'Барсик', 'Пушок', 'Рыжик', 'Снежок',
  'Тихон', 'Степан', 'Василий', 'Фёдор', 'Архип',
  'Пончик', 'Бублик', 'Ватрушка', 'Плюшка', 'Крендель',
  'Кофе', 'Чай', 'Какао', 'Сахар', 'Карамель',
  'Кнопка', 'Мышка', 'Флешка', 'Дискета', 'Байт',
  'Клавиш', 'Пробел', 'Энтер', 'Эскейп', 'Шифт',
  'Облако', 'Туман', 'Ветер', 'Гром', 'Молния',
  'Уголёк', 'Зола', 'Пепел', 'Искра', 'Жар',
  'Тапок', 'Носок', 'Шарф', 'Варежка', 'Шапка',
  'Кактус', 'Фикус', 'Алоэ', 'Бамбук', 'Папоротник',
  'Сметана', 'Творог', 'Кефир', 'Ряженка', 'Простокваша',
  'Болтик', 'Гаечка', 'Шестерня', 'Пружина', 'Рычаг',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Picks a uniformly random element from an array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// CatGenerator class
// ---------------------------------------------------------------------------

export class CatGenerator implements ICatAppearanceGenerator {
  /**
   * Generates a random cat appearance by independently sampling each trait.
   *
   * Produces one of 6 × 4 × 3 × 4 × 2 = 576 unique combinations.
   * Requirement 6.1, 6.2
   */
  generate(): CatAppearance {
    return {
      furColor: pick(FUR_COLORS),
      pattern: pick(FUR_PATTERNS),
      expression: pick(EXPRESSIONS),
      accessory: pick(ACCESSORIES),
      pose: pick(POSES),
    };
  }

  /**
   * Picks a unique cat name from the language-appropriate name pool.
   *
   * If all names in the pool are already taken, falls back to appending a
   * numeric suffix to guarantee uniqueness (e.g., "Whiskers-2").
   *
   * Requirement 6.3
   *
   * @param existingNames - Names already in use (must not be returned again)
   * @param language      - Language code for the name pool ('en' | 'ru')
   */
  generateName(existingNames: string[], language: 'en' | 'ru'): string {
    const pool = language === 'ru' ? CAT_NAMES_RU : CAT_NAMES_EN;
    const taken = new Set(existingNames);

    // Shuffle a copy of the pool so we don't always pick the same names first
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    for (const name of shuffled) {
      if (!taken.has(name)) {
        return name;
      }
    }

    // All base names are taken — generate a suffixed name
    let suffix = 2;
    while (true) {
      const candidate = `${shuffled[0]}-${suffix}`;
      if (!taken.has(candidate)) {
        return candidate;
      }
      suffix++;
    }
  }
}
