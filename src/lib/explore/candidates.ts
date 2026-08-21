import type { Ingredient, Recipe, RecipeIngredient } from '@/lib/db/types';
import type { RecipeAnalysis } from '@/lib/scoring';
import type { FilterState } from './filters';

/**
 * Candidate selection.
 *
 * all recipes
 *   -> apply setup filters
 *   -> drop recipes already seen this run
 *   -> excluded CORE ingredient: drop
 *   -> excluded OPTIONAL / SUBSTITUTABLE: keep (substitutable flags a swap)
 *   -> excluded BASIC: ignore entirely
 *   -> boost recipes containing long-pressed ingredients
 *
 * No learning, no model. Just a filter and a weighted shuffle.
 */

export interface Candidate {
  recipe: Recipe;
  analysis: RecipeAnalysis;
  /** substitutable ingredients the user excluded — the recipe survives, with a note */
  swaps: string[];
  boostHits: number;
}

export function passesFilters(recipe: Recipe, analysis: RecipeAnalysis, f: FilterState): boolean {
  const n = analysis.nutrition.perServing;

  if (f.protein.on && (n.protein == null || n.protein < f.protein.value)) return false;
  if (f.calories.on && (n.kcal == null || n.kcal > f.calories.value)) return false;
  if (f.volume.on && analysis.volume.score < f.volume.value) return false;
  if (f.health.on && analysis.health.score < f.health.value) return false;
  if (f.time.on) {
    const t = recipe.total_minutes;
    if (t == null || t > f.time.value) return false;
  }
  if (f.cuisineOn && f.cuisines.length && !(recipe.cuisine && f.cuisines.includes(recipe.cuisine))) return false;
  if (f.courses.length && !(recipe.course_type && f.courses.includes(recipe.course_type))) return false;
  return true;
}

/** How many recipes match the filters alone — the number shown before starting. */
export function countMatches(
  recipes: Recipe[],
  analysisFor: (r: Recipe) => RecipeAnalysis,
  filters: FilterState,
): number {
  return recipes.reduce((n, r) => n + (passesFilters(r, analysisFor(r), filters) ? 1 : 0), 0);
}

export function buildCandidates(
  recipes: Recipe[],
  analysisFor: (r: Recipe) => RecipeAnalysis,
  filters: FilterState,
  excluded: Set<string>,
  boosted: Set<string>,
  seen: Set<string>,
): Candidate[] {
  const out: Candidate[] = [];
  for (const recipe of recipes) {
    if (seen.has(recipe.id)) continue;
    const analysis = analysisFor(recipe);
    if (!passesFilters(recipe, analysis, filters)) continue;
    const c = evaluate(recipe, analysis, excluded, boosted);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Evaluate one recipe against the run's exclusions. Returns null when an excluded
 * ingredient is core to it; otherwise reports which substitutable ingredients now
 * need a swap.
 */
export function evaluate(
  recipe: Recipe,
  analysis: RecipeAnalysis,
  excluded: Set<string>,
  boosted: Set<string>,
): Candidate | null {
  const swaps: string[] = [];
  let boostHits = 0;

  for (const ri of recipe.ingredients) {
    const id = ri.ingredient_id;
    if (!id) continue;
    if (boosted.has(id)) boostHits++;

    if (ri.role === 'basic') continue;

    if (ri.role === 'core') {
      if (excluded.has(id)) return null;
      continue;
    }

    if (ri.role === 'substitutable') {
      // the slot needs *one* of its options; it only fails once they are all gone
      const group = optionIds(ri);
      const alive = group.filter((g) => !excluded.has(g));
      if (alive.length === 0) return null;
      if (excluded.has(id)) swaps.push(ri.display_name);
      continue;
    }

    // optional: excluding it costs the recipe nothing
  }

  return { recipe, analysis, swaps, boostHits };
}

/** Every ingredient that could fill a slot: the named one, then its alternatives. */
export function optionIds(ri: RecipeIngredient): string[] {
  const ids = ri.ingredient_id ? [ri.ingredient_id] : [];
  for (const s of ri.substitutions) if (s.substitute_ingredient_id) ids.push(s.substitute_ingredient_id);
  return ids;
}

/**
 * Pick the next recipe. Boosted matches float to the front; within a tier the
 * order is shuffled so the same run never feels like a fixed playlist.
 */
export function pickNext(candidates: Candidate[], seed = Math.random()): Candidate | null {
  if (!candidates.length) return null;
  const maxBoost = candidates.reduce((m, c) => Math.max(m, c.boostHits), 0);
  const tier = maxBoost > 0 ? candidates.filter((c) => c.boostHits === maxBoost) : candidates;
  return tier[Math.floor(seed * tier.length) % tier.length];
}

/**
 * Meaningful ingredients for the Explore capsules: never basics, at most ten,
 * heaviest and most defining first so the top of the list is what the dish *is*.
 */
export function exploreIngredients(recipe: Recipe, index: Map<string, Ingredient>, limit = 10) {
  const roleWeight = { core: 3, substitutable: 2, optional: 1, basic: 0 } as const;
  return recipe.ingredients
    .filter((ri) => {
      if (ri.role === 'basic') return false;
      const ing = ri.ingredient_id ? index.get(ri.ingredient_id) : null;
      return !(ing?.default_basic ?? false);
    })
    .slice()
    .sort((a, b) => {
      const r = roleWeight[b.role] - roleWeight[a.role];
      if (r !== 0) return r;
      return (b.grams ?? 0) - (a.grams ?? 0);
    })
    .slice(0, limit);
}
