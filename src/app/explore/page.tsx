'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { useExplore } from '@/lib/store/ExploreProvider';
import { buildCandidates, evaluate, exploreIngredients, optionIds, pickNext, type Candidate } from '@/lib/explore/candidates';
import { RecipePlate } from '@/components/explore/RecipePlate';
import { IngredientCapsule, type CapsuleOption } from '@/components/explore/IngredientCapsule';
import { Mechanism, MECHANISM_MS } from '@/components/explore/Mechanism';
import { Toast } from '@/components/explore/Toast';
import { ExploreTopBar, SkipBar, Exhausted } from '@/components/explore/ExploreChrome';
import { RunTallies } from '@/components/explore/RunTallies';
import { ease } from '@/lib/motion';

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

  const onKill = useCallback(
    (ingredientId: string) => {
      if (!current) return;
      exclude(ingredientId);
      // ask the evaluator rather than re-deriving the rules here: this covers a
      // dead core ingredient and a slot whose every option is now gone
      const after = new Set(excluded);
      after.add(ingredientId);
      if (!evaluate(current.recipe, current.analysis, after, boosted)) advance(1, false);
    },
    [current, exclude, unexclude, flash, advance, excluded, boosted],
  );

  const restore = useCallback((ingredientId: string) => unexclude(ingredientId), [unexclude]);

  const onBoost = useCallback((ingredientId: string) => toggleBoost(ingredientId), [toggleBoost]);

  /**
   * One capsule per ingredient slot.
   *
   * A swappable slot reveals its options one at a time: every option already ruled
   * out, plus the first that survives. Anything further back stays hidden behind
   * the ⇄ until it is needed. Restoring an earlier option collapses the chain again.
   */
  const capsules = useMemo(() => {
    if (!current) return [];
    return exploreIngredients(current.recipe, ingredientIndex)
      .map((ri) => {
        const ids = optionIds(ri);
        const names = new Map<string, string>();
        if (ri.ingredient_id) names.set(ri.ingredient_id, ri.display_name);
        for (const sub of ri.substitutions) {
          if (sub.substitute_ingredient_id) names.set(sub.substitute_ingredient_id, sub.display_name);
        }

        const isGroup = ri.role === 'substitutable' && ids.length > 1;
        const pool = isGroup ? ids : ids.slice(0, 1);

        const revealed: CapsuleOption[] = [];
        for (const id of pool) {
          const killed = excluded.has(id);
          revealed.push({ id, name: names.get(id) ?? id, killed, inUse: !killed, boosted: boosted.has(id) });
          if (!killed) break;
        }

        const primaryDead = !!ri.ingredient_id && excluded.has(ri.ingredient_id);
        return {
          key: ri.id,
          revealed,
          hasMore: revealed.length < pool.length,
          swapped: isGroup && primaryDead,
          optional: ri.role === 'optional',
          // a plain ingredient with nothing to fall back on simply leaves the row
          drop: !isGroup && primaryDead,
        };
      })
      .filter((c) => !c.drop);
  }, [current, ingredientIndex, excluded, boosted]);

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
              paddingTop: 16,
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                flex: '0 0 auto',
              }}
            >
              <p className="t-micro t-dim" style={{ margin: 0 }}>
                Tap to rule out · hold to prioritise
              </p>
              <RunTallies
                excluded={session.excluded}
                boosted={session.boosted}
                index={ingredientIndex}
                onRestore={unexclude}
                onUnboost={toggleBoost}
              />
            </div>

            {/*
              The capsule field owns a fixed share of the screen and clips. Letting
              it size to its contents meant every recipe change shoved the action
              bar up and down the screen.
            */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 12 }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.recipe.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, transition: { duration: 0.18, ease: ease.depart } }}
                  transition={{ duration: 0.34, ease: ease.arrive }}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}
                >
                  {/* a recipe change moves the whole field as one; this inner
                      presence only handles capsules leaving within a recipe */}
                  <AnimatePresence initial={false}>
                    {capsules.map((c, i) => (
                      <IngredientCapsule
                        key={c.key}
                        revealed={c.revealed}
                        hasMore={c.hasMore}
                        index={i}
                        swapped={c.swapped}
                        optional={c.optional}
                        onTap={(o) => onKill(o.id)}
                        onHold={(o) => (o.killed ? restore(o.id) : onBoost(o.id))}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
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
