import type {
  CookLogEntry,
  Ingredient,
  NewCookLogEntry,
  NewIngredient,
  NewRecipe,
  Recipe,
} from './types';

/**
 * Storage contract.
 *
 * Every read is answered from the device mirror and every write returns before it
 * has been sent anywhere — so nothing above this line has to know or care whether
 * there is a connection. The cloud is where the data *lives*; it is never something
 * the interface waits on.
 */
export interface Repo {
  listRecipes(): Promise<Recipe[]>;
  saveRecipe(recipe: NewRecipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  listIngredients(): Promise<Ingredient[]>;
  saveIngredient(ingredient: NewIngredient): Promise<Ingredient>;
  deleteIngredient(id: string): Promise<void>;
  listCookLog(): Promise<CookLogEntry[]>;
  logCooked(entry: NewCookLogEntry): Promise<CookLogEntry>;
}

/** How the sync loop describes itself to the interface. */
export interface SyncState {
  phase: 'idle' | 'syncing' | 'offline' | 'error';
  /** writes made on this device that the cloud has not accepted yet */
  pending: number;
  /** writes parked because they will never succeed as they stand */
  failed: number;
  lastSyncedAt: string | null;
  error: string | null;
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
