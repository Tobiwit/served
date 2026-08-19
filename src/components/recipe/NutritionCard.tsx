'use client';

import { motion } from 'motion/react';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { DotBars } from '@/components/instrument/DotBars';
import type { NutritionResult } from '@/lib/nutrition/calc';
import { spring } from '@/lib/motion';

/**
 * Nutrition, per serving by default.
 *
 * Unknown values print as an em dash, never as zero, and the card says how much of
 * the dish it could actually account for. Precision it does not have is precision
 * it does not claim.
 */

export function NutritionCard({
  nutrition,
  servings,
  showTotal,
  onToggleTotal,
  gramsPerServing,
}: {
  nutrition: NutritionResult;
  servings: number;
  showTotal: boolean;
  onToggleTotal: () => void;
  gramsPerServing: number;
}) {
  const n = showTotal ? nutrition.total : nutrition.perServing;
  const complete = Math.round(nutrition.completeness * 100);

  // energy split by calories, not by grams — the only honest way to draw this
  const energy = [
    { key: 'protein', kcal: (n.protein ?? 0) * 4 },
    { key: 'carbs', kcal: (n.carbs ?? 0) * 4 },
    { key: 'fat', kcal: (n.fat ?? 0) * 9 },
  ];
  const sum = energy.reduce((a, e) => a + e.kcal, 0);
  const bars = sum > 0 ? energy.map((e) => e.kcal / sum) : [];

  return (
    <section className="surface hairline" style={{ borderRadius: 'var(--r-xl)', padding: '18px 18px 16px' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="t-micro t-dim" style={{ margin: 0, fontWeight: 300 }}>
          Nutrition
        </h2>
        <button
          type="button"
          onClick={onToggleTotal}
          className="t-micro"
          style={{ color: 'var(--ink-45)', padding: '2px 0' }}
        >
          {showTotal ? `whole recipe · ${servings} servings` : 'per serving'}
        </button>
      </header>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {n.kcal == null ? (
            <span className="t-display t-dim-2">—</span>
          ) : (
            <DottedNumber value={Math.round(n.kcal)} size={54} color="var(--ink)" weight={0.62} />
          )}
          <span className="t-micro t-dim" style={{ paddingBottom: 5 }}>
            kcal
          </span>
        </div>

        {bars.length > 0 && (
          <span style={{ paddingBottom: 4 }}>
            <DotBars values={bars} ink="ink" height={30} gap={9} rows={6} dot={1.6} />
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 18 }}>
        <Macro label="Protein" value={n.protein} />
        <Macro label="Carbs" value={n.carbs} />
        <Macro label="Fat" value={n.fat} />
        <Macro label="Fibre" value={n.fiber} />
      </div>

      <footer style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
        <span className="t-micro t-dim-2">
          {showTotal ? `${Math.round(gramsPerServing * servings)} g total` : `${Math.round(gramsPerServing)} g per serving`}
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--ink-08)' }} />
        <span className="t-micro t-dim-2">{complete}% complete</span>
      </footer>

      {nutrition.unresolved.length > 0 && (
        <p className="t-micro t-dim-2" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
          Not counted: {nutrition.unresolved.join(', ')}
        </p>
      )}
    </section>
  );
}

function Macro({ label, value }: { label: string; value: number | null }) {
  return (
    <motion.div layout transition={spring.dial}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span className="t-sub" style={{ color: value == null ? 'var(--ink-30)' : 'var(--ink)' }}>
          {value == null ? '—' : Math.round(value)}
        </span>
        {value != null && (
          <span className="t-micro t-dim-2" style={{ fontSize: 11 }}>
            g
          </span>
        )}
      </div>
      <div className="t-micro t-dim-2" style={{ marginTop: 1, fontSize: 11 }}>
        {label}
      </div>
    </motion.div>
  );
}
