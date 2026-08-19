'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { CATEGORY_LABEL, type Ingredient, type NewIngredient } from '@/lib/db/types';
import { searchIngredients } from '@/lib/match/fuzzy';
import { Sheet } from '@/components/add/Sheet';
import { NewIngredientForm } from '@/components/add/NewIngredientForm';
import { spring } from '@/lib/motion';

/**
 * The ingredient database. Nutrition lives here, per 100 g, and every recipe reads
 * from it — so editing a value here changes every recipe that uses it.
 */
export default function IngredientsPage() {
  const { ingredients, saveIngredient, deleteIngredient, recipes } = useData();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [creating, setCreating] = useState(false);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      for (const ri of r.ingredients) {
        if (ri.ingredient_id) counts.set(ri.ingredient_id, (counts.get(ri.ingredient_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [recipes]);

  const visible = useMemo(() => {
    const list = q.trim() ? searchIngredients(q, ingredients, 200) : ingredients;
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [q, ingredients]);

  const missing = ingredients.filter((i) => i.kcal_100g == null).length;

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 className="t-display" style={{ margin: 0 }}>
          Ingredients
        </h1>
        <p className="t-micro t-dim" style={{ margin: '8px 0 0' }}>
          {ingredients.length} entries · {missing} without calories
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ingredients"
          aria-label="Search ingredients"
          className="surface hairline"
          style={{
            flex: 1,
            padding: '11px 16px',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            outline: 'none',
            fontSize: 14.5,
            fontWeight: 300,
          }}
        />
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="New ingredient"
          style={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 44,
            background: 'var(--ink)',
            color: '#fff',
            flex: '0 0 auto',
            boxShadow: 'var(--lift-2)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
            <path d="M3 7.5h9M7.5 3v9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: 6 }}>
        {visible.map((i, idx) => (
          <motion.li
            key={i.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.settle, delay: Math.min(idx * 0.008, 0.18) }}
          >
            <button
              type="button"
              onClick={() => setEditing(i)}
              className="surface hairline"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 'var(--r-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="t-body" style={{ display: 'block' }}>
                  {i.name}
                </span>
                <span className="t-micro t-dim-2" style={{ display: 'block', marginTop: 2, fontSize: 11 }}>
                  {CATEGORY_LABEL[i.category]}
                  {i.default_basic ? ' · pantry' : ''}
                  {usage.get(i.id) ? ` · in ${usage.get(i.id)} recipe${usage.get(i.id) === 1 ? '' : 's'}` : ''}
                </span>
              </span>
              <span className="t-micro" style={{ color: i.kcal_100g == null ? 'var(--ink-30)' : 'var(--ink-45)' }}>
                {i.kcal_100g == null ? 'no data' : `${i.kcal_100g} kcal`}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>

      <Sheet open={creating} title="New ingredient" onClose={() => setCreating(false)}>
        <NewIngredientForm
          initialName=""
          onSkip={() => setCreating(false)}
          onCreate={async (payload: NewIngredient) => {
            await saveIngredient(payload);
            setCreating(false);
          }}
        />
      </Sheet>

      <Sheet open={!!editing} title={editing?.name ?? ''} onClose={() => setEditing(null)}>
        {editing && (
          <div>
            <NewIngredientForm
              key={editing.id}
              initialName={editing.name}
              onSkip={() => setEditing(null)}
              onCreate={async (payload) => {
                await saveIngredient({ ...payload, id: editing.id, aliases: editing.aliases, unit_conversions: editing.unit_conversions });
                setEditing(null);
              }}
            />
            <button
              type="button"
              onClick={async () => {
                await deleteIngredient(editing.id);
                setEditing(null);
              }}
              className="t-micro t-dim-2"
              style={{ marginTop: 20, textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Delete this ingredient
            </button>
          </div>
        )}
      </Sheet>
    </main>
  );
}
