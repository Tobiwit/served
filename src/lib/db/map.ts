/* eslint-disable @typescript-eslint/no-explicit-any */

import type { BacklogEntry, CookLogEntry, FoodLogEntry, Ingredient, Recipe, RecipeIngredient } from './types';
import { normalizeCourse } from './types';

/**
 * Postgres rows in, domain objects out.
 *
 * A recipe arrives from Supabase as a nest of joined child tables and is cached as
 * one whole object, which is also the shape the rest of the app passes around. This
 * is the single place that flattening happens.
 *
 * `deleted_at` is deliberately dropped here rather than carried on the domain type:
 * a tombstone is a sync instruction, not a recipe. The pull reads it off the raw row
 * and evicts the record; nothing above the data layer ever sees a deleted one.
 */

export function mapRecipe(row: any): Recipe {
  const ingredients: RecipeIngredient[] = (row.recipe_ingredients ?? [])
    .slice()
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((ri: any) => ({
      id: ri.id,
      ingredient_id: ri.ingredient_id,
      display_name: ri.display_name,
      amount: ri.amount,
      unit: ri.unit,
      grams: ri.grams,
      role: ri.role,
      sort_order: ri.sort_order,
      notes: ri.notes,
      substitutions: (ri.ingredient_substitutions ?? []).map((s: any) => ({
        id: s.id,
        substitute_ingredient_id: s.substitute_ingredient_id,
        display_name: s.display_name,
        amount: s.amount ?? null,
        unit: s.unit ?? null,
        grams: s.grams ?? null,
        amount_multiplier: s.amount_multiplier,
        notes: s.notes,
      })),
    }));

  const { recipe_ingredients, recipe_instructions, recipe_tags, deleted_at, ...rest } = row;

  return {
    ...rest,
    // rows written before 0002 ran still say lunch or dinner
    course_type: normalizeCourse(row.course_type),
    ingredients,
    instructions: (recipe_instructions ?? [])
      .slice()
      .sort((a: any, b: any) => a.step_number - b.step_number)
      .map((s: any) => ({ id: s.id, step_number: s.step_number, text: s.text })),
    tags: (recipe_tags ?? []).map((t: any) => t.tags?.name).filter(Boolean),
  };
}

export function mapIngredient(row: any): Ingredient {
  const { ingredient_aliases, ingredient_unit_conversions, deleted_at, ...rest } = row;
  return {
    ...rest,
    aliases: (ingredient_aliases ?? []).map((a: any) => a.alias),
    unit_conversions: (ingredient_unit_conversions ?? []).map((c: any) => ({
      unit: c.unit,
      grams_per_unit: c.grams_per_unit,
    })),
  };
}

export function mapCookLog(row: any): CookLogEntry {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    cooked_at: row.cooked_at,
    note: row.note ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapBacklog(row: any): BacklogEntry {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? null,
    image_url: row.image_url ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** PostgREST can hand `numeric` back as a string; the tracker does sums on these. */
function num(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapFoodLog(row: any): FoodLogEntry {
  return {
    id: row.id,
    day: String(row.day).slice(0, 10),
    kind: row.kind === 'activity' ? 'activity' : 'food',
    slot: row.slot ?? null,
    label: row.label ?? '',
    kcal: num(row.kcal) ?? 0,
    protein: num(row.protein),
    carbs: num(row.carbs),
    fat: num(row.fat),
    source: row.source,
    recipe_id: row.recipe_id ?? null,
    servings: num(row.servings),
    items: Array.isArray(row.items) ? row.items : [],
    logged_at: row.logged_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
