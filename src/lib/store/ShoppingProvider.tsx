'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Ingredient, Recipe } from '@/lib/db/types';
import { itemsForRecipe, loadList, saveList, type ShoppingItem } from '@/lib/shopping/list';

interface ShoppingValue {
  items: ShoppingItem[];
  hydrated: boolean;
  /** how many are still to be found — what the list is *for* */
  outstanding: number;
  hasRecipe: (recipeId: string) => boolean;
  /** replaces whatever that recipe already contributed, so servings can be changed */
  addRecipe: (recipe: Recipe, index: Map<string, Ingredient>, scale?: number) => void;
  removeRecipe: (recipeId: string) => void;
  setChecked: (ids: string[], checked: boolean) => void;
  clearChecked: () => void;
  clearAll: () => void;
}

const Ctx = createContext<ShoppingValue | null>(null);

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const first = useRef(true);

  // read from storage after mount so server and client markup agree
  useEffect(() => {
    setItems(loadList());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveList(items);
  }, [items]);

  const hasRecipe = useCallback((recipeId: string) => items.some((i) => i.recipeId === recipeId), [items]);

  /**
   * Adding a recipe that is already on the list replaces its lines rather than
   * doubling them — the second tap is almost always "I changed the servings", and
   * two sets of the same ingredients is never what was meant.
   */
  const addRecipe = useCallback((recipe: Recipe, index: Map<string, Ingredient>, scale = 1) => {
    setItems((prev) => [...prev.filter((i) => i.recipeId !== recipe.id), ...itemsForRecipe(recipe, index, scale)]);
  }, []);

  const removeRecipe = useCallback((recipeId: string) => {
    setItems((prev) => prev.filter((i) => i.recipeId !== recipeId));
  }, []);

  const setChecked = useCallback((ids: string[], checked: boolean) => {
    const set = new Set(ids);
    setItems((prev) => prev.map((i) => (set.has(i.id) ? { ...i, checked } : i)));
  }, []);

  const clearChecked = useCallback(() => setItems((prev) => prev.filter((i) => !i.checked)), []);

  const clearAll = useCallback(() => setItems([]), []);

  const outstanding = useMemo(() => items.filter((i) => !i.checked).length, [items]);

  const value = useMemo<ShoppingValue>(
    () => ({ items, hydrated, outstanding, hasRecipe, addRecipe, removeRecipe, setChecked, clearChecked, clearAll }),
    [items, hydrated, outstanding, hasRecipe, addRecipe, removeRecipe, setChecked, clearChecked, clearAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShopping(): ShoppingValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShopping must be used inside ShoppingProvider');
  return v;
}
