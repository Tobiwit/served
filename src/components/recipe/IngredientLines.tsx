'use client';

import type { Ingredient, IngredientRole, Recipe } from '@/lib/db/types';
import { formatAmount } from '@/lib/nutrition/units';

/**
 * The ingredient list, grouped by the role that governs Explore. Basics sit last
 * and quiet: they are the ones the app ignores when you exclude things.
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
  const groups = ORDER.map((role) => ({
    role,
    items: recipe.ingredients.filter((ri) => ri.role === role),
  })).filter((g) => g.items.length > 0);

  return (
    <section style={{ marginTop: 28 }}>
      <h2 className="t-micro t-dim" style={{ margin: '0 0 14px', fontWeight: 300 }}>
        Ingredients
      </h2>

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
                          or {ri.substitutions.map((s) => s.display_name).join(', ')}
                        </span>
                      )}
                    </span>
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
