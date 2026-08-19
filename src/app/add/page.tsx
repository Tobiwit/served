'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { parseRecipeText } from '@/lib/parse/recipeText';
import {
  blankIngredient,
  draftFromParsed,
  emptyDraft,
  resolveGrams,
  toNewRecipe,
  unresolvedCount,
  type Draft,
  type DraftIngredient,
} from '@/lib/add/draft';
import { matchIngredient, searchIngredients } from '@/lib/match/fuzzy';
import { MatchRow } from '@/components/add/MatchRow';
import { Sheet } from '@/components/add/Sheet';
import { NewIngredientForm } from '@/components/add/NewIngredientForm';
import { DraftHeader, InstructionEditor } from '@/components/add/DraftFields';
import { ease } from '@/lib/motion';

const SAMPLE = `Miso Butter Mushroom Toast
Serves 2 · Prep 10 min · Cook 10 min

Ingredients
300 g mushrooms, sliced
2 slices sourdough bread
1 tbsp miso paste
20 g butter
1 clove garlic
2 tbsp greek yoghurt
salt and pepper

Method
1. Fry the mushrooms hard in a dry pan until they squeak.
2. Add butter, garlic and miso and toss to coat.
3. Toast the bread and spread with yoghurt.
4. Pile the mushrooms on top.`;

