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
// Biography pools (Requirements 2.1, 2.2, 2.3, 2.4)
// ---------------------------------------------------------------------------

// English office-themed cat biographies — each ≤ 100 characters
export const CAT_BIOS_EN: string[] = [
  'Expert in keyboard napping. 3 years of experience.',
  'Former mouse hunter, now hunts bugs in code.',
  'Certified purr-fessional. Specializes in doing nothing.',
  'Fluent in meow and markdown. Prefers meow.',
  'Holds a degree in Staring Out Windows. Summa cum laude.',
  'Senior nap engineer with a passion for warm laptops.',
  'Knocked over 47 coffee cups. Zero regrets.',
  'Agile practitioner. Mostly agile at avoiding work.',
  'Full-stack cat. Stacks boxes, papers, and colleagues.',
  'Productivity consultant. Consults by sitting on keyboards.',
  'Specialist in deadline avoidance and strategic yawning.',
  'Onboarded 3 interns. All three now fear Mondays.',
  'Expert multitasker: naps and ignores emails simultaneously.',
  'Promoted twice for outstanding fur quality.',
  'Leads the 3 PM sunbeam optimization committee.',
  'Pioneered the art of looking busy while sleeping.',
  'Holds the office record for longest uninterrupted nap.',
  'Certified in advanced paper-pushing (off desks).',
  'Mentors junior cats in the art of the slow blink.',
  'Attended every meeting. Contributed zero actionable items.',
  'Renowned for strategic inbox zero (by deletion).',
  'Invented the standing desk nap. Patent pending.',
  'Fluent in body language. Mostly says "leave me alone".',
  'Optimized the office snack supply chain. For personal use.',
  'Chaired the quarterly fur-grooming review board.',
  'Broke the printer twice. Blamed the intern both times.',
  'Holds a black belt in passive resistance.',
  'Authored the company nap policy. Self-enforced.',
  'Survived 12 reorgs. Outlasted 4 managers.',
  'Specializes in strategic ambiguity and selective hearing.',
];

// Russian office-themed cat biographies — each ≤ 100 characters
export const CAT_BIOS_RU: string[] = [
  'Эксперт по сну на клавиатуре. 3 года опыта.',
  'Бывший охотник на мышей, теперь ловит баги.',
  'Сертифицированный мурр-фессионал. Ничего не делает.',
  'Свободно владеет мяуканьем и молчанием.',
  'Степень по созерцанию окна. С отличием.',
  'Старший инженер по дремоте. Любит тёплые ноутбуки.',
  'Уронил 47 чашек кофе. Ни о чём не жалеет.',
  'Практикует agile. В основном уклоняется от задач.',
  'Фулстек-кот. Складывает коробки, бумаги и коллег.',
  'Консультант по продуктивности. Сидит на клавиатурах.',
  'Специалист по избеганию дедлайнов и стратегической зевоте.',
  'Обучил 3 стажёров. Все трое боятся понедельников.',
  'Мастер многозадачности: спит и игнорирует письма.',
  'Повышен дважды за выдающееся качество шерсти.',
  'Возглавляет комитет по оптимизации солнечных пятен.',
  'Освоил искусство выглядеть занятым во сне.',
  'Рекордсмен офиса по длительности непрерывного сна.',
  'Сертифицирован по продвинутому сталкиванию бумаг со стола.',
  'Наставник молодых котов в искусстве медленного моргания.',
  'Посетил все совещания. Внёс ноль полезных идей.',
  'Известен стратегическим обнулением входящих (удалением).',
  'Изобрёл дрёму за стоячим столом. Патент на рассмотрении.',
  'Владеет языком тела. В основном говорит «не трогай».',
  'Оптимизировал офисные запасы снеков. Для личных нужд.',
  'Председатель ежеквартального совета по уходу за шерстью.',
  'Сломал принтер дважды. Оба раза обвинил стажёра.',
  'Чёрный пояс по пассивному сопротивлению.',
  'Автор корпоративной политики дремоты. Сам и соблюдает.',
  'Пережил 12 реорганизаций. Пережил 4 руководителей.',
  'Специализируется на стратегической неопределённости.',
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

  /**
   * Picks a random biography from the language-appropriate biography pool.
   *
   * Each biography is an office-themed phrase of at most 100 characters.
   *
   * Requirements 2.1, 2.2, 2.3, 2.4, 2.6
   *
   * @param language - Language code for the biography pool ('en' | 'ru')
   */
  generateBiography(language: 'en' | 'ru'): string {
    const pool = language === 'ru' ? CAT_BIOS_RU : CAT_BIOS_EN;
    return pick(pool);
  }
}
