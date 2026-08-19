'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Ingredient, NewIngredient, NewRecipe, Recipe } from '@/lib/db/types';
import { getRepo } from '@/lib/db';
import { analyzeRecipe, type RecipeAnalysis } from '@/lib/scoring';

/**
 * The whole collection lives in memory. A personal recipe box is small, and
 * Explore needs to filter and re-filter it instantly as ingredients are excluded.
 */

interface DataValue {
  ready: boolean;
  recipes: Recipe[];
  ingredients: Ingredient[];
  ingredientIndex: Map<string, Ingredient>;
  analysisFor: (recipe: Recipe) => RecipeAnalysis;
  saveRecipe: (r: NewRecipe) => Promise<Recipe>;
  deleteRecipe: (id: string) => Promise<void>;
  saveIngredient: (i: NewIngredient) => Promise<Ingredient>;
  deleteIngredient: (id: string) => Promise<void>;
  resetToSeed: () => Promise<void>;
  storageKind: 'local' | 'supabase';
}

const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ready, setReady] = useState(false);
  const repo = getRepo();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r, i] = await Promise.all([repo.listRecipes(), repo.listIngredients()]);
      if (!alive) return;
      setRecipes(r);
      setIngredients(i);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const ingredientIndex = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

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

  const resetToSeed = useCallback(async () => {
    await repo.reset();
    const [r, i] = await Promise.all([repo.listRecipes(), repo.listIngredients()]);
    setRecipes(r);
    setIngredients(i);
  }, [repo]);

  const value = useMemo<DataValue>(
    () => ({
      ready,
      recipes,
      ingredients,
      ingredientIndex,
      analysisFor,
      saveRecipe,
      deleteRecipe,
      saveIngredient,
      deleteIngredient,
      resetToSeed,
      storageKind: repo.kind,
    }),
    [
      ready,
      recipes,
      ingredients,
      ingredientIndex,
      analysisFor,
      saveRecipe,
      deleteRecipe,
      saveIngredient,
      deleteIngredient,
      resetToSeed,
      repo.kind,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
