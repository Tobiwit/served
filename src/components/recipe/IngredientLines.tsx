'use client';

import { useState } from 'react';
import type { Ingredient, IngredientRole, Recipe } from '@/lib/db/types';
import { formatAmount } from '@/lib/nutrition/units';
import { lineKcal } from '@/lib/nutrition/calc';

/**
 * The ingredient list, grouped by the role that governs Explore. Basics sit last
 * and quiet: they are the ones the app ignores when you exclude things.
 *
 * Calories per line are available but never assumed. Reading a recipe is deciding
 * whether to cook it; totting up what each spoonful of oil costs is a different and
 * much smaller question, and putting those numbers permanently down the margin turns
 * a list of food into a spreadsheet. So the switch is a word at the end of the
 * heading, and it starts off on every visit — including the next one.
 */

const ROLE_LABEL: Record<IngredientRole, string> = {
  core: 'Core',
  substitutable: 'Swappable',
  optional: 'Optional',
  basic: 'Pantry',
};

const ORDER: IngredientRole[] = ['core', 'substitutable', 'optional', 'basic'];

export function IngredientLines({
  recipe,
  index,
  scale,
}: {
  recipe: Recipe;
  index: Map<string, Ingredient>;
  scale: number;
}) {
  // deliberately not remembered anywhere: hidden is the state this list opens in
  const [showKcal, setShowKcal] = useState(false);

  const groups = ORDER.map((role) => ({
    role,
    items: recipe.ingredients.filter((ri) => ri.role === role),
  })).filter((g) => g.items.length > 0);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '0 0 14px' }}>
        <h2 className="t-micro t-dim" style={{ margin: 0, fontWeight: 300 }}>
          Ingredients
        </h2>
        <button
          type="button"
          onClick={() => setShowKcal((v) => !v)}
          aria-pressed={showKcal}
          className="t-micro"
          style={{ color: showKcal ? 'var(--ink-45)' : 'var(--ink-30)', padding: '2px 0' }}
        >
          {showKcal ? 'hide kcal' : 'kcal'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        {groups.map((group) => (
          <div key={group.role}>
            <div className="t-label t-dim-2" style={{ marginBottom: 8 }}>
              {ROLE_LABEL[group.role]}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 1 }}>
              {group.items.map((ri) => {
                const ing = ri.ingredient_id ? index.get(ri.ingredient_id) : null;
                const amount = ri.amount == null ? null : Math.round(ri.amount * scale * 100) / 100;
                // scaled with everything else: the line says what this plate costs
                const kcal = lineKcal(ri.grams == null ? null : ri.grams * scale, ing);
                return (
                  <li
                    key={ri.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 12,
                      padding: '9px 0',
                      borderBottom: '1px solid var(--ink-04)',
                    }}
                  >
                    <span
                      className="t-micro t-dim"
                      style={{ flex: '0 0 auto', minWidth: 62, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatAmount(amount, ri.unit) || '—'}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="t-body">{ri.display_name}</span>
                      {ri.notes && <span className="t-micro t-dim-2">{`, ${ri.notes}`}</span>}
                      {ri.substitutions.length > 0 && (
                        <span className="t-micro t-dim-2" style={{ display: 'block', marginTop: 2 }}>
                          or{' '}
                          {ri.substitutions
                            .map((s) => {
                              // a stand-in only states an amount when it differs from
                              // the line it replaces; otherwise it is the same measure
                              const own = formatAmount(
                                s.amount == null ? null : Math.round(s.amount * scale * 100) / 100,
                                s.unit,
                              );
                              return own ? `${own} ${s.display_name}` : s.display_name;
                            })
                            .join(', ')}
                        </span>
                      )}
                    </span>
                    {showKcal && (ing || kcal != null) && (
                      <span
                        className="t-micro t-dim-2"
                        style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}
                      >
                        {kcal == null ? '—' : `${kcal} kcal`}
                      </span>
                    )}
                    {!ing && (
                      <span className="t-label t-dim-2" style={{ fontSize: 8.5, flex: '0 0 auto' }}>
                        no data
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
