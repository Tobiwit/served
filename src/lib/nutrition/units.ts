import type { Ingredient } from '@/lib/db/types';

/**
 * Unit → grams.
 *
 * Ingredient-specific conversions always win (1 tbsp olive oil is 13.5 g, 1 tbsp
 * honey is 21 g). The global table is a last resort and deliberately conservative:
 * if we can't be reasonably sure, we return null and the gram value stays unknown.
 */

const MASS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, mg: 0.001, oz: 28.35, lb: 453.6 };

/** volume units, assuming ~water density — approximate by nature */
const VOLUME: Record<string, number> = {
  ml: 1,
  l: 1000,
  dl: 100,
  cl: 10,
  tbsp: 15,
  tsp: 5,
  cup: 240,
  'fl oz': 30,
};

/** units that only make sense per ingredient */
export const COUNT_UNITS = ['piece', 'clove', 'slice', 'can', 'handful', 'pinch', 'bunch', 'sprig', 'stalk', 'scoop'];

const ALIASES: Record<string, string> = {
  gramm: 'g',
  gr: 'g',
  kilogram: 'kg',
  milliliter: 'ml',
  millilitre: 'ml',
  liter: 'l',
  litre: 'l',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbs: 'tbsp',
  el: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tl: 'tsp',
  cups: 'cup',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  stk: 'piece',
  stück: 'piece',
  cloves: 'clove',
  slices: 'slice',
  cans: 'can',
  tin: 'can',
  scoops: 'scoop',
  handfuls: 'handful',
  bunches: 'bunch',
  sprigs: 'sprig',
  stalks: 'stalk',
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  return ALIASES[u] ?? u;
}

export function isKnownUnit(unit: string | null): boolean {
  if (!unit) return false;
  return unit in MASS || unit in VOLUME || COUNT_UNITS.includes(unit);
}

/** Resolve an amount + unit to grams, or null when genuinely unknown. */
export function toGrams(
  amount: number | null | undefined,
  unit: string | null | undefined,
  ingredient?: Ingredient | null,
): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const u = normalizeUnit(unit);

  if (u && ingredient) {
    const own = ingredient.unit_conversions.find((c) => normalizeUnit(c.unit) === u);
    if (own) return round(amount * own.grams_per_unit);
  }
  if (!u) return null;
  if (u in MASS) return round(amount * MASS[u]);
  if (u in VOLUME) return round(amount * VOLUME[u]);
  return null;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function formatAmount(amount: number | null, unit: string | null): string {
  if (amount == null) return unit ?? '';
  const a = Number.isInteger(amount) ? String(amount) : trimFraction(amount);
  return unit ? `${a} ${unit}` : a;
}

function trimFraction(n: number) {
  const common: [number, string][] = [
    [0.25, '¼'],
    [0.33, '⅓'],
    [0.5, '½'],
    [0.66, '⅔'],
    [0.75, '¾'],
  ];
  const whole = Math.floor(n);
  const frac = n - whole;
  for (const [v, glyph] of common) {
    if (Math.abs(frac - v) < 0.02) return whole ? `${whole}${glyph}` : glyph;
  }
  return String(Math.round(n * 100) / 100);
}
