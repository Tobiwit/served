import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BacklogEntry, CookLogEntry, Ingredient, Recipe } from './types';
import { newId } from './adapter';

/**
 * The remote half.
 *
 * This is no longer a `Repo` — nothing in the app talks to it directly any more.
 * `CloudRepo` owns it: the outbox calls the writers when there is a connection, and
 * the sync loop calls the pullers. All of the child-table bookkeeping a recipe needs
 * (ingredients, substitutions, instructions, tags) lives here and nowhere else.
 *
 * Schema: supabase/migrations.
 */

let client: SupabaseClient | null = null;

export function supabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        // The point of the account is that you meet it once. The refresh token
        // rotates in the background for as long as the app keeps being opened.
        persistSession: true,
        autoRefreshToken: true,
        // nothing here ever arrives via a link, and leaving this on makes the
        // client paw at every URL it is loaded under
        detectSessionInUrl: false,
        storageKey: 'served.auth',
      },
    });
  }
  return client;
}

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const RECIPE_SELECT = `
  *,
  recipe_ingredients ( *, ingredient_substitutions ( * ) ),
  recipe_instructions ( * ),
  recipe_tags ( tags ( name ) )
`;

const INGREDIENT_SELECT = '*, ingredient_aliases ( alias ), ingredient_unit_conversions ( unit, grams_per_unit )';

/** PostgREST caps a response whether or not you asked it to, so pulls page. */
const PAGE = 500;

/* eslint-disable @typescript-eslint/no-explicit-any */

export class SupabaseRemote {
  constructor(private db: SupabaseClient) {}

  /* ------------------------------------------------------------------- pulls */

  /**
   * Everything touched since `since`, tombstones included — a row that has been
   * deleted is exactly what the mirror most needs to hear about.
   */
  pullRecipes(since: string): Promise<any[]> {
    return this.page('recipes', RECIPE_SELECT, since);
  }

  pullIngredients(since: string): Promise<any[]> {
    return this.page('ingredients', INGREDIENT_SELECT, since);
  }

  pullCookLog(since: string): Promise<any[]> {
    return this.page('cook_log', '*', since);
  }

  pullBacklog(since: string): Promise<any[]> {
    return this.page('backlog', '*', since);
  }

  private async page(table: string, select: string, since: string): Promise<any[]> {
    const out: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db
        .from(table)
        .select(select)
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  /* ------------------------------------------------------------------ writes */

  /**
   * Whole-recipe upsert: the children are replaced rather than diffed, which is what
   * makes a queued save idempotent — replaying it lands the same rows, not twice over.
   *
   * `created_at` and `updated_at` are stripped deliberately. Timestamps are the sync
   * cursor and they belong to the server's clock; a phone running three minutes fast
   * would write rows the next pull never asks for.
   */
  async saveRecipe(recipe: Recipe): Promise<void> {
    const { ingredients, instructions, tags, created_at, updated_at, ...row } = recipe as Recipe &
      Record<string, unknown>;
    const id = recipe.id;
    void created_at;
    void updated_at;

    const { error: rErr } = await this.db.from('recipes').upsert({ ...row, id, deleted_at: null });
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
          amount: s.amount,
          unit: s.unit,
          grams: s.grams,
          amount_multiplier: s.amount_multiplier,
          notes: s.notes,
        })),
      );
      if (subs.length) {
        const { error: sErr } = await this.db.from('ingredient_substitutions').insert(subs);
        if (sErr) throw sErr;
      }
    }

    if (instructions.length) {
      const { error } = await this.db
        .from('recipe_instructions')
        .insert(
          instructions.map((s, i) => ({ id: s.id || newId('st'), recipe_id: id, step_number: i + 1, text: s.text })),
        );
      if (error) throw error;
    }

    await this.syncTags(id, tags);
  }

  private async syncTags(recipeId: string, tags: string[]) {
    await this.db.from('recipe_tags').delete().eq('recipe_id', recipeId);
    if (!tags.length) return;
    const { data } = await this.db
      .from('tags')
      .upsert(
        tags.map((name) => ({ name })),
        { onConflict: 'name' },
      )
      .select();
    if (data?.length) {
      await this.db.from('recipe_tags').insert(data.map((t) => ({ recipe_id: recipeId, tag_id: t.id })));
    }
  }

  /** Soft delete. A row that simply vanished is invisible to a delta pull. */
  async deleteRecipe(id: string): Promise<void> {
    const { error } = await this.db.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async saveIngredient(ingredient: Ingredient): Promise<void> {
    const { aliases, unit_conversions, created_at, updated_at, ...row } = ingredient as Ingredient &
      Record<string, unknown>;
    const id = ingredient.id;
    void created_at;
    void updated_at;

    const { error } = await this.db.from('ingredients').upsert({ ...row, id, deleted_at: null });
    if (error) throw error;

    await this.db.from('ingredient_aliases').delete().eq('ingredient_id', id);
    if (aliases.length) {
      const { error: aErr } = await this.db
        .from('ingredient_aliases')
        .insert(aliases.map((alias) => ({ ingredient_id: id, alias, normalized_alias: alias.toLowerCase().trim() })));
      if (aErr) throw aErr;
    }

    await this.db.from('ingredient_unit_conversions').delete().eq('ingredient_id', id);
    if (unit_conversions.length) {
      const { error: cErr } = await this.db
        .from('ingredient_unit_conversions')
        .insert(unit_conversions.map((c) => ({ ingredient_id: id, unit: c.unit, grams_per_unit: c.grams_per_unit })));
      if (cErr) throw cErr;
    }
  }

  async deleteIngredient(id: string): Promise<void> {
    const { error } = await this.db.from('ingredients').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  /**
   * Write a real URL over the `idb:` placeholder a queued photo left behind. Guarded
   * on the sentinel so a newer photo, saved from another device while this upload
   * waited for signal, is not quietly undone by it.
   */
  async setRecipeImage(id: string, url: string, sentinel: string): Promise<void> {
    const { error } = await this.db
      .from('recipes')
      .update({ image_url: url })
      .eq('id', id)
      .eq('image_url', sentinel);
    if (error) throw error;
  }

  async saveCookEntry(entry: CookLogEntry): Promise<void> {
    const { created_at, updated_at, ...row } = entry as CookLogEntry & Record<string, unknown>;
    void created_at;
    void updated_at;
    const { error } = await this.db.from('cook_log').upsert({ ...row, deleted_at: null });
    if (error) throw error;
  }

  async saveBacklogEntry(entry: BacklogEntry): Promise<void> {
    const { created_at, updated_at, ...row } = entry as BacklogEntry & Record<string, unknown>;
    void created_at;
    void updated_at;
    const { error } = await this.db.from('backlog').upsert({ ...row, deleted_at: null });
    if (error) throw error;
  }

  async deleteBacklogEntry(id: string): Promise<void> {
    const { error } = await this.db.from('backlog').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  /* ------------------------------------------------------------------ storage */

  async uploadImage(bucket: string, path: string, blob: Blob): Promise<string> {
    const { error } = await this.db.storage.from(bucket).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) throw error;
    return this.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async removeImage(bucket: string, path: string): Promise<void> {
    await this.db.storage.from(bucket).remove([path]);
  }
}
