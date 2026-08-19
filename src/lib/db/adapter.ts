import type { Ingredient, NewIngredient, NewRecipe, Recipe } from './types';

/**
 * Storage contract. Two implementations: a seeded local store that lets the app
 * run with no configuration, and Supabase when credentials are present. Nothing
 * above this line knows which one it is talking to.
 */
export interface Repo {
  readonly kind: 'local' | 'supabase';
  listRecipes(): Promise<Recipe[]>;
  saveRecipe(recipe: NewRecipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  listIngredients(): Promise<Ingredient[]>;
  saveIngredient(ingredient: NewIngredient): Promise<Ingredient>;
  deleteIngredient(id: string): Promise<void>;
  reset(): Promise<void>;
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
