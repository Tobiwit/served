import type { Ingredient, IngredientCategory, Recipe } from '@/lib/db/types';
import { computeNutrition, type NutritionResult } from '@/lib/nutrition/calc';

/** Typical water content per category, used when an ingredient has no water value. */
const WATER_DEFAULT: Record<IngredientCategory, number> = {
  vegetable: 90,
  fruit: 84,
  legume: 66,
  whole_grain: 60,
  refined_grain: 55,
  ready_made: 55,
  plant_protein: 70,
  protein_lean: 68,
  protein_fatty: 60,
  processed_meat: 45,
  seafood: 74,
  egg: 75,
  dairy_low_fat: 85,
  dairy_full_fat: 72,
  cheese: 42,
  protein_supplement: 6,
  nuts_seeds: 5,
  oil: 0,
  fat_solid: 16,
  sweetener: 18,
  sauce_condiment: 62,
  spice: 10,
  beverage: 95,
  other: 55,
};

export const PRODUCE: IngredientCategory[] = ['vegetable', 'fruit', 'legume'];
export const PROCESSED: IngredientCategory[] = [
  'refined_grain',
  'ready_made',
  'protein_supplement',
  'processed_meat',
  'sweetener',
  'sauce_condiment',
  'fat_solid',
];
export const SALTY: IngredientCategory[] = ['sauce_condiment', 'cheese', 'processed_meat', 'ready_made'];

/**
 * Roughly what share of this kind of food's own fat is saturated.
 *
 * The category answers *what kind of fat*, which no macro can: butter and olive oil
 * are both essentially pure fat and belong at opposite ends. The ingredient's
 * `fat_100g` answers *how much of it*, which no category can: a light mozzarella and
 * a mascarpone are the same shelf and not remotely the same fat.
 *
 * Membership of a "saturated" list used to answer both at once, weighted by the mass
 * of the ingredient — so a dish took the full saturated penalty for containing any
 * cheese at all, and a light one was scored exactly like double cream. Multiplying
 * these shares by the grams of fat actually present is the whole fix, and it needs no
 * data the ingredients do not already carry.
 *
 * Ordinary food-composition figures, kept deliberately coarse.
 */
export const SATURATED_SHARE: Record<IngredientCategory, number> = {
  vegetable: 0.2,
  fruit: 0.18,
  legume: 0.16,
  whole_grain: 0.2,
  refined_grain: 0.24,
  // a filling and a casing of unknown make: assume nothing either way
  ready_made: 0.33,
  // soy and wheat fat is mostly unsaturated
  plant_protein: 0.17,
  protein_lean: 0.3,
  protein_fatty: 0.35,
  processed_meat: 0.38,
  seafood: 0.22,
  egg: 0.31,
  dairy_low_fat: 0.62,
  dairy_full_fat: 0.62,
  cheese: 0.63,
  // dairy fat in the powders, palm and cocoa butter in the bars
  protein_supplement: 0.55,
  nuts_seeds: 0.11,
  oil: 0.14,
  fat_solid: 0.65,
  sweetener: 0.3,
  sauce_condiment: 0.2,
  spice: 0.2,
  beverage: 0.3,
  other: 0.33,
};

/**
 * The share of fat above which a dish reads as saturated-leaning. A third is about
 * where an ordinary mixed diet sits, so that is the point the term is worth nothing
 * either way.
 */
export const SATURATED_NEUTRAL = 0.33;

export interface ScoreContext {
  nutrition: NutritionResult;
  gramsPerServing: number;
  /** kcal per 100 g of food */
  calorieDensity: number | null;
  /** g protein per 100 kcal */
  proteinDensity: number | null;
  fiberPerServing: number | null;
  /** mass fraction 0..1 for a set of categories */
  fraction: (cats: IngredientCategory[]) => number;
  /** grams of fat per serving, over the ingredients that carry a fat value */
  fatPerServing: number | null;
  /** 0..1 — how much of that fat comes from saturated-leaning sources */
  saturatedShare: number | null;
  /** estimated water share of total mass, 0..1 */
  waterFraction: number;
  /** too little data to score honestly */
  thin: boolean;
}

export function buildContext(recipe: Recipe, index: Map<string, Ingredient>): ScoreContext {
  const nutrition = computeNutrition(recipe, index);
  const servings = Math.max(1, recipe.servings || 1);

  const byCategory = new Map<IngredientCategory, number>();
  let mass = 0;
  let water = 0;
  let fat = 0;
  let saturated = 0;

  for (const ri of recipe.ingredients) {
    if (ri.grams == null || ri.grams <= 0) continue;
    const ing = ri.ingredient_id ? index.get(ri.ingredient_id) : undefined;
    const cat: IngredientCategory = ing?.category ?? 'other';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + ri.grams);
    mass += ri.grams;
    const w = ing?.water_100g ?? WATER_DEFAULT[cat];
    water += (ri.grams * w) / 100;

    // an unknown fat value stays unknown here too, exactly as it does in the sums
    if (ing?.fat_100g != null) {
      const grams = (ri.grams * ing.fat_100g) / 100;
      fat += grams;
      saturated += grams * SATURATED_SHARE[cat];
    }
  }

  const gramsPerServing = mass / servings;
  const kcal = nutrition.perServing.kcal;
  const protein = nutrition.perServing.protein;

  return {
    nutrition,
    gramsPerServing,
    calorieDensity: kcal != null && gramsPerServing > 0 ? (kcal / gramsPerServing) * 100 : null,
    proteinDensity: protein != null && kcal != null && kcal > 0 ? (protein / kcal) * 100 : null,
    fiberPerServing: nutrition.perServing.fiber,
    fraction: (cats) => (mass > 0 ? cats.reduce((a, c) => a + (byCategory.get(c) ?? 0), 0) / mass : 0),
    fatPerServing: fat > 0 ? fat / servings : null,
    saturatedShare: fat > 0 ? saturated / fat : null,
    waterFraction: mass > 0 ? water / mass : 0,
    thin: mass <= 0 || nutrition.completeness < 0.5,
  };
}

/** Clamped linear map. ramp(x, 2, 10, 0, 100) is 0 at x<=2 and 100 at x>=10. */
export function ramp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = (x - x0) / (x1 - x0);
  const c = Math.min(1, Math.max(0, t));
  return y0 + (y1 - y0) * c;
}
