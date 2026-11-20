import type { FoodLogItem, Ingredient } from '@/lib/db/types';
import { toGrams } from '@/lib/nutrition/units';
import { applyMatch, draftIngredient, emptyDraft, withSwapRows, type Draft } from './draft';

/**
 * Starting a recipe from something already eaten.
 *
 * A meal logged on the tracker is often the first time a dish gets written down at
 * all, so its lines can become the start of a recipe: the meal's name as the title,
 * its ingredients as the ingredient list, and the editor takes it from there.
 *
 * The lines travel to the Add screen through this handoff rather than the URL — a
 * plate can carry a dozen lines, and none of it belongs in an address bar. It is
 * held in memory for the in-app navigation, with sessionStorage behind it so a
 * reload on the way still lands; it is taken exactly once.
 */

export interface RecipeSeed {
  title: string;
  items: FoodLogItem[];
}

const KEY = 'served.add.seed';
let pending: RecipeSeed | null = null;

export function handOffRecipe(seed: RecipeSeed) {
  pending = seed;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(seed));
  } catch {
    /* private mode — the in-memory copy carries it */
  }
}

export function takeRecipeSeed(): RecipeSeed | null {
  let seed = pending;
  pending = null;
  try {
    if (!seed) {
      const raw = window.sessionStorage.getItem(KEY);
      seed = raw ? (JSON.parse(raw) as RecipeSeed) : null;
    }
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing stored */
  }
  return seed;
}

/** A line that stands for a whole older entry, not an ingredient — never a recipe line. */
export function isStandIn(item: FoodLogItem): boolean {
  return !item.ingredient_id && item.grams == null && / \(as logged\)$/.test(item.name);
}

/**
 * The seed as a recipe draft for one plate. A line with a known ingredient arrives
 * already matched to it — it was matched once when it was logged, and guessing
 * again from the name could only make it worse. Its measure is kept as written
 * ("2 eggs") when that still weighs what was logged, and given in grams otherwise,
 * so a line reweighed on the tracker keeps its new weight.
 */
export function draftFromSeed(seed: RecipeSeed, ingredients: Ingredient[], index: Map<string, Ingredient>): Draft {
  const rows = seed.items
    .filter((item) => !isStandIn(item))
    .map((item) => {
      const ing = item.ingredient_id ? (index.get(item.ingredient_id) ?? null) : null;
      // a bare count ("2 eggs") is pieces, as it was when it was weighed for the log
      const written = item.unit ?? (item.amount != null ? 'piece' : null);
      const asWritten = item.amount != null ? toGrams(item.amount, written, ing) : null;
      const keepsMeasure = item.grams == null || (asWritten != null && Math.abs(asWritten - item.grams) < 1);
      const amount = keepsMeasure ? item.amount : Math.round(item.grams! * 10) / 10;
      const unit = keepsMeasure ? (asWritten != null ? written : item.unit) : 'g';

      const row = draftIngredient({ name: item.name, amount, unit, notes: null, role: 'core' }, ingredients, index);
      return ing ? { ...applyMatch(row, ing, index), collapsed: true } : row;
    });

  return withSwapRows({ ...emptyDraft(), title: seed.title, ingredients: rows });
}
