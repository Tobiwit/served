/**
 * One-time cloud seed.
 *
 * The collection lives in the database now, so a fresh project starts empty. This
 * pushes the starter ingredients and recipes up once.
 *
 * It writes through `SupabaseRemote` — the same code path the app's own saves take —
 * rather than hand-rolling inserts, so seeded rows are indistinguishable from rows
 * you added yourself. Re-running it is safe: every write is an upsert keyed on the
 * seed's own stable ids.
 *
 *   npm run seed:cloud
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY in .env.local. That key bypasses RLS and must
 * never be prefixed NEXT_PUBLIC_ — it stays on your machine.
 */

import { createClient } from '@supabase/supabase-js';
import { SupabaseRemote } from '../src/lib/db/supabase';
import { SEED_INGREDIENTS, SEED_RECIPES } from '../src/seed';

/**
 * Wrapped in a function rather than run at the top level, because the package is
 * not `"type": "module"` — so this compiles to CommonJS, where top-level await is
 * a syntax error. An async main works under either format.
 */
async function main(): Promise<void> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    /* already in the environment, or there is no file — the checks below will say */
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    process.exitCode = 1;
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const remote = new SupabaseRemote(db);

  // Ingredients first: every recipe line points at one by id.
  console.log(`ingredients: ${SEED_INGREDIENTS.length}`);
  for (const [i, ingredient] of SEED_INGREDIENTS.entries()) {
    await remote.saveIngredient(ingredient);
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${SEED_INGREDIENTS.length}`);
  }

  console.log(`recipes: ${SEED_RECIPES.length}`);
  for (const recipe of SEED_RECIPES) {
    await remote.saveRecipe(recipe);
    console.log(`  ${recipe.title}`);
  }

  console.log('done');
}

main().catch((error: unknown) => {
  // The usual causes are a migration that has not been run and a mistyped key, and
  // both are far easier to act on than a raw stack trace.
  console.error('\nSeeding failed.');
  console.error(error instanceof Error ? error.message : error);
  console.error('\nCheck that all four migrations ran and that SUPABASE_SERVICE_ROLE_KEY is the service_role (secret) key.');
  process.exitCode = 1;
});
