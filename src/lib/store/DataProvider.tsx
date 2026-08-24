'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CookLogEntry,
  Ingredient,
  NewCookLogEntry,
  NewIngredient,
  NewRecipe,
  Recipe,
} from '@/lib/db/types';
import type { SyncState } from '@/lib/db/adapter';
import { getRepo } from '@/lib/db';
import { analyzeRecipe, type RecipeAnalysis } from '@/lib/scoring';

/**
 * The whole collection lives in memory. A personal recipe box is small, and
 * Explore needs to filter and re-filter it instantly as ingredients are excluded.
 *
 * It is loaded from the device mirror, not from the network: `ready` flips as soon as
 * IndexedDB has answered, so the app is usable before — and without — a connection,
 * and the sync that follows is a background correction rather than a gate. The one
 * exception is a first launch, where the mirror is empty and there is nothing to be
 * ready with.
 */

/** While anything is unsent, keep trying without waiting for a system event. */
const RETRY_MS = 30_000;

interface DataValue {
  ready: boolean;
  recipes: Recipe[];
  ingredients: Ingredient[];
  cookLog: CookLogEntry[];
  ingredientIndex: Map<string, Ingredient>;
  /** most recent first, so `lastCooked.get(id)` is when a recipe was last made */
  lastCooked: Map<string, string>;
  analysisFor: (recipe: Recipe) => RecipeAnalysis;
  saveRecipe: (r: NewRecipe) => Promise<Recipe>;
  deleteRecipe: (id: string) => Promise<void>;
  saveIngredient: (i: NewIngredient) => Promise<Ingredient>;
  deleteIngredient: (id: string) => Promise<void>;
  logCooked: (entry: NewCookLogEntry) => Promise<CookLogEntry>;
  sync: SyncState;
  syncNow: () => Promise<void>;
  refreshFromCloud: () => Promise<void>;
}

const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cookLog, setCookLog] = useState<CookLogEntry[]>([]);
  const [ready, setReady] = useState(false);
  const repo = getRepo();

  const [sync, setSync] = useState<SyncState>(() => repo.syncState());
  const alive = useRef(true);

  /** Re-read the mirror. Called after a sync, which is the only thing that changes
   *  records behind the interface's back. Reports whether it found anything. */
  const reload = useCallback(async () => {
    const [r, i, c] = await Promise.all([repo.listRecipes(), repo.listIngredients(), repo.listCookLog()]);
    if (!alive.current) return false;
    setRecipes(r);
    setIngredients(i);
    setCookLog(c);
    return r.length > 0 || i.length > 0;
  }, [repo]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => repo.subscribe(() => setSync(repo.syncState())), [repo]);

  // hydrate, then sync — never the other way round
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hydrated = await reload();
      if (cancelled) return;

      // On every launch but the first, the mirror already holds the collection and
      // the app is usable now — with or without a connection. Only a genuinely empty
      // mirror waits for the pull, because flipping `ready` on nothing would flash an
      // empty library at someone who has 18 recipes.
      if (hydrated) setReady(true);

      await repo.sync();
      if (cancelled) return;
      await reload();
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, reload]);

  const syncNow = useCallback(async () => {
    await repo.sync();
    await reload();
  }, [repo, reload]);

  // Coming back to the app is the moment a phone is most likely to have picked up
  // signal again, and the moment the collection is most likely to be stale.
  useEffect(() => {
    if (!ready) return;

    const run = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, syncNow]);

  useEffect(() => {
    if (!ready || sync.pending === 0) return;
    const timer = window.setInterval(() => void syncNow(), RETRY_MS);
    return () => window.clearInterval(timer);
  }, [ready, sync.pending, syncNow]);

  const ingredientIndex = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const lastCooked = useMemo(() => {
    const map = new Map<string, string>();
    // cookLog arrives newest first, so the first sighting of a recipe is its latest
    for (const entry of cookLog) if (!map.has(entry.recipe_id)) map.set(entry.recipe_id, entry.cooked_at);
    return map;
  }, [cookLog]);

  // analyses are pure functions of (recipe, ingredients) — cache by identity so
  // scrolling the library doesn't recompute 18 scores on every render
  const cache = useMemo(() => new WeakMap<Recipe, RecipeAnalysis>(), [ingredientIndex]);
  const analysisFor = useCallback(
    (recipe: Recipe) => {
      const hit = cache.get(recipe);
      if (hit) return hit;
      const next = analyzeRecipe(recipe, ingredientIndex);
      cache.set(recipe, next);
      return next;
    },
    [cache, ingredientIndex],
  );

  const saveRecipe = useCallback(
    async (r: NewRecipe) => {
      const saved = await repo.saveRecipe(r);
      setRecipes((prev) => {
        const i = prev.findIndex((x) => x.id === saved.id);
        return i >= 0 ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
      });
      return saved;
    },
    [repo],
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      await repo.deleteRecipe(id);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    },
    [repo],
  );

  const saveIngredient = useCallback(
    async (i: NewIngredient) => {
      const saved = await repo.saveIngredient(i);
      setIngredients((prev) => {
        const idx = prev.findIndex((x) => x.id === saved.id);
        return idx >= 0 ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
      });
      return saved;
    },
    [repo],
  );

  const deleteIngredient = useCallback(
    async (id: string) => {
      await repo.deleteIngredient(id);
      setIngredients((prev) => prev.filter((i) => i.id !== id));
    },
    [repo],
  );

  const logCooked = useCallback(
    async (entry: NewCookLogEntry) => {
      const saved = await repo.logCooked(entry);
      setCookLog((prev) => [saved, ...prev.filter((e) => e.id !== saved.id)]);
      return saved;
    },
    [repo],
  );

  const refreshFromCloud = useCallback(async () => {
    await repo.refreshFromCloud();
    await reload();
  }, [repo, reload]);

  const value = useMemo<DataValue>(
    () => ({
      ready,
      recipes,
      ingredients,
      cookLog,
      ingredientIndex,
      lastCooked,
      analysisFor,
      saveRecipe,
      deleteRecipe,
      saveIngredient,
      deleteIngredient,
      logCooked,
      sync,
      syncNow,
      refreshFromCloud,
    }),
    [
      ready,
      recipes,
      ingredients,
      cookLog,
      ingredientIndex,
      lastCooked,
      analysisFor,
      saveRecipe,
      deleteRecipe,
      saveIngredient,
      deleteIngredient,
      logCooked,
      sync,
      syncNow,
      refreshFromCloud,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
