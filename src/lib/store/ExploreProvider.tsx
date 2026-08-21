'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { FilterState } from '@/lib/explore/filters';
import { clearSession, emptySession, loadSession, saveSession, type ExploreSession } from '@/lib/explore/session';

interface ExploreValue {
  session: ExploreSession;
  hydrated: boolean;
  setFilters: (update: (f: FilterState) => FilterState) => void;
  start: () => void;
  exclude: (ingredientId: string) => void;
  unexclude: (ingredientId: string) => void;
  toggleBoost: (ingredientId: string) => void;
  markSeen: (recipeId: string) => void;
  setCurrent: (recipeId: string | null) => void;
  reset: () => void;
  resetKeepFilters: () => void;
}

const Ctx = createContext<ExploreValue | null>(null);

export function ExploreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ExploreSession>(emptySession);
  const [hydrated, setHydrated] = useState(false);
  const first = useRef(true);

  // read from storage after mount so server and client markup agree
  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveSession(session);
  }, [session]);

  const setFilters = useCallback((update: (f: FilterState) => FilterState) => {
    setSession((s) => ({ ...s, filters: update(s.filters) }));
  }, []);

  const start = useCallback(() => setSession((s) => ({ ...s, started: true })), []);

  // ruling something out and wanting more of it are mutually exclusive; boosting
  // already clears the exclusion, so excluding has to clear the boost
  const exclude = useCallback((id: string) => {
    setSession((s) =>
      s.excluded.includes(id)
        ? s
        : { ...s, excluded: [...s.excluded, id], boosted: s.boosted.filter((x) => x !== id) },
    );
  }, []);

  const unexclude = useCallback((id: string) => {
    setSession((s) => ({ ...s, excluded: s.excluded.filter((x) => x !== id) }));
  }, []);

  const toggleBoost = useCallback((id: string) => {
    setSession((s) => ({
      ...s,
      boosted: s.boosted.includes(id) ? s.boosted.filter((x) => x !== id) : [...s.boosted, id],
      excluded: s.excluded.filter((x) => x !== id),
    }));
  }, []);

  const markSeen = useCallback((recipeId: string) => {
    setSession((s) => (s.seen.includes(recipeId) ? s : { ...s, seen: [...s.seen, recipeId] }));
  }, []);

  const setCurrent = useCallback((recipeId: string | null) => {
    setSession((s) => (s.current === recipeId ? s : { ...s, current: recipeId }));
  }, []);

  const reset = useCallback(() => {
    clearSession();
    setSession(emptySession());
  }, []);

  /** Start over on the recipes but keep what I asked for. */
  const resetKeepFilters = useCallback(() => {
    setSession((s) => ({ ...emptySession(), filters: s.filters }));
  }, []);

  const value = useMemo<ExploreValue>(
    () => ({
      session,
      hydrated,
      setFilters,
      start,
      exclude,
      unexclude,
      toggleBoost,
      markSeen,
      setCurrent,
      reset,
      resetKeepFilters,
    }),
    [session, hydrated, setFilters, start, exclude, unexclude, toggleBoost, markSeen, setCurrent, reset, resetKeepFilters],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExplore(): ExploreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useExplore must be used inside ExploreProvider');
  return v;
}
