import { SEED_RECIPES } from './recipes';

/**
 * The starter collection, by id.
 *
 * Seeded recipes are written to the database through the same path your own saves
 * take, so nothing in a row says where it came from — and adding a column to say so
 * would mean migrating a schema for a preference. Their ids are the tell instead:
 * `buildRecipe` derives a stable `rec_<slug-of-title>` from the seed, while anything
 * saved in the app gets `rec_<timestamp><random>` from `newId`. That is enough to
 * answer "is this one of mine?" without touching a single stored record.
 */
export const SEEDED_RECIPE_IDS: ReadonlySet<string> = new Set(SEED_RECIPES.map((r) => r.id));

export function isSeededRecipe(id: string): boolean {
  return SEEDED_RECIPE_IDS.has(id);
}
