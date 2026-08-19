'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { RecipeImage } from '@/components/explore/RecipeImage';
import { NutritionCard } from '@/components/recipe/NutritionCard';
import { ScorePanel } from '@/components/recipe/ScorePanel';
import { ServingStepper } from '@/components/recipe/ServingStepper';
import { IngredientLines } from '@/components/recipe/IngredientLines';
import { CopyPromptButton } from '@/components/recipe/CopyPromptButton';
import { ease } from '@/lib/motion';

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { recipes, ingredientIndex, analysisFor, saveRecipe, ready } = useData();

  const [servings, setServings] = useState<number | null>(null);
  const [showTotal, setShowTotal] = useState(false);

  const recipe = useMemo(() => recipes.find((r) => r.id === id) ?? null, [recipes, id]);
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
            {[recipe.cuisine, recipe.course_type, recipe.total_minutes ? `${recipe.total_minutes} min` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </motion.header>

        <div style={{ display: 'grid', gap: 10, marginTop: 22 }}>
          <NutritionCard
            nutrition={analysis.nutrition}
            servings={recipe.servings}
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
