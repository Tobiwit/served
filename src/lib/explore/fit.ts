import type { Ingredient, Recipe } from '@/lib/db/types';
import { analyzeRecipe, type RecipeAnalysis } from '@/lib/scoring';
import { passesFixed, passesScored } from './candidates';
import type { FilterState } from './filters';
import { buildVariant, EMPTY_PLAN, slotOptions, type FitPlan, type RunState } from './liveRecipe';

/**
 * Fitting a recipe to the filters.
 *
 * A recipe that misses "≥ 35 g protein" by a gram, when it already lists chicken as
 * a stand-in for the halloumi, should not be thrown away. The planner looks for the
 * smallest change the recipe itself allows that gets it over the line:
 *
 *   swaps     free. Whoever wrote the recipe said the option would do, so the slot
 *             simply runs on it, without comment.
 *   drops     guarded. Leaving things out changes the dish, so an optional is only
 *             left out when the plate then actually qualifies, when it moves a
 *             failing filter by a meaningful amount on its own (no "without lemon"
 *             to get from 502 to 499 kcal), and never more than two of them.
 *
 * It never touches what you decided during the run: ruled-out options stay out, and
 * a slot or optional you asked for stays exactly as you asked.
 */

/** Never leave out more than this many optionals. */
export const MAX_DROPS = 2;

/** Swap combinations tried before giving up — keeps a large user recipe cheap. */
const MAX_SWAP_COMBOS = 64;
/** Of those, how many are also tried with optionals left out. */
const MAX_DROP_BASES = 12;

/**
 * What a single left-out optional must achieve, per serving, on a filter that is
 * failing — otherwise it is not worth changing the dish for.
 */
export const DROP_IMPACT = {
  /** kcal saved: at least this many, and at least this share of the plate */
  kcal: { min: 25, share: 0.04 },
  /** score points gained */
  health: 2,
  volume: 2,
};

/** The filters a left-out ingredient can help with. Protein only ever goes down. */
type DropFilter = 'calories' | 'health' | 'volume';
const DROP_FILTERS: DropFilter[] = ['calories', 'health', 'volume'];

export interface Fit {
  plan: FitPlan;
  /** analysis of the plate the plan describes — throwaway, not the cached one */
  analysis: RecipeAnalysis;
}

/**
 * The smallest plan that makes `recipe` meet `filters` under `run`, or null when
 * none does. An empty plan means it fits as it is.
 */
export function planFit(
  recipe: Recipe,
  run: RunState,
  filters: FilterState,
  index: Map<string, Ingredient>,
): Fit | null {
  if (!passesFixed(recipe, filters)) return null;

  const analyze = (plan: FitPlan) => analyzeRecipe(buildVariant(recipe, run, index, plan), index);

  const base = analyze(EMPTY_PLAN);
  if (passesScored(base, filters)) return { plan: EMPTY_PLAN, analysis: base };

  // ---- swaps: every combination of the slots the planner is free to change
  const slots: { id: string; options: string[] }[] = [];
  for (const ri of recipe.ingredients) {
    if (ri.role !== 'substitutable') continue;
    const live = slotOptions(ri, run.boosted).filter((id) => !run.excluded.has(id));
    // a slot you asked something of is yours: the wanted option stays in it
    if (live.length < 2 || live.some((id) => run.boosted.has(id))) continue;
    slots.push({ id: ri.id, options: live });
  }

  const combos = swapCombos(slots);
  const tried: { picks: Record<string, string>; analysis: RecipeAnalysis }[] = [];
  for (const picks of combos) {
    const analysis = Object.keys(picks).length ? analyze({ picks, drops: [] }) : base;
    if (passesScored(analysis, filters)) return { plan: { picks, drops: [] }, analysis };
    tried.push({ picks, analysis });
  }

  // ---- drops: only for filters a missing ingredient can actually help
  const optionals = recipe.ingredients
    .filter((ri) => ri.role === 'optional' && ri.ingredient_id)
    .map((ri) => ri.ingredient_id!)
    .filter((id) => !run.excluded.has(id) && !run.boosted.has(id));
  if (!optionals.length) return null;

  const sets = dropSets(optionals);
  for (const { picks, analysis: without } of tried.slice(0, MAX_DROP_BASES)) {
    const failing = DROP_FILTERS.filter((k) => filters[k].on && !meets(k, without, filters));
    if (!failing.length) continue;

    for (const drops of sets) {
      const plan = { picks, drops };
      const analysis = analyze(plan);
      if (!passesScored(analysis, filters)) continue;
      const earns = drops.every((d) => {
        const kept = analyze({ picks, drops: drops.filter((x) => x !== d) });
        return failing.some((k) => meaningful(k, kept, analysis));
      });
      if (earns) return { plan, analysis };
    }
  }

  return null;
}

/** Combinations ordered by how many slots they change, so the first fit is the least edit. */
function swapCombos(slots: { id: string; options: string[] }[]): Record<string, string>[] {
  let all: Record<string, string>[] = [{}];
  for (const slot of slots) {
    const next: Record<string, string>[] = [];
    for (const combo of all) {
      next.push(combo);
      // options[0] is what the slot already runs on; only the others are changes
      for (const opt of slot.options.slice(1)) next.push({ ...combo, [slot.id]: opt });
      if (next.length >= MAX_SWAP_COMBOS * 4) break;
    }
    all = next;
  }
  return all.sort((a, b) => Object.keys(a).length - Object.keys(b).length).slice(0, MAX_SWAP_COMBOS);
}

/** Single drops first, then pairs. */
function dropSets(ids: string[]): string[][] {
  const out: string[][] = ids.map((id) => [id]);
  if (MAX_DROPS >= 2) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
  }
  return out;
}

function meets(k: DropFilter, a: RecipeAnalysis, f: FilterState): boolean {
  if (k === 'calories') {
    const kcal = a.nutrition.perServing.kcal;
    return kcal != null && kcal <= f.calories.value;
  }
  return a[k].score >= f[k].value;
}

/** Did leaving one thing out move filter `k` enough to be worth it? */
function meaningful(k: DropFilter, kept: RecipeAnalysis, dropped: RecipeAnalysis): boolean {
  if (k === 'calories') {
    const before = kept.nutrition.perServing.kcal;
    const after = dropped.nutrition.perServing.kcal;
    if (before == null || after == null) return false;
    const saved = before - after;
    return saved >= DROP_IMPACT.kcal.min && saved >= before * DROP_IMPACT.kcal.share;
  }
  return dropped[k].score - kept[k].score >= DROP_IMPACT[k];
}

/**
 * Memoised per recipe identity, for the current run and filters. The setup screen
 * re-asks on every tick of a slider, and nothing about an untouched recipe changes.
 */
// keyed on the ingredient index too: editing an ingredient's macros re-plans everything
const memos = new WeakMap<Map<string, Ingredient>, WeakMap<Recipe, { key: string; fit: Fit | null }>>();

export function fitFor(
  recipe: Recipe,
  run: RunState,
  filters: FilterState,
  index: Map<string, Ingredient>,
): Fit | null {
  let memo = memos.get(index);
  if (!memo) memos.set(index, (memo = new WeakMap()));
  const key = `${run.key}|${JSON.stringify(filters)}`;
  const hit = memo.get(recipe);
  if (hit && hit.key === key) return hit.fit;
  const fit = planFit(recipe, run, filters, index);
  memo.set(recipe, { key, fit });
  return fit;
}
