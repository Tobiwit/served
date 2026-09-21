import type { Ingredient, Recipe, RecipeIngredient } from '@/lib/db/types';
import { toGrams } from '@/lib/nutrition/units';
import { optionIds } from './candidates';

/**
 * The recipe as this run has left it.
 *
 * Ruling out an optional ingredient and swapping a slot are decisions about the
 * plate in front of you, so the plate's numbers have to follow: a caesar without the
 * parmesan is not the same 489 kcal, and saying it is undoes the point of ruling
 * anything out. This produces the variant those decisions describe, and the ordinary
 * scoring pass runs over it unchanged.
 *
 * Nothing here is written down. The stored recipe is what was written; this is what
 * is being made today, and it lasts exactly as long as the run does.
 */

/**
 * The order a swappable slot offers its options in: the recipe's own, except that
 * anything you said you wanted moves to the front.
 *
 * Shared with the Explore capsules deliberately. The pill you see leading the chain
 * and the ingredient the macros are counted from have to be the same one.
 */
export function slotOptions(ri: RecipeIngredient, boosted: Set<string>): string[] {
  const ids = optionIds(ri);
  if (ri.role !== 'substitutable' || ids.length < 2) return ids.slice(0, 1);
  // stable, so anything unboosted keeps the order the recipe wrote it in
  return [...ids].sort((a, b) => Number(boosted.has(b)) - Number(boosted.has(a)));
}

export interface RunState {
  excluded: Set<string>;
  boosted: Set<string>;
  /** identity of the run, so a cached variant can be recognised as still current */
  key: string;
}

export function runState(excluded: string[], boosted: string[]): RunState {
  return {
    excluded: new Set(excluded),
    boosted: new Set(boosted),
    key: `${[...excluded].sort().join(',')}|${[...boosted].sort().join(',')}`,
  };
}

/**
 * Memoised per recipe. Analyses are cached on recipe *identity* upstream, so handing
 * back a fresh object for an untouched recipe would quietly recompute every score in
 * the library on every keystroke.
 */
const cache = new WeakMap<Recipe, { key: string; result: Recipe }>();

export function recipeForRun(recipe: Recipe, run: RunState, index: Map<string, Ingredient>): Recipe {
  // Wanting something counts as much as ruling something out: a want promotes its
  // option to the head of a swap chain, and the Explore pill leading that chain is
  // then the ingredient on the plate. The macros have to be counted from the same
  // one, or the capsule says chicken while the numbers are still halloumi.
  if (!run.excluded.size && !run.boosted.size) return recipe;

  const hit = cache.get(recipe);
  if (hit && hit.key === run.key) return hit.result;

  const result = build(recipe, run, index);
  cache.set(recipe, { key: run.key, result });
  return result;
}

function build(recipe: Recipe, run: RunState, index: Map<string, Ingredient>): Recipe {
  let changed = false;
  const ingredients: RecipeIngredient[] = [];

  for (const ri of recipe.ingredients) {
    // A ruled-out core ingredient takes the whole recipe with it, which the
    // candidate evaluator decides; by the time anything is displayed that has
    // already happened, so core lines are passed through untouched.
    if (ri.role === 'optional' && ri.ingredient_id && run.excluded.has(ri.ingredient_id)) {
      changed = true;
      continue;
    }

    if (ri.role === 'substitutable') {
      const live = slotOptions(ri, run.boosted).find((id) => !run.excluded.has(id));
      if (!live) {
        changed = true;
        continue;
      }
      if (live !== ri.ingredient_id) {
        const sub = ri.substitutions.find((s) => s.substitute_ingredient_id === live);
        if (sub) {
          changed = true;
          ingredients.push(standIn(ri, sub, live, index));
          continue;
        }
      }
    }

    ingredients.push(ri);
  }

  return changed ? { ...recipe, ingredients } : recipe;
}

/** The slot, made of the option actually standing in it. */
function standIn(
  ri: RecipeIngredient,
  sub: RecipeIngredient['substitutions'][number],
  ingredientId: string,
  index: Map<string, Ingredient>,
): RecipeIngredient {
  /**
   * A stand-in with no quantity of its own is the same measure made of something
   * else, so it inherits the line. One that states an amount but was saved before
   * weights were resolved gets weighed here rather than silently borrowing a number
   * that belongs to a different ingredient.
   */
  const declaresOwn = sub.amount != null || sub.grams != null;
  const grams = !declaresOwn
    ? ri.grams
    : (sub.grams ?? toGrams(sub.amount, sub.unit ?? ri.unit, index.get(ingredientId) ?? null));

  return {
    ...ri,
    ingredient_id: ingredientId,
    display_name: sub.display_name,
    amount: declaresOwn ? sub.amount : ri.amount,
    unit: declaresOwn ? (sub.unit ?? ri.unit) : ri.unit,
    grams,
    notes: sub.notes ?? ri.notes,
    // the chain is already resolved; carrying it would double-count the slot
    substitutions: [],
  };
}
