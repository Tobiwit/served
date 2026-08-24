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

try {
  process.loadEnvFile('.env.local');
} catch {
  /* already in the environment, or there is no file — the checks below will say */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
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
