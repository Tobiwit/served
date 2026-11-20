'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { useExplore } from '@/lib/store/ExploreProvider';
import { useShopping } from '@/lib/store/ShoppingProvider';
import { recipeForRun, runState } from '@/lib/explore/liveRecipe';
import { fitFor } from '@/lib/explore/fit';
import { COURSE_LABEL } from '@/lib/db/types';
import { RecipeImage } from '@/components/explore/RecipeImage';
import { NutritionCard } from '@/components/recipe/NutritionCard';
import { ScorePanel } from '@/components/recipe/ScorePanel';
import { ServingStepper } from '@/components/recipe/ServingStepper';
import { IngredientLines } from '@/components/recipe/IngredientLines';
import { CopyPromptButton } from '@/components/recipe/CopyPromptButton';
import { PhotoControl } from '@/components/recipe/PhotoControl';
import { ease, spring } from '@/lib/motion';

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  // by id, so a recipe still opens from a link while the starter collection is hidden
  const { allRecipes, ingredientIndex, analysisFor, saveRecipe, ready } = useData();
  const { session } = useExplore();
  const { hasRecipe, addRecipe } = useShopping();

  const [servings, setServings] = useState<number | null>(null);
  const [showTotal, setShowTotal] = useState(false);
  const [asWritten, setAsWritten] = useState(false);

  const stored = useMemo(() => allRecipes.find((r) => r.id === id) ?? null, [allRecipes, id]);

  /**
   * What is actually being made. Ingredients ruled out during the run are gone from
   * it and swapped slots are filled by whichever option is standing in, so the
   * macros, the scores and the ingredient list all describe the same plate.
   *
   * None of it is written down — the stored recipe is untouched, and `As written`
   * puts the original back on screen at any point.
   */
  const run = useMemo(() => runState(session.excluded, session.boosted), [session.excluded, session.boosted]);
  /**
   * Opened from the Explore plate, the recipe is the one that plate described —
   * including any swap or left-out optional that made it fit the filters. Opened
   * from anywhere else, the filters are not what you came for, so no plan.
   */
  const fromExplore = session.current === id;
  const adjusted = useMemo(() => {
    if (!stored) return null;
    const plan = fromExplore ? fitFor(stored, run, session.filters, ingredientIndex)?.plan : undefined;
    return recipeForRun(stored, run, ingredientIndex, plan);
  }, [stored, run, ingredientIndex, fromExplore, session.filters]);
  const isAdjusted = !!stored && adjusted !== stored;
  const recipe = asWritten ? stored : adjusted;

  const analysis = useMemo(() => (recipe ? analysisFor(recipe) : null), [recipe, analysisFor]);

  if (!ready) return <main className="screen" style={{ paddingTop: 120 }} />;

  if (!recipe || !analysis) {
    return (
      <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 80px)' }}>
        <h1 className="t-title">Not in the collection</h1>
        <button type="button" onClick={() => router.push('/library')} className="t-micro t-dim" style={{ marginTop: 12 }}>
          Back to recipes
        </button>
      </main>
    );
  }

  const shown = servings ?? recipe.servings;
  const scale = shown / Math.max(1, recipe.servings);

  return (
    <main style={{ position: 'relative', paddingBottom: 'calc(var(--tabbar-h) + var(--safe-b) + 30px)' }}>
      <div style={{ position: 'relative', height: '42dvh', minHeight: 260 }}>
        {/* The image is masked out rather than covered with a matching fog gradient.
            A painted fade has to land on the container edge exactly, and 42dvh is
            fractional — masking dissolves the plate into whatever is behind it. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            maskImage: 'linear-gradient(180deg, #000 0%, #000 52%, rgba(0,0,0,0.55) 78%, transparent 97%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 52%, rgba(0,0,0,0.55) 78%, transparent 97%)',
          }}
        >
          <RecipeImage recipe={recipe} radius="0px" showAperture />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            // above the grain layer, or the texture draws its own edge
            zIndex: 4,
            pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(14,15,17,0.26) 0%, rgba(14,15,17,0) 34%)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--safe-t) + 12px)',
            left: 'var(--shell-pad)',
            right: 'var(--shell-pad)',
            zIndex: 5,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <FloatControl label="Back" onClick={() => router.back()}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
              <path d="M9.5 2.5 4.5 7.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </FloatControl>

          <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
            <FloatControl label="Edit recipe" onClick={() => router.push(`/recipe/${recipe.id}/edit`)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                <path
                  d="M10.1 2.4a1.5 1.5 0 0 1 2.1 2.1l-6.6 6.6-2.8.7.7-2.8z"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                />
                <path d="M9.1 3.4l2.1 2.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </FloatControl>
            <PhotoControl
              recipe={recipe}
              onSave={async (image_url) => void (await saveRecipe({ ...recipe, image_url }))}
            />
            <FloatControl
              label={recipe.favorite ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => void saveRecipe({ ...recipe, favorite: !recipe.favorite })}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                <path
                  d="M7.5 12.4 3.3 8.3a2.7 2.7 0 0 1 3.8-3.8l.4.4.4-.4a2.7 2.7 0 1 1 3.8 3.8z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  fill={recipe.favorite ? 'currentColor' : 'none'}
                />
              </svg>
            </FloatControl>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 var(--shell-pad)', marginTop: -34, position: 'relative', zIndex: 6 }}>
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: ease.arrive }}
        >
          <h1 className="t-display" style={{ margin: 0 }}>
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="t-body t-dim" style={{ margin: '10px 0 0' }}>
              {recipe.description}
            </p>
          )}
          <p className="t-micro t-dim-2" style={{ margin: '12px 0 0' }}>
            {[
              recipe.cuisine,
              recipe.course_type ? COURSE_LABEL[recipe.course_type] : null,
              recipe.total_minutes ? `${recipe.total_minutes} min` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {isAdjusted && <RunBadge asWritten={asWritten} onToggle={() => setAsWritten((v) => !v)} />}
        </motion.header>

        <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
          <NutritionCard
            nutrition={analysis.nutrition}
            servings={shown}
            showTotal={showTotal}
            onToggleTotal={() => setShowTotal((v) => !v)}
            gramsPerServing={analysis.gramsPerServing}
          />

          <ScorePanel
            title="Health Score"
            result={analysis.health}
            tone="health"
            note="An in-app heuristic tuned for gym-oriented everyday eating, not a medical assessment."
          />

          <ScorePanel
            title="Volume Score"
            result={analysis.volume}
            tone="volume"
            note="How much food arrives relative to its calories, weighted 65% physical bulk and 35% satiety support."
          />
        </div>

        <ServingStepper value={shown} base={recipe.servings} onChange={setServings} />

        <IngredientLines recipe={recipe} index={ingredientIndex} scale={scale} />

        {/* Directly under the ingredients, because that is what it acts on — and it
            takes the list as shown: this many servings, minus anything ruled out. */}
        <ShoppingButton
          onAdd={() => addRecipe(recipe, ingredientIndex, scale)}
          onOpen={() => router.push('/shopping')}
          listed={hasRecipe(recipe.id)}
        />

        <section style={{ marginTop: 28 }}>
          <h2 className="t-micro t-dim" style={{ margin: '0 0 14px', fontWeight: 300 }}>
            Method
          </h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 16 }}>
            {recipe.instructions.map((step) => (
              <li key={step.id} style={{ display: 'flex', gap: 14 }}>
                <span
                  className="t-micro t-dim-2"
                  style={{ flex: '0 0 auto', width: 18, paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}
                >
                  {String(step.step_number).padStart(2, '0')}
                </span>
                <span className="t-body" style={{ color: 'var(--ink-70)' }}>
                  {step.text}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {recipe.notes && (
          <section style={{ marginTop: 26 }}>
            <h2 className="t-micro t-dim" style={{ margin: '0 0 8px', fontWeight: 300 }}>
              Notes
            </h2>
            <p className="t-body" style={{ margin: 0, color: 'var(--ink-70)' }}>
              {recipe.notes}
            </p>
          </section>
        )}

        <CopyPromptButton recipe={recipe} index={ingredientIndex} />
      </div>
    </main>
  );
}

/**
 * Send these ingredients to the shopping list.
 *
 * Adding again replaces what this recipe already contributed rather than doubling
 * it, so changing the servings and tapping once more is the natural way to correct
 * the amounts — which is why the button keeps offering after the first tap instead
 * of turning into a dead "added" state.
 */
function ShoppingButton({
  onAdd,
  onOpen,
  listed,
}: {
  onAdd: () => void;
  onOpen: () => void;
  listed: boolean;
}) {
  const [flash, setFlash] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        transition={spring.dial}
        onClick={() => {
          onAdd();
          setFlash(true);
          window.setTimeout(() => setFlash(false), 1600);
        }}
        className="surface hairline"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          padding: '14px 18px',
          borderRadius: 'var(--r-pill)',
          fontSize: 13.5,
          fontWeight: 300,
          color: 'var(--ink-70)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
          <path
            d="M1.6 2h1.9l1.7 7.4h6.3l1.4-5.2H4.2"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="5.9" cy="12" r="1.05" fill="currentColor" />
          <circle cx="10.9" cy="12" r="1.05" fill="currentColor" />
        </svg>
        {flash ? 'Added to the list' : listed ? 'Update shopping list' : 'Add to shopping list'}
      </motion.button>

      <AnimatePresence initial={false}>
        {listed && (
          <motion.button
            key="open"
            type="button"
            onClick={onOpen}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.24, ease: ease.arrive }}
            className="t-micro t-dim"
            style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: 11.5, overflow: 'hidden' }}
          >
            View list →
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Says plainly that these numbers are not the recipe's own, and gives the original
 * back in one tap. A quiet swap of the macros with no explanation would read as the
 * app being wrong rather than as the app listening.
 */
function RunBadge({ asWritten, onToggle }: { asWritten: boolean; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: ease.arrive }}
      className="t-micro"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        padding: '6px 12px 6px 10px',
        borderRadius: 'var(--r-pill)',
        background: asWritten ? 'var(--ink-04)' : 'rgba(233,99,60,0.1)',
        color: asWritten ? 'var(--ink-45)' : '#b84a26',
        fontSize: 11.5,
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: 5,
          flex: '0 0 auto',
          background: asWritten ? 'var(--ink-30)' : '#e9633c',
        }}
      />
      {asWritten ? 'As written · show my version' : 'Adjusted for this run · show original'}
    </motion.button>
  );
}

function FloatControl({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileTap={{ scale: 0.93 }}
      className="hairline"
      style={{
        width: 38,
        height: 38,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 38,
        background: 'rgba(255,255,255,0.74)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: 'var(--ink-70)',
        boxShadow: 'var(--lift-1)',
      }}
    >
      {children}
    </motion.button>
  );
}
