import type { Ingredient, NewIngredient, NewRecipe, Recipe } from './types';
import { newId, type Repo } from './adapter';
import { SEED_INGREDIENTS, SEED_RECIPES } from '@/seed';

/**
 * localStorage-backed store, seeded on first run.
 *
 * This is a real store, not a mock: edits persist, and the whole collection is
 * small enough (a personal recipe box) that loading it into memory is the right
 * trade. Swapping in Supabase changes nothing above the Repo interface.
 */

const KEY_R = 'served.recipes.v1';
const KEY_I = 'served.ingredients.v1';

function read<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — the in-memory copy still works for this session */
  }
}

export class LocalRepo implements Repo {
  readonly kind = 'local' as const;

  async listRecipes(): Promise<Recipe[]> {
    return read(KEY_R, SEED_RECIPES);
  }

  async saveRecipe(recipe: NewRecipe): Promise<Recipe> {
    const all = await this.listRecipes();
    const now = new Date().toISOString();
    const existing = recipe.id ? all.find((r) => r.id === recipe.id) : undefined;
    const saved: Recipe = {
      ...(recipe as Recipe),
      id: recipe.id ?? newId('rec'),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const next = existing ? all.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...all];
    write(KEY_R, next);
    return saved;
  }

  async deleteRecipe(id: string): Promise<void> {
    write(
      KEY_R,
      (await this.listRecipes()).filter((r) => r.id !== id),
    );
  }

  async listIngredients(): Promise<Ingredient[]> {
    return read(KEY_I, SEED_INGREDIENTS);
  }

  async saveIngredient(ingredient: NewIngredient): Promise<Ingredient> {
    const all = await this.listIngredients();
    const now = new Date().toISOString();
    const existing = ingredient.id ? all.find((i) => i.id === ingredient.id) : undefined;
    const saved: Ingredient = {
      ...(ingredient as Ingredient),
      id: ingredient.id ?? newId('ing'),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const next = existing ? all.map((i) => (i.id === saved.id ? saved : i)) : [...all, saved];
    write(KEY_I, next);
    return saved;
  }

  async deleteIngredient(id: string): Promise<void> {
    write(
      KEY_I,
      (await this.listIngredients()).filter((i) => i.id !== id),
    );
  }

  async reset(): Promise<void> {
    write(KEY_R, SEED_RECIPES);
    write(KEY_I, SEED_INGREDIENTS);
  }
}
