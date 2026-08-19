import type { CourseType, IngredientRole } from '@/lib/db/types';
import { normalizeUnit } from '@/lib/nutrition/units';

/**
 * Recipe text parser.
 *
 * Handles what people actually paste: a website's copy block, a ChatGPT answer, a
 * note, an Instagram caption. It aims to get the structure roughly right and then
 * hand over to a review screen — it never has to be perfect, because nothing is
 * saved until you have looked at it.
 */

export interface ParsedIngredient {
  raw: string;
  amount: number | null;
  unit: string | null;
  name: string;
  notes: string | null;
  role: IngredientRole;
}

export interface ParsedRecipe {
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  cuisine: string | null;
  course_type: CourseType | null;
  ingredients: ParsedIngredient[];
  instructions: string[];
}

const VULGAR: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅙': 1 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const UNIT_WORDS = [
  'g',
  'gram',
  'grams',
  'gramm',
  'kg',
  'mg',
  'ml',
  'l',
  'dl',
  'cl',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tbs',
  'el',
  'tsp',
  'teaspoon',
  'teaspoons',
  'tl',
  'cup',
  'cups',
  'oz',
  'lb',
  'piece',
  'pieces',
  'pc',
  'pcs',
  'stk',
  'clove',
  'cloves',
  'slice',
  'slices',
  'can',
  'cans',
  'tin',
  'handful',
  'handfuls',
  'pinch',
  'bunch',
  'bunches',
  'sprig',
  'sprigs',
  'stalk',
  'stalks',
  'scoop',
  'scoops',
];

const INGREDIENT_HEADS = /^(ingredients?|zutaten|you will need|shopping list)\b/i;
const METHOD_HEADS = /^(instructions?|method|directions?|steps?|preparation|zubereitung)\b/i;
const NOISE = /^(notes?|nutrition|tips?|storage|equipment|serves?|prep time|cook time|total time)\b/i;

/** "1 1/2", "1½", "0.5", "2-3" (takes the lower bound). */
function parseQuantity(token: string): number | null {
  let t = token.trim();
  for (const [glyph, value] of Object.entries(VULGAR)) {
    if (t.includes(glyph)) {
      const whole = parseFloat(t.replace(glyph, '')) || 0;
      return whole + value;
    }
  }
  t = t.split(/[-–—]/)[0].trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const num = t.replace(',', '.');
  return /^\d*\.?\d+$/.test(num) ? Number(num) : null;
}

const QUANTITY_HEAD = /^\s*(\d+[\d\s./,–—-]*|[½⅓⅔¼¾⅕⅙⅛⅜⅝⅞])\s*/;

function looksLikeIngredient(line: string): boolean {
  if (QUANTITY_HEAD.test(line)) return true;
  if (/^[-•*·]\s+/.test(line)) return true;
  return false;
}

export function parseIngredientLine(rawLine: string): ParsedIngredient {
  const raw = rawLine.replace(/^[-•*·]\s*/, '').trim();
  let rest = raw;
  let amount: number | null = null;
  let unit: string | null = null;

  const q = rest.match(QUANTITY_HEAD);
  if (q) {
    amount = parseQuantity(q[1]);
    rest = rest.slice(q[0].length);
  }

  const first = rest.split(/\s+/)[0]?.toLowerCase().replace(/\.$/, '') ?? '';
  if (UNIT_WORDS.includes(first)) {
    unit = normalizeUnit(first);
    rest = rest.slice(rest.indexOf(rest.split(/\s+/)[0]) + rest.split(/\s+/)[0].length).trim();
  }

  // a parenthetical or a trailing clause after a comma is preparation, not identity
  let notes: string | null = null;
  const paren = rest.match(/\(([^)]*)\)/);
  if (paren) {
    notes = paren[1].trim();
    rest = rest.replace(paren[0], ' ').trim();
  }
  const comma = rest.indexOf(',');
  if (comma > 0) {
    const tail = rest.slice(comma + 1).trim();
    if (tail) notes = notes ? `${notes}, ${tail}` : tail;
    rest = rest.slice(0, comma).trim();
  }

  const name = rest.replace(/\s+/g, ' ').trim();
  const optional = /\boptional\b/i.test(raw);

  return {
    raw,
    amount,
    unit: unit ?? (amount != null && !unit ? null : unit),
    name,
    notes,
    role: optional ? 'optional' : 'core',
  };
}

function findNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

const COURSE_HINTS: [RegExp, CourseType][] = [
  [/\b(breakfast|brunch|frühstück)\b/i, 'breakfast'],
  [/\b(lunch|mittag)\b/i, 'lunch'],
  [/\b(dinner|supper|abendessen)\b/i, 'dinner'],
  [/\b(snack)\b/i, 'snack'],
  [/\b(dessert|pudding|nachtisch)\b/i, 'dessert'],
];

const CUISINE_HINTS = [
  'Italian',
  'Mediterranean',
  'Japanese',
  'Korean',
  'Mexican',
  'Indian',
  'German',
];

export function parseRecipeText(input: string): ParsedRecipe {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const ingredients: ParsedIngredient[] = [];
  const instructions: string[] = [];
  let title = '';
  let description: string | null = null;
  let section: 'unknown' | 'ingredients' | 'method' = 'unknown';

  for (const line of lines) {
    if (INGREDIENT_HEADS.test(line)) {
      section = 'ingredients';
      continue;
    }
    if (METHOD_HEADS.test(line)) {
      section = 'method';
      continue;
    }

    if (!title && !looksLikeIngredient(line) && !NOISE.test(line) && line.length < 90) {
      title = line.replace(/^#+\s*/, '').replace(/[:.]$/, '');
      continue;
    }

    if (NOISE.test(line) && section !== 'method') continue;

    if (section === 'method') {
      const step = line.replace(/^\s*(?:step\s*)?\d+[).:]?\s*/i, '').trim();
      if (step.length > 2) instructions.push(step);
      continue;
    }

    if (looksLikeIngredient(line)) {
      section = 'ingredients';
      ingredients.push(parseIngredientLine(line));
      continue;
    }

    // long prose before the ingredients is the description; after, it is a step
    if (section === 'unknown' && !description && line.length > 30) {
      description = line;
      continue;
    }
    if (section === 'ingredients' && line.length > 40) {
      instructions.push(line);
      section = 'method';
    }
  }

  const prep = findNumber(input, [/prep(?:aration)?\s*(?:time)?\s*[:\-]?\s*(\d+)/i]);
  const cook = findNumber(input, [/cook(?:ing)?\s*(?:time)?\s*[:\-]?\s*(\d+)/i, /bake\s*(?:for)?\s*(\d+)/i]);
  const total =
    findNumber(input, [/total\s*(?:time)?\s*[:\-]?\s*(\d+)/i, /ready in\s*(\d+)/i]) ??
    (prep != null || cook != null ? (prep ?? 0) + (cook ?? 0) : findNumber(input, [/(\d+)\s*min/i]));

  const servings =
    findNumber(input, [/serves?\s*[:\-]?\s*(\d+)/i, /(\d+)\s*servings?/i, /(\d+)\s*portionen/i, /yield[s]?\s*[:\-]?\s*(\d+)/i]) ??
    1;

  const course = COURSE_HINTS.find(([re]) => re.test(input))?.[1] ?? null;
  const cuisine = CUISINE_HINTS.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(input)) ?? null;

  return {
    title: title || 'Untitled recipe',
    description,
    servings: Math.max(1, servings),
    prep_minutes: prep,
    cook_minutes: cook,
    total_minutes: total,
    cuisine,
    course_type: course,
    ingredients,
    instructions,
  };
}
