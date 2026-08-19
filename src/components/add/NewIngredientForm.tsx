'use client';

import { useState } from 'react';
import type { Ingredient, IngredientCategory, NewIngredient } from '@/lib/db/types';
import { CATEGORY_LABEL, INGREDIENT_CATEGORIES } from '@/lib/db/types';
import { searchName } from '@/seed/build';

/**
 * Creating an ingredient the database has never seen.
 *
 * Calories lead because they are the value that makes the rest of the app work.
 * Every other macro is genuinely optional — left blank it stays unknown, and the
 * recipe still saves.
 */
export function NewIngredientForm({
  initialName,
  onCreate,
  onSkip,
}: {
  initialName: string;
  onCreate: (i: NewIngredient) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<IngredientCategory>('other');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [basic, setBasic] = useState(false);

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ingredient: NewIngredient = {
      name: trimmed,
      search_name: searchName(trimmed),
      category,
      kcal_100g: num(kcal),
      protein_100g: num(protein),
      carbs_100g: num(carbs),
      fat_100g: num(fat),
      fiber_100g: num(fiber),
      water_100g: null,
      default_basic: basic,
      aliases: initialName.trim() && initialName.trim().toLowerCase() !== trimmed.toLowerCase() ? [initialName.trim()] : [],
      unit_conversions: [],
    };
    onCreate(ingredient);
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Labelled label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Protein tortilla"
          style={inputStyle}
          aria-label="Ingredient name"
        />
      </Labelled>

      <Labelled label="Category" hint="Used by the Health and Volume scores">
        <div className="hstrip no-scrollbar" style={{ margin: 0, padding: 0 }}>
          {INGREDIENT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className="t-micro"
              style={{
                flex: '0 0 auto',
                padding: '7px 12px',
                borderRadius: 'var(--r-pill)',
                whiteSpace: 'nowrap',
                background: category === c ? 'var(--ink)' : 'var(--paper)',
                color: category === c ? '#fff' : 'var(--ink-45)',
                boxShadow: 'var(--lift-1)',
              }}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </Labelled>

      <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 16 }}>
        <div className="t-label t-dim-2" style={{ marginBottom: 12 }}>
          Per 100 g
        </div>

        <Labelled label="Calories">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <input
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              aria-label="Calories per 100g"
              style={{ ...inputStyle, fontSize: 26, fontWeight: 200, padding: '4px 0', border: 'none', borderBottom: '1px solid var(--ink-08)' }}
            />
            <span className="t-micro t-dim">kcal</span>
          </div>
        </Labelled>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <Small label="Protein" value={protein} onChange={setProtein} />
          <Small label="Carbs" value={carbs} onChange={setCarbs} />
          <Small label="Fat" value={fat} onChange={setFat} />
          <Small label="Fibre" value={fiber} onChange={setFiber} />
        </div>

        <p className="t-micro t-dim-2" style={{ margin: '14px 0 0', lineHeight: 1.5 }}>
          Leave anything you do not know blank. Blank stays unknown — it is never counted as zero.
        </p>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={basic} onChange={(e) => setBasic(e.target.checked)} />
        <span className="t-micro t-dim">Pantry basic — hide from Explore ingredient bubbles</span>
      </label>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onSkip}
          className="surface hairline"
          style={{ flex: '0 0 auto', padding: '13px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, fontWeight: 300, color: 'var(--ink-45)' }}
        >
          Skip nutrition
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          style={{
            flex: 1,
            padding: '13px 18px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 300,
            opacity: name.trim() ? 1 : 0.4,
          }}
        >
          Create ingredient
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--ink-08)',
  outline: 'none',
  background: 'var(--paper)',
  fontSize: 14.5,
  fontWeight: 300,
};

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-micro t-dim" style={{ marginBottom: 6 }}>
        {label}
        {hint && <span className="t-dim-2"> · {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Small({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="t-micro t-dim-2" style={{ display: 'block', marginBottom: 4, fontSize: 11 }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="—"
          aria-label={`${label} per 100g`}
          style={{ ...inputStyle, padding: '7px 10px', fontSize: 14 }}
        />
        <span className="t-micro t-dim-2">g</span>
      </div>
    </label>
  );
}

export type { Ingredient };
