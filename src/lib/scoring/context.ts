import type { Ingredient, IngredientCategory, Recipe } from '@/lib/db/types';
import { computeNutrition, type NutritionResult } from '@/lib/nutrition/calc';

/** Typical water content per category, used when an ingredient has no water value. */
const WATER_DEFAULT: Record<IngredientCategory, number> = {
  vegetable: 90,
  fruit: 84,
  legume: 66,
  whole_grain: 60,
  refined_grain: 55,
  protein_lean: 68,
  protein_fatty: 60,
  processed_meat: 45,
  seafood: 74,
  egg: 75,
  dairy_low_fat: 85,
  dairy_full_fat: 72,
  cheese: 42,
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
  'processed_meat',
  'sweetener',
  'sauce_condiment',
  'fat_solid',
];
export const UNSATURATED: IngredientCategory[] = ['nuts_seeds', 'oil', 'seafood'];
export const SATURATED: IngredientCategory[] = [
  'fat_solid',
  'cheese',
  'processed_meat',
  'dairy_full_fat',
  'protein_fatty',
];
export const SALTY: IngredientCategory[] = ['sauce_condiment', 'cheese', 'processed_meat'];

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

  for (const ri of recipe.ingredients) {
    if (ri.grams == null || ri.grams <= 0) continue;
    const ing = ri.ingredient_id ? index.get(ri.ingredient_id) : undefined;
    const cat: IngredientCategory = ing?.category ?? 'other';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + ri.grams);
    mass += ri.grams;
    const w = ing?.water_100g ?? WATER_DEFAULT[cat];
    water += (ri.grams * w) / 100;
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
