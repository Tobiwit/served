import type { Ingredient, Recipe, RecipeIngredient } from '@/lib/db/types';

/**
 * Nutrition maths.
 *
 * The single rule this file exists to enforce: a missing macro is *unknown*, not
 * zero. Sums only include ingredients that actually carry the value, and every
 * result reports how much of the dish's mass it was able to account for.
 */

export type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';

export const MACROS: MacroKey[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

export type Nutrition = Record<MacroKey, number | null>;

export const EMPTY_NUTRITION: Nutrition = { kcal: null, protein: null, carbs: null, fat: null, fiber: null };

const FIELD: Record<MacroKey, keyof Ingredient> = {
  kcal: 'kcal_100g',
  protein: 'protein_100g',
  carbs: 'carbs_100g',
  fat: 'fat_100g',
  fiber: 'fiber_100g',
};

export interface NutritionResult {
  total: Nutrition;
  perServing: Nutrition;
  /** grams of everything we could weigh */
  gramsTotal: number;
  gramsPerServing: number;
  /** 0..1 — share of weighed mass with a kcal value */
  completeness: number;
  /** per-macro share of mass covered */
  coverage: Record<MacroKey, number>;
  /** ingredients we could not weigh or match */
  unresolved: string[];
}

export interface ResolvedIngredient {
  ri: RecipeIngredient;
  ingredient: Ingredient | null;
  grams: number | null;
}

export function resolveIngredients(recipe: Recipe, index: Map<string, Ingredient>): ResolvedIngredient[] {
  return recipe.ingredients.map((ri) => ({
    ri,
    ingredient: ri.ingredient_id ? (index.get(ri.ingredient_id) ?? null) : null,
    grams: ri.grams,
  }));
}

export function computeNutrition(recipe: Recipe, index: Map<string, Ingredient>): NutritionResult {
  const resolved = resolveIngredients(recipe, index);
  const servings = Math.max(1, recipe.servings || 1);

  let gramsTotal = 0;
  const sums: Record<MacroKey, number> = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const knownGrams: Record<MacroKey, number> = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const unresolved: string[] = [];

  for (const { ri, ingredient, grams } of resolved) {
    if (grams == null || grams <= 0) {
      if (ri.role !== 'basic') unresolved.push(ri.display_name);
      continue;
    }
    gramsTotal += grams;
    if (!ingredient) {
      unresolved.push(ri.display_name);
      continue;
    }
    for (const m of MACROS) {
      const per100 = ingredient[FIELD[m]] as number | null;
      if (per100 == null) continue;
      sums[m] += (grams / 100) * per100;
      knownGrams[m] += grams;
    }
  }

  const total: Nutrition = { ...EMPTY_NUTRITION };
  const coverage = {} as Record<MacroKey, number>;
  for (const m of MACROS) {
    coverage[m] = gramsTotal > 0 ? knownGrams[m] / gramsTotal : 0;
    total[m] = knownGrams[m] > 0 ? round(sums[m]) : null;
  }

  const perServing: Nutrition = { ...EMPTY_NUTRITION };
  for (const m of MACROS) perServing[m] = total[m] == null ? null : round(total[m]! / servings);

  return {
    total,
    perServing,
    gramsTotal: round(gramsTotal),
    gramsPerServing: round(gramsTotal / servings),
    completeness: coverage.kcal,
    coverage,
    unresolved,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

export function formatMacro(v: number | null, unit = 'g'): string {
  if (v == null) return '—';
  return `${Math.round(v)}${unit}`;
}

export function formatKcal(v: number | null): string {
  if (v == null) return '—';
  return String(Math.round(v));
}
