import type { FoodLogItem, Ingredient, MealSlot, NewFoodLogEntry, Recipe } from '@/lib/db/types';
import { normalize } from '@/lib/match/fuzzy';
import { formatAmount, toGrams } from '@/lib/nutrition/units';
import { NO_CHOICES, itemOf, plateItems, plateOf, sumItems } from './recipeLog';

/**
 * Quicklinks: the things eaten often enough that saying or typing them every time
 * is friction. One tap logs them.
 *
 * Matching here is exact on purpose — a name or an alias, nothing fuzzy. The
 * transcript can afford to guess because you watch every guess land; a one-tap log
 * cannot, and "oat milk" quietly logged as rolled oats would be worse than asking.
 * Anything missing is asked for once and then simply matches.
 */

export interface QuickItem {
  /** what it is called when it has to be created */
  name: string;
  /** every way it might already be stored */
  match: string[];
  amount: number;
  unit: string;
}

export type Quicklink =
  | { key: string; label: string; slot: MealSlot; kind: 'items'; items: QuickItem[] }
  | { key: string; label: string; slot: MealSlot; kind: 'recipe'; recipe: string; servings: number };

const OAT_MILK = ['oat milk', 'oatmilk', 'oat drink', 'hafermilch', 'haferdrink'];

export const QUICKLINKS: Quicklink[] = [
  {
    key: 'coffee-small',
    label: 'Coffee small',
    slot: 'coffee',
    kind: 'items',
    items: [{ name: 'Oat milk', match: OAT_MILK, amount: 150, unit: 'ml' }],
  },
  {
    key: 'coffee-big',
    label: 'Coffee big',
    slot: 'coffee',
    kind: 'items',
    items: [{ name: 'Oat milk', match: OAT_MILK, amount: 250, unit: 'ml' }],
  },
  { key: 'abendquark', label: 'Abendquark', slot: 'postgym', kind: 'recipe', recipe: 'Abendquark', servings: 1 },
  { key: 'quarkbowl', label: 'Quarkbowl', slot: 'lunch', kind: 'recipe', recipe: 'Quarkbowl', servings: 1 },
];

const squash = (s: string) => normalize(s).replace(/\s+/g, '');

/** An ingredient whose name or an alias is exactly one of `names` (spacing and case aside). */
export function exactIngredient(names: string[], ingredients: Ingredient[]): Ingredient | null {
  const wanted = new Set(names.map(squash));
  return ingredients.find((i) => wanted.has(squash(i.name)) || i.aliases.some((a) => wanted.has(squash(a)))) ?? null;
}

/** The recipe called exactly this, or failing that the one whose title starts with it. */
export function exactRecipe(title: string, recipes: Recipe[]): Recipe | null {
  const t = squash(title);
  return recipes.find((r) => squash(r.title) === t) ?? recipes.find((r) => squash(r.title).startsWith(t)) ?? null;
}

export type QuickPlan =
  | { ok: true; entry: Omit<NewFoodLogEntry, 'day'> }
  | { ok: false; missing: 'ingredient'; item: QuickItem }
  | { ok: false; missing: 'recipe'; title: string };

/**
 * Everything needed to log a quicklink now — or what is missing first. A recipe is
 * logged as written (every optional in, every slot as the recipe leads it): a quick
 * tap cannot ask, and the entry can be adjusted afterwards from the bar.
 */
export function planQuick(q: Quicklink, ingredients: Ingredient[], recipes: Recipe[], index: Map<string, Ingredient>): QuickPlan {
  if (q.kind === 'recipe') {
    const recipe = exactRecipe(q.recipe, recipes);
    if (!recipe) return { ok: false, missing: 'recipe', title: q.recipe };
    const items = plateItems(plateOf(recipe, NO_CHOICES, index), q.servings, index);
    return {
      ok: true,
      entry: { kind: 'food', slot: q.slot, label: q.label, ...sumItems(items), source: 'recipe', recipe_id: recipe.id, servings: q.servings, items },
    };
  }

  const items: FoodLogItem[] = [];
  for (const it of q.items) {
    const ing = exactIngredient([it.name, ...it.match], ingredients);
    if (!ing) return { ok: false, missing: 'ingredient', item: it };
    items.push(itemOf(ing, toGrams(it.amount, it.unit, ing), it.name, it.amount, it.unit));
  }
  return {
    ok: true,
    entry: { kind: 'food', slot: q.slot, label: q.label, ...sumItems(items), source: 'log', recipe_id: null, servings: null, items },
  };
}

/** The small line under a quicklink in the menu. */
export function quickCaption(q: Quicklink, plan: QuickPlan): string {
  if (!plan.ok) return plan.missing === 'recipe' ? 'Add recipe first' : `Set up ${plan.item.name.toLowerCase()}`;
  if (q.kind === 'items') return q.items.map((i) => `${formatAmount(i.amount, i.unit)} ${i.name.toLowerCase()}`).join(', ');
  return `${plan.entry.kcal} kcal`;
}
