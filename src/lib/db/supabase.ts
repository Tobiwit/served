import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Ingredient, NewIngredient, NewRecipe, Recipe, RecipeIngredient } from './types';
import { newId, type Repo } from './adapter';

/**
 * Supabase adapter. Active whenever NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY are
 * set; otherwise the app falls back to the local store. Schema lives in
 * supabase/migrations/0001_init.sql.
 */

let client: SupabaseClient | null = null;

export function supabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

const RECIPE_SELECT = `
  *,
  recipe_ingredients ( *, ingredient_substitutions ( * ) ),
  recipe_instructions ( * ),
  recipe_tags ( tags ( name ) )
`;

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const;
  constructor(private db: SupabaseClient) {}

  async listRecipes(): Promise<Recipe[]> {
    const { data, error } = await this.db.from('recipes').select(RECIPE_SELECT).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRecipe);
  }

  async saveRecipe(recipe: NewRecipe): Promise<Recipe> {
    const id = recipe.id ?? newId('rec');
    const { ingredients, instructions, tags, ...row } = recipe;

    const { error: rErr } = await this.db.from('recipes').upsert({ ...row, id, updated_at: new Date().toISOString() });
    if (rErr) throw rErr;

    await this.db.from('recipe_ingredients').delete().eq('recipe_id', id);
    await this.db.from('recipe_instructions').delete().eq('recipe_id', id);

    if (ingredients.length) {
      const rows = ingredients.map((ri, i) => ({
        id: ri.id || newId('ri'),
        recipe_id: id,
        ingredient_id: ri.ingredient_id,
        display_name: ri.display_name,
        amount: ri.amount,
        unit: ri.unit,
        grams: ri.grams,
        role: ri.role,
        sort_order: i,
        notes: ri.notes,
      }));
      const { error } = await this.db.from('recipe_ingredients').insert(rows);
      if (error) throw error;

      const subs = ingredients.flatMap((ri, i) =>
        ri.substitutions.map((s) => ({
          id: s.id || newId('sub'),
          recipe_ingredient_id: rows[i].id,
          substitute_ingredient_id: s.substitute_ingredient_id,
          display_name: s.display_name,
          amount_multiplier: s.amount_multiplier,
          notes: s.notes,
        })),
      );
      if (subs.length) await this.db.from('ingredient_substitutions').insert(subs);
    }

    if (instructions.length) {
      await this.db
        .from('recipe_instructions')
        .insert(instructions.map((s, i) => ({ id: s.id || newId('st'), recipe_id: id, step_number: i + 1, text: s.text })));
    }

    await this.syncTags(id, tags);

    const { data, error } = await this.db.from('recipes').select(RECIPE_SELECT).eq('id', id).single();
    if (error) throw error;
    return mapRecipe(data);
  }

  private async syncTags(recipeId: string, tags: string[]) {
    await this.db.from('recipe_tags').delete().eq('recipe_id', recipeId);
    if (!tags.length) return;
    const { data } = await this.db.from('tags').upsert(tags.map((name) => ({ name })), { onConflict: 'name' }).select();
    if (data?.length) {
      await this.db.from('recipe_tags').insert(data.map((t) => ({ recipe_id: recipeId, tag_id: t.id })));
    }
  }

  async deleteRecipe(id: string): Promise<void> {
    const { error } = await this.db.from('recipes').delete().eq('id', id);
    if (error) throw error;
  }

  async listIngredients(): Promise<Ingredient[]> {
    const { data, error } = await this.db
      .from('ingredients')
      .select('*, ingredient_aliases ( alias ), ingredient_unit_conversions ( unit, grams_per_unit )')
      .order('name');
    if (error) throw error;
    return (data ?? []).map(mapIngredient);
  }

  async saveIngredient(ingredient: NewIngredient): Promise<Ingredient> {
    const id = ingredient.id ?? newId('ing');
    const { aliases, unit_conversions, ...row } = ingredient;
    const { error } = await this.db.from('ingredients').upsert({ ...row, id, updated_at: new Date().toISOString() });
    if (error) throw error;

    await this.db.from('ingredient_aliases').delete().eq('ingredient_id', id);
    if (aliases.length) {
      await this.db
        .from('ingredient_aliases')
        .insert(aliases.map((alias) => ({ ingredient_id: id, alias, normalized_alias: alias.toLowerCase().trim() })));
    }

    await this.db.from('ingredient_unit_conversions').delete().eq('ingredient_id', id);
    if (unit_conversions.length) {
      await this.db
        .from('ingredient_unit_conversions')
        .insert(unit_conversions.map((c) => ({ ingredient_id: id, unit: c.unit, grams_per_unit: c.grams_per_unit })));
    }

    return { ...(ingredient as Ingredient), id };
  }

  async deleteIngredient(id: string): Promise<void> {
    const { error } = await this.db.from('ingredients').delete().eq('id', id);
    if (error) throw error;
  }

  async reset(): Promise<void> {
    throw new Error('Reset is only available on the local store.');
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapRecipe(row: any): Recipe {
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
        amount_multiplier: s.amount_multiplier,
        notes: s.notes,
      })),
    }));

  return {
    ...row,
    ingredients,
    instructions: (row.recipe_instructions ?? []).slice().sort((a: any, b: any) => a.step_number - b.step_number),
    tags: (row.recipe_tags ?? []).map((t: any) => t.tags?.name).filter(Boolean),
  };
}

function mapIngredient(row: any): Ingredient {
  return {
    ...row,
    aliases: (row.ingredient_aliases ?? []).map((a: any) => a.alias),
    unit_conversions: (row.ingredient_unit_conversions ?? []).map((c: any) => ({
      unit: c.unit,
      grams_per_unit: c.grams_per_unit,
    })),
  };
}
