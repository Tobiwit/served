/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CookLogEntry, Ingredient, Recipe, RecipeIngredient } from './types';
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
