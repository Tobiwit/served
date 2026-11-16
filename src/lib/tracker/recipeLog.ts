import type { FoodLogItem, Ingredient, Recipe, RecipeIngredient } from '@/lib/db/types';
import { standIn } from '@/lib/explore/liveRecipe';
import { round1 } from './model';

/**
 * Logging a recipe as the plate actually was.
 *
 * A recipe is written with choices left open — optionals that may not make the cut,
 * swappable slots with stand-ins — and the tracker should count what was eaten, not
 * what was written. So a recipe is logged as its lines: each one weighed for the
 * portion eaten, with the optionals you left out gone and every swap made of the
 * ingredient that actually stood in it. Totals are the sum of those lines.
 *
 * Keeping the lines is also what lets an entry be adjusted afterwards — a line
 * removed, reweighed, or something added — without touching the recipe itself.
 */

export interface PlateChoices {
  /** recipe-ingredient ids of optionals left out */
  dropped: Set<string>;
  /** recipe-ingredient id of a swappable slot → the ingredient that stood in it */
  swaps: Map<string, string>;
}

export const NO_CHOICES: PlateChoices = { dropped: new Set(), swaps: new Map() };

export interface SwapSlot {
  ri: RecipeIngredient;
  options: { ingredientId: string; name: string }[];
}

/** The decisions a recipe leaves open: which optionals there are, which slots can swap. */
export function openChoices(recipe: Recipe, index: Map<string, Ingredient>) {
  const optionals = recipe.ingredients.filter((ri) => ri.role === 'optional');
  const swaps: SwapSlot[] = recipe.ingredients
    .filter((ri) => ri.role === 'substitutable' && ri.ingredient_id && ri.substitutions.some((s) => s.substitute_ingredient_id))
    .map((ri) => ({
      ri,
      options: [
        { ingredientId: ri.ingredient_id!, name: index.get(ri.ingredient_id!)?.name ?? ri.display_name },
        ...ri.substitutions
          .filter((s) => s.substitute_ingredient_id)
          .map((s) => ({ ingredientId: s.substitute_ingredient_id!, name: index.get(s.substitute_ingredient_id!)?.name ?? s.display_name })),
      ],
    }));
  return { optionals, swaps };
}

/** The recipe as made: optionals dropped, every slot made of its chosen ingredient. */
export function plateOf(recipe: Recipe, choices: PlateChoices, index: Map<string, Ingredient>): Recipe {
  const ingredients: RecipeIngredient[] = [];
  for (const ri of recipe.ingredients) {
    if (ri.role === 'optional' && choices.dropped.has(ri.id)) continue;
    const chosen = choices.swaps.get(ri.id);
    if (ri.role === 'substitutable' && chosen && chosen !== ri.ingredient_id) {
      const sub = ri.substitutions.find((s) => s.substitute_ingredient_id === chosen);
      if (sub) {
        ingredients.push(standIn(ri, sub, chosen, index));
        continue;
      }
    }
    ingredients.push(ri);
  }
  return { ...recipe, ingredients };
}

/** One weighed line, valued from the ingredient table as it stands now. */
export function itemOf(
  ingredient: Ingredient | null,
  grams: number | null,
  fallbackName: string,
  amount: number | null = null,
  unit: string | null = null,
): FoodLogItem {
  const per = (v: number | null | undefined) => (grams != null && v != null ? round1((grams / 100) * v) : null);
  return {
    name: ingredient?.name ?? fallbackName,
    ingredient_id: ingredient?.id ?? null,
    amount,
    unit,
    grams,
    kcal: per(ingredient?.kcal_100g),
    protein: per(ingredient?.protein_100g),
    carbs: per(ingredient?.carbs_100g),
    fat: per(ingredient?.fat_100g),
  };
}

/**
 * The lines of a plate, for the portion eaten. Seasoning with no weight is left
 * off — it counts for nothing and would only crowd the list you edit later.
 */
export function plateItems(plate: Recipe, servings: number, index: Map<string, Ingredient>): FoodLogItem[] {
  const share = servings / Math.max(1, plate.servings || 1);
  const items: FoodLogItem[] = [];
  for (const ri of plate.ingredients) {
    const grams = ri.grams != null && ri.grams > 0 ? round1(ri.grams * share) : null;
    if (grams == null && ri.role === 'basic') continue;
    const ingredient = ri.ingredient_id ? (index.get(ri.ingredient_id) ?? null) : null;
    const amount = ri.amount != null ? round1(ri.amount * share) : null;
    items.push(itemOf(ingredient, grams, ri.display_name, amount, ri.unit));
  }
  return items;
}

export interface ItemTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** What a list of lines adds up to — unknown lines count for nothing, as everywhere else. */
export function sumItems(items: FoodLogItem[]): ItemTotals {
  const sum = (k: keyof ItemTotals) => round1(items.reduce((s, i) => s + (i[k] ?? 0), 0));
  return { kcal: Math.round(sum('kcal')), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
}
