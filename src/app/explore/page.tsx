'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { useExplore } from '@/lib/store/ExploreProvider';
import { buildCandidates, evaluate, exploreIngredients, pickNext, type Candidate } from '@/lib/explore/candidates';
import { RecipePlate } from '@/components/explore/RecipePlate';
import { IngredientCapsule } from '@/components/explore/IngredientCapsule';
import { Mechanism, MECHANISM_MS } from '@/components/explore/Mechanism';
import { Toast } from '@/components/explore/Toast';
import { ExploreTopBar, SkipBar, Exhausted } from '@/components/explore/ExploreChrome';

/** Content swaps a third of the way into the sweep, behind the frosted plate. */
const SWAP_AT = MECHANISM_MS * 0.34;

export default function ExplorePage() {
  const router = useRouter();
  const { recipes, ingredientIndex, analysisFor, ready } = useData();
  const { session, hydrated, exclude, unexclude, toggleBoost, markSeen, setCurrent, resetKeepFilters } = useExplore();

  const [direction, setDirection] = useState<1 | -1>(1);
  const [sweep, setSweep] = useState(0);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const excluded = useMemo(() => new Set(session.excluded), [session.excluded]);
  const boosted = useMemo(() => new Set(session.boosted), [session.boosted]);
  const seen = useMemo(() => new Set(session.seen), [session.seen]);

  /** Everything still available to move to. Does not include what is on screen. */
  const candidates = useMemo(
    () => buildCandidates(recipes, analysisFor, session.filters, excluded, boosted, seen),
    [recipes, analysisFor, session.filters, excluded, boosted, seen],
  );

  /**
   * The recipe on screen is resolved from the collection, not from the candidate
   * list. Excluding an ingredient must not yank the plate out from under you —
   * only the mechanism changes what is displayed.
   */
  const current: Candidate | null = useMemo(() => {
    if (!session.current) return null;
    const recipe = recipes.find((r) => r.id === session.current);
    if (!recipe) return null;
    const c = evaluate(recipe, analysisFor(recipe), excluded, boosted);
    return c ?? { recipe, analysis: analysisFor(recipe), swaps: [], boostHits: 0 };
  }, [session.current, recipes, analysisFor, excluded, boosted]);

  const candidatesRef = useRef(candidates);
  const currentIdRef = useRef<string | null>(null);
  useEffect(() => {
    candidatesRef.current = candidates;
    currentIdRef.current = session.current;
  }, [candidates, session.current]);

  // load the first recipe, and recover if the held one disappears from the library
  useEffect(() => {
    if (!hydrated || !ready || current) return;
    const first = pickNext(candidates);
    if (first) setCurrent(first.recipe.id);
  }, [hydrated, ready, current, candidates, setCurrent]);

  const flash = useCallback((message: string, undo?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /**
   * Run the mechanism, then swap the plate behind it. Both the "seen" mark and the
   * hand-off happen in the same tick so the stage never advances twice.
   */
  const advance = useCallback(
    (dir: 1 | -1, markCurrentSeen: boolean) => {
      const leaving = currentIdRef.current;
      setDirection(dir);
      setSweep((t) => t + 1);
      window.setTimeout(() => {
        if (markCurrentSeen && leaving) markSeen(leaving);
        const pool = candidatesRef.current.filter((c) => c.recipe.id !== leaving);
        setCurrent(pickNext(pool)?.recipe.id ?? null);
      }, SWAP_AT);
    },
    [markSeen, setCurrent],
  );

  const onSkip = useCallback(() => {
    if (current) advance(1, true);
  }, [current, advance]);

  const onExclude = useCallback(
    (ingredientId: string, name: string) => {
      if (!current) return;
      // core takes the recipe with it; optional and substitutable leave it standing
      const isCore = current.recipe.ingredients.some(
        (ri) => ri.ingredient_id === ingredientId && ri.role === 'core',
      );
      exclude(ingredientId);
      flash(`${name} excluded`, () => {
        unexclude(ingredientId);
        setToast(null);
      });
      if (isCore) advance(1, false);
    },
    [current, exclude, unexclude, flash, advance],
  );

  const onBoost = useCallback(
    (ingredientId: string, name: string) => {
      const was = boosted.has(ingredientId);
      toggleBoost(ingredientId);
      flash(was ? `${name} no longer prioritised` : `More recipes with ${name}`);
    },
    [boosted, toggleBoost, flash],
  );

  // an excluded ingredient leaves the capsule row immediately, even if the recipe stays
  const capsules = useMemo(() => {
    if (!current) return [];
    return exploreIngredients(current.recipe, ingredientIndex).filter(
      (ri) => !(ri.ingredient_id && excluded.has(ri.ingredient_id)),
    );
  }, [current, ingredientIndex, excluded]);

  const resetRun = useCallback(() => {
    resetKeepFilters();
    flash('Explore run reset');
  }, [resetKeepFilters, flash]);

  if (!hydrated || !ready) return <main style={{ minHeight: '100dvh' }} />;

  const remaining = candidates.filter((c) => c.recipe.id !== session.current).length;

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: 'calc(var(--safe-t) + 12px) var(--shell-pad) calc(var(--safe-b) + 14px)',
        overflow: 'hidden',
      }}
    >
      <ExploreTopBar onClose={() => router.push('/')} onReset={resetRun} remaining={remaining} />

      {current ? (
        <>
          <div
            style={{
              position: 'relative',
              flex: '0 0 auto',
              height: '54dvh',
              minHeight: 300,
              marginTop: 10,
              perspective: 1500,
              transformStyle: 'preserve-3d',
            }}
          >
            <AnimatePresence initial={false}>
              <RecipePlate
                key={current.recipe.id}
                recipe={current.recipe}
                analysis={current.analysis}
                direction={direction}
                onOpen={() => router.push(`/recipe/${current.recipe.id}`)}
              />
            </AnimatePresence>
            <Mechanism token={sweep} direction={direction} onDone={() => setSweep(0)} />
          </div>

          <section
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              paddingTop: 18,
              minHeight: 0,
            }}
          >
            <div>
              <div
                style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}
              >
                <p className="t-micro t-dim" style={{ margin: 0 }}>
                  Tap to remove · hold to prioritise
                </p>
                {current.swaps.length > 0 && (
                  <p className="t-micro t-dim-2" style={{ margin: 0 }}>
                    {current.swaps.length} swap{current.swaps.length === 1 ? '' : 's'}
                  </p>
                )}
              </div>

              <motion.div layout style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <AnimatePresence mode="popLayout">
                  {capsules.map((ri, i) => (
                    <IngredientCapsule
                      key={`${current.recipe.id}-${ri.id}`}
                      ri={ri}
                      index={i}
                      boosted={!!ri.ingredient_id && boosted.has(ri.ingredient_id)}
                      swapped={ri.role === 'substitutable' && current.swaps.includes(ri.display_name)}
                      onExclude={() => ri.ingredient_id && onExclude(ri.ingredient_id, ri.display_name)}
                      onBoost={() => ri.ingredient_id && onBoost(ri.ingredient_id, ri.display_name)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>

            <SkipBar onSkip={onSkip} onCook={() => router.push(`/recipe/${current.recipe.id}`)} />
          </section>
        </>
      ) : (
        <Exhausted hasExclusions={session.excluded.length > 0} onReset={resetRun} onEdit={() => router.push('/')} />
      )}

      <Toast message={toast?.message ?? null} actionLabel={toast?.undo ? 'Undo' : undefined} onAction={toast?.undo} />
    </main>
  );
}
