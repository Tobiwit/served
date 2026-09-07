'use client';

import { useState } from 'react';
import type { Ingredient, IngredientCategory, NewIngredient } from '@/lib/db/types';
import { CATEGORY_LABEL, INGREDIENT_CATEGORIES } from '@/lib/db/types';
import { searchName } from '@/seed/build';

/**
 * Creating an ingredient the database has never seen — or correcting one it holds.
 *
 * Pass `initial` and the same form becomes an editor: every field opens on the
 * stored value, the actions change wording, and everything the form does not ask
 * about — aliases, unit conversions, water — is carried through untouched rather
 * than quietly reset to empty.
 *
 * Calories lead because they are the value that makes the rest of the app work.
 * Every other macro is genuinely optional — left blank it stays unknown, and the
 * recipe still saves.
 *
 * Laid out for a phone with the keyboard up, which is the only way it is ever used:
 * every field is 16px so iOS does not zoom the page the moment one is focused (that
 * zoom was what pushed the form off the side of the screen), the twenty-one
 * categories wrap instead of hiding in a horizontal scroller inside a vertical one,
 * and the two actions ride a sticky bar so they are reachable without scrolling back
 * past the fields you just filled in.
 */
export function NewIngredientForm({
  initialName,
  initial = null,
  onCreate,
  onSkip,
}: {
  initialName: string;
  /** the stored ingredient being corrected, or null when this is a new one */
  initial?: Ingredient | null;
  onCreate: (i: NewIngredient) => void;
  onSkip: () => void;
}) {
  const editing = initial !== null;
  const [name, setName] = useState(initial?.name ?? initialName);
  const [category, setCategory] = useState<IngredientCategory>(initial?.category ?? 'other');
  const [kcal, setKcal] = useState(text(initial?.kcal_100g));
  const [protein, setProtein] = useState(text(initial?.protein_100g));
  const [carbs, setCarbs] = useState(text(initial?.carbs_100g));
  const [fat, setFat] = useState(text(initial?.fat_100g));
  const [fiber, setFiber] = useState(text(initial?.fiber_100g));
  const [basic, setBasic] = useState(initial?.default_basic ?? false);

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
      // the form never asks for water, so an edit must not answer for it
      water_100g: initial?.water_100g ?? null,
      default_basic: basic,
      aliases: initial
        ? aliasesAfterRename(initial, trimmed)
        : initialName.trim() && initialName.trim().toLowerCase() !== trimmed.toLowerCase()
          ? [initialName.trim()]
          : [],
      unit_conversions: initial?.unit_conversions ?? [],
    };
    onCreate(ingredient);
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Labelled label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={editing ? 'Name' : 'Protein tortilla'}
          style={inputStyle}
          aria-label="Ingredient name"
        />
      </Labelled>

      <Labelled label="Category" hint="Used by the Health and Volume scores">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {INGREDIENT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className="t-micro"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--r-pill)',
                whiteSpace: 'nowrap',
                fontSize: 11.5,
                background: category === c ? 'var(--ink)' : 'var(--paper)',
                color: category === c ? '#fff' : 'var(--ink-45)',
                boxShadow: category === c ? 'none' : 'inset 0 0 0 1px var(--ink-08)',
              }}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </Labelled>

      <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 14 }}>
        <div className="t-label t-dim-2" style={{ marginBottom: 10 }}>
          Per 100 g
        </div>

        <label style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <input
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            aria-label="Calories per 100g"
            style={{
              ...inputStyle,
              minWidth: 0,
              fontSize: 26,
              fontWeight: 200,
              padding: '4px 0',
              borderRadius: 0,
              border: 'none',
              borderBottom: '1px solid var(--ink-08)',
            }}
          />
          <span className="t-micro t-dim" style={{ flex: '0 0 auto' }}>
            kcal
          </span>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <Small label="Protein" value={protein} onChange={setProtein} />
          <Small label="Carbs" value={carbs} onChange={setCarbs} />
          <Small label="Fat" value={fat} onChange={setFat} />
          <Small label="Fibre" value={fiber} onChange={setFiber} />
        </div>

        <p className="t-micro t-dim-2" style={{ margin: '12px 0 0', lineHeight: 1.5 }}>
          Leave anything you do not know blank. Blank stays unknown — it is never counted as zero.
        </p>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={basic} onChange={(e) => setBasic(e.target.checked)} style={{ width: 17, height: 17 }} />
        <span className="t-micro t-dim">Pantry basic — hide from Explore ingredient bubbles</span>
      </label>

      {/* sticky, so the way out of the form is never below the fold */}
      <div
        style={{
          position: 'sticky',
          bottom: -1,
          display: 'flex',
          gap: 8,
          padding: '10px 0 2px',
          background: 'linear-gradient(180deg, rgba(236,236,237,0) 0%, var(--fog) 22%)',
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          className="surface hairline"
          style={{ flex: '0 0 auto', padding: '13px 16px', borderRadius: 'var(--r-pill)', fontSize: 14, fontWeight: 300, color: 'var(--ink-45)' }}
        >
          {editing ? 'Cancel' : 'Skip nutrition'}
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
          {editing ? 'Save changes' : 'Create ingredient'}
        </button>
      </div>
    </div>
  );
}

/** A stored macro as it should appear in a text field: blank stays blank, not "0". */
function text(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

/**
 * Renaming an ingredient keeps the old wording as an alias, so the recipes and the
 * imports that still say "courgette" go on matching after it becomes "zucchini".
 */
function aliasesAfterRename(initial: Ingredient, name: string): string[] {
  if (initial.name.toLowerCase() === name.toLowerCase()) return initial.aliases;
  return initial.aliases.some((a) => a.toLowerCase() === initial.name.toLowerCase())
    ? initial.aliases
    : [...initial.aliases, initial.name];
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--ink-08)',
  outline: 'none',
  background: 'var(--paper)',
  // 16px is the threshold below which mobile Safari zooms the page on focus
  fontSize: 16,
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
    <label style={{ display: 'block', minWidth: 0 }}>
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
          style={{ ...inputStyle, minWidth: 0, padding: '8px 10px' }}
        />
        <span className="t-micro t-dim-2" style={{ flex: '0 0 auto' }}>
          g
        </span>
      </div>
    </label>
  );
}

export type { Ingredient };
