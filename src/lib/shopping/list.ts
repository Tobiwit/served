import type { Ingredient, IngredientCategory, Recipe } from '@/lib/db/types';
import { newId } from '@/lib/db/adapter';
import { formatAmount } from '@/lib/nutrition/units';

/**
 * The shopping list.
 *
 * Device-local, unlike everything else the app stores. A list is a working document
 * for the next twenty minutes in a shop, not part of the collection: syncing it
 * would buy very little and cost the one thing that matters here, which is that
 * ticking something off is instant and stays ticked while you are standing in an
 * aisle with no signal.
 *
 * Crossing off is not deleting. An item goes grey and stays in place, because the
 * commonest thing after "got it" is "no, wrong one" — the same reason a ruled-out
 * ingredient in Explore keeps its position.
 */

export interface ShoppingItem {
  id: string;
  /** the ingredient this is, when the recipe line matched one — merging keys on it */
  ingredientId: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  category: IngredientCategory | null;
  recipeId: string;
  recipeTitle: string;
  checked: boolean;
  addedAt: string;
}

const KEY = 'served.shopping.v1';

/* --------------------------------------------------------------------- aisles */

export type Aisle = 'produce' | 'chilled' | 'meatfish' | 'pantry' | 'other';

/** Roughly the order a supermarket is walked, which is the only order that helps. */
export const AISLE_ORDER: Aisle[] = ['produce', 'chilled', 'meatfish', 'pantry', 'other'];

export const AISLE_LABEL: Record<Aisle, string> = {
  produce: 'Fruit & veg',
  chilled: 'Chilled',
  meatfish: 'Meat & fish',
  pantry: 'Pantry',
  other: 'Other',
};

const AISLE: Record<IngredientCategory, Aisle> = {
  vegetable: 'produce',
  fruit: 'produce',
  dairy_low_fat: 'chilled',
  dairy_full_fat: 'chilled',
  cheese: 'chilled',
  egg: 'chilled',
  plant_protein: 'chilled',
  ready_made: 'chilled',
  protein_lean: 'meatfish',
  protein_fatty: 'meatfish',
  processed_meat: 'meatfish',
  seafood: 'meatfish',
  legume: 'pantry',
  whole_grain: 'pantry',
  refined_grain: 'pantry',
  protein_supplement: 'pantry',
  nuts_seeds: 'pantry',
  oil: 'pantry',
  fat_solid: 'pantry',
  sweetener: 'pantry',
  sauce_condiment: 'pantry',
  spice: 'pantry',
  beverage: 'other',
  other: 'other',
};

export function aisleOf(category: IngredientCategory | null): Aisle {
  return category ? AISLE[category] : 'other';
}

/* ------------------------------------------------------------------ gathering */

/**
 * What a recipe adds to the list.
 *
 * Pantry staples are left off: nobody goes shopping for the salt. That is the same
 * `basic` rule Explore uses to decide which ingredients are worth showing as pills,
 * so the two screens agree about what counts as an ingredient you think about.
 */
export function itemsForRecipe(
  recipe: Recipe,
  index: Map<string, Ingredient>,
  scale = 1,
): ShoppingItem[] {
  const now = new Date().toISOString();

  return recipe.ingredients
    .filter((ri) => {
      if (ri.role === 'basic') return false;
      const ing = ri.ingredient_id ? index.get(ri.ingredient_id) : null;
      return !(ing?.default_basic ?? false);
    })
    .map((ri) => {
      const ing = ri.ingredient_id ? (index.get(ri.ingredient_id) ?? null) : null;
      return {
        id: newId('shop'),
        ingredientId: ri.ingredient_id,
        name: ri.display_name,
        amount: ri.amount == null ? null : Math.round(ri.amount * scale * 100) / 100,
        unit: ri.unit,
        category: ing?.category ?? null,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        checked: false,
        addedAt: now,
      };
    });
}

/* ------------------------------------------------------------------- grouping */

export type GroupBy = 'aisle' | 'recipe';

/** One line as it is shown. Several items can stand behind it. */
export interface ShoppingRow {
  key: string;
  /** every item this line covers — ticking it ticks all of them */
  ids: string[];
  name: string;
  measure: string;
  /** where it came from, when that is not already the heading */
  note: string | null;
  checked: boolean;
}

export interface ShoppingGroup {
  key: string;
  label: string;
  rows: ShoppingRow[];
}

export function groupItems(items: ShoppingItem[], by: GroupBy): ShoppingGroup[] {
  return by === 'recipe' ? byRecipe(items) : byAisle(items);
}

function byRecipe(items: ShoppingItem[]): ShoppingGroup[] {
  const groups = new Map<string, ShoppingGroup>();

  for (const item of items) {
    let group = groups.get(item.recipeId);
    if (!group) {
      group = { key: item.recipeId, label: item.recipeTitle, rows: [] };
      groups.set(item.recipeId, group);
    }
    group.rows.push({
      key: item.id,
      ids: [item.id],
      name: item.name,
      measure: formatAmount(item.amount, item.unit),
      note: null,
      checked: item.checked,
    });
  }

  return [...groups.values()];
}

/**
 * By aisle the recipe stops being the organising idea, so two recipes both wanting
 * kale become one line for 250 g of kale — which is what you actually pick up.
 * Amounts only add up when the units agree; otherwise both are shown, because
 * inventing a conversion between "2 cloves" and "15 g" would be a lie.
 */
function byAisle(items: ShoppingItem[]): ShoppingGroup[] {
  const merged = new Map<string, { row: ShoppingRow; items: ShoppingItem[]; aisle: Aisle }>();

  for (const item of items) {
    const identity = item.ingredientId ?? item.name.trim().toLowerCase();
    const key = `${aisleOf(item.category)}:${identity}`;
    const hit = merged.get(key);
    if (hit) hit.items.push(item);
    else merged.set(key, { row: { key, ids: [], name: item.name, measure: '', note: null, checked: false }, items: [item], aisle: aisleOf(item.category) });
  }

  const groups = new Map<Aisle, ShoppingGroup>();

  for (const { row, items: parts, aisle } of merged.values()) {
    row.ids = parts.map((p) => p.id);
    row.checked = parts.every((p) => p.checked);
    row.measure = combineMeasures(parts);
    const titles = [...new Set(parts.map((p) => p.recipeTitle))];
    row.note = titles.length > 1 ? `${titles.length} recipes` : titles[0];

    let group = groups.get(aisle);
    if (!group) {
      group = { key: aisle, label: AISLE_LABEL[aisle], rows: [] };
      groups.set(aisle, group);
    }
    group.rows.push(row);
  }

  return AISLE_ORDER.map((a) => groups.get(a)).filter((g): g is ShoppingGroup => !!g);
}

function combineMeasures(parts: ShoppingItem[]): string {
  const byUnit = new Map<string, number | null>();

  for (const p of parts) {
    const unit = p.unit ?? '';
    if (p.amount == null) {
      if (!byUnit.has(unit)) byUnit.set(unit, null);
      continue;
    }
    const running = byUnit.get(unit);
    byUnit.set(unit, running == null ? p.amount : running + p.amount);
  }

  return [...byUnit.entries()]
    .map(([unit, amount]) => formatAmount(amount == null ? null : Math.round(amount * 100) / 100, unit || null))
    .filter(Boolean)
    .join(' + ');
}

/* -------------------------------------------------------------------- storage */

export function loadList(): ShoppingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ShoppingItem[]) : [];
  } catch {
    return [];
  }
}

export function saveList(items: ShoppingItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota or private mode — the in-memory copy still works for this session */
  }
}