export default function AddPage() {
  const router = useRouter();
  const { ingredients, ingredientIndex, saveRecipe, saveIngredient } = useData();

  const [text, setText] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sheet, setSheet] = useState<{ mode: 'search' | 'create'; key: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = useCallback(
    (key: string, changes: Partial<DraftIngredient>) => {
      setDraft((d) => {
        if (!d) return d;
        return {
          ...d,
          ingredients: d.ingredients.map((row) => {
            if (row.key !== key) return row;
            const next = { ...row, ...changes };
            if ('name' in changes && !('ingredientId' in changes)) {
              next.match = matchIngredient(next.name, ingredients);
              // a re-typed name follows the same rule as the initial parse:
              // confident matches apply themselves, anything less asks
              const auto = next.match.status === 'accepted' ? next.match.best : null;
              next.ingredientId = auto?.ingredient.id ?? null;
              next.confirmed = !!auto;
              if (auto?.ingredient.default_basic) next.role = 'basic';
            }
            next.grams = resolveGrams(next, ingredientIndex);
            return next;
          }),
        };
      });
    },
    [ingredients, ingredientIndex],
  );

  const activeRow = useMemo(
    () => (sheet ? (draft?.ingredients.find((r) => r.key === sheet.key) ?? null) : null),
    [sheet, draft],
  );

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveRecipe(toNewRecipe({ ...draft, sourceText: text || null }));
      router.push(`/recipe/${saved.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
        <header style={{ marginBottom: 20 }}>
          <h1 className="t-display" style={{ margin: 0 }}>
            Add a recipe
          </h1>
          <p className="t-micro t-dim" style={{ margin: '8px 0 0' }}>
            Paste it from anywhere. You review everything before it saves.
          </p>
        </header>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste recipe text here…"
          aria-label="Recipe text"
          rows={12}
          className="surface hairline"
          style={{
            width: '100%',
            padding: 16,
            borderRadius: 'var(--r-lg)',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontSize: 14.5,
            fontWeight: 300,
            lineHeight: 1.55,
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setDraft(draftFromParsed(parseRecipeText(text), ingredients, ingredientIndex))}
            disabled={!text.trim()}
            style={{
              flex: 1,
              minWidth: 160,
              padding: '14px 20px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--ink)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 300,
              opacity: text.trim() ? 1 : 0.4,
            }}
          >
            Parse recipe
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className="surface hairline"
            style={{ padding: '14px 20px', borderRadius: 'var(--r-pill)', fontSize: 14, fontWeight: 300, color: 'var(--ink-45)' }}
          >
            Start blank
          </button>
        </div>

        <button
          type="button"
          onClick={() => setText(SAMPLE)}
          className="t-micro t-dim-2"
          style={{ marginTop: 18, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Paste an example
        </button>
      </main>
    );
  }

  const unresolved = unresolvedCount(draft);

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 20px)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button type="button" onClick={() => setDraft(null)} className="t-micro t-dim">
          ← Back
        </button>
        <span style={{ flex: 1 }} />
        <span className="t-micro t-dim-2">
          {unresolved === 0 ? 'All ingredients resolved' : `${unresolved} to resolve`}
        </span>
      </header>

      <DraftHeader draft={draft} onChange={(changes) => setDraft({ ...draft, ...changes })} />

      <section style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="t-micro t-dim" style={{ margin: 0, fontWeight: 300 }}>
            Ingredients
          </h2>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, blankIngredient()] })}
            className="t-micro t-dim-2"
          >
            + Add row
          </button>
        </div>

        <motion.ul layout style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          <AnimatePresence initial={false}>
            {draft.ingredients.map((row, i) => (
              <MatchRow
                key={row.key}
                draft={row}
                index={ingredientIndex}
                onChange={(changes) => patch(row.key, changes)}
                onSearch={() => setSheet({ mode: 'search', key: row.key })}
                onCreate={() => setSheet({ mode: 'create', key: row.key })}
                onRemove={() =>
                  setDraft({ ...draft, ingredients: draft.ingredients.filter((_, idx) => idx !== i) })
                }
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      </section>

      <InstructionEditor
        steps={draft.instructions}
        onChange={(instructions) => setDraft({ ...draft, instructions })}
      />

      <div style={{ position: 'sticky', bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 8px)', marginTop: 26 }}>
        <motion.button
          type="button"
          onClick={save}
          disabled={saving || !draft.title.trim()}
          whileTap={{ scale: 0.985 }}
          style={{
            width: '100%',
            padding: '16px 20px',
            borderRadius: 'var(--r-xl)',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 300,
            boxShadow: 'var(--lift-3)',
            opacity: draft.title.trim() ? 1 : 0.45,
          }}
        >
          {saving ? 'Saving…' : 'Save recipe'}
        </motion.button>
        {unresolved > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: ease.arrive }}
            className="t-micro t-dim-2"
            style={{ textAlign: 'center', margin: '10px 0 0' }}
          >
            {unresolved} ingredient{unresolved === 1 ? '' : 's'} will save without nutrition
          </motion.p>
        )}
      </div>

      <Sheet
        open={!!sheet}
        title={sheet?.mode === 'create' ? 'New ingredient' : 'Find ingredient'}
        onClose={() => setSheet(null)}
      >
        {sheet?.mode === 'create' && activeRow && (
          <NewIngredientForm
            initialName={activeRow.name}
            onSkip={() => {
              patch(activeRow.key, { confirmed: true });
              setSheet(null);
            }}
            onCreate={async (payload) => {
              const created = await saveIngredient(payload);
              patch(activeRow.key, {
                ingredientId: created.id,
                confirmed: true,
                role: created.default_basic ? 'basic' : activeRow.role,
              });
              setSheet(null);
            }}
          />
        )}

        {sheet?.mode === 'search' && activeRow && (
          <IngredientSearch
            initial={activeRow.name}
            onPick={(id, isBasic) => {
              patch(activeRow.key, { ingredientId: id, confirmed: true, role: isBasic ? 'basic' : activeRow.role });
              setSheet(null);
            }}
          />
        )}
      </Sheet>
    </main>
  );
}

function IngredientSearch({ initial, onPick }: { initial: string; onPick: (id: string, isBasic: boolean) => void }) {
  const { ingredients } = useData();
  const [q, setQ] = useState(initial);
  const results = useMemo(() => searchIngredients(q, ingredients, 40), [q, ingredients]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the ingredient database"
        aria-label="Search ingredients"
        autoFocus
        className="surface hairline"
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 'var(--r-pill)',
          border: 'none',
          outline: 'none',
          fontSize: 14.5,
          fontWeight: 300,
        }}
      />
      <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'grid', gap: 6 }}>
        {results.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onPick(i.id, i.default_basic)}
              className="surface hairline"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 'var(--r-md)',
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
              }}
            >
              <span className="t-body" style={{ flex: 1 }}>
                {i.name}
              </span>
              <span className="t-micro t-dim-2">{i.kcal_100g == null ? 'no data' : `${i.kcal_100g} kcal`}</span>
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && (
        <p className="t-micro t-dim-2" style={{ textAlign: 'center', marginTop: 30 }}>
          Nothing found. Close this and choose Create new.
        </p>
      )}
    </div>
  );
}
