'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Ingredient } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import {
  applyMatch,
  blankIngredient,
  isResolved,
  removeRow,
  resolveGrams,
  setCustomName,
  settleNames,
  unresolvedCount,
  withSwapRows,
  type Draft,
  type DraftIngredient,
} from '@/lib/add/draft';
import { matchIngredient, searchIngredients } from '@/lib/match/fuzzy';
import { MatchRow } from '@/components/add/MatchRow';
import { Sheet } from '@/components/add/Sheet';
import { NewIngredientForm } from '@/components/add/NewIngredientForm';
import { DraftHeader, InstructionEditor } from '@/components/add/DraftFields';
import { ease } from '@/lib/motion';

/**
 * The draft editor.
 *
 * Shared by "add a recipe" and "edit this recipe" — the two are the same screen over
 * the same draft, and the only difference is where the draft came from and what the
 * save button says.
 */
export function RecipeEditor({
  draft,
  setDraft,
  onSave,
  saving,
  saveLabel,
  savingLabel,
  header,
}: {
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
  header: React.ReactNode;
}) {
  const { ingredients, ingredientIndex, saveIngredient } = useData();
  const [sheet, setSheet] = useState<{ mode: 'search' | 'create'; key: string } | null>(null);

  /**
   * `justCreated` is the ingredient this very patch brought into existence.
   *
   * Saving one updates the store, but the index this callback closed over is the one
   * from the render before that — so looking the new id up here found nothing, and
   * the row was handed a null ingredient and quietly lost its match. It only came
   * back once you retyped the name, by which point the store had caught up. Threading
   * the created record through means the row is wired to its nutrition immediately.
   */
  const patch = useCallback(
    (rowKey: string, changes: Partial<DraftIngredient>, justCreated?: Ingredient) => {
      const index = justCreated ? new Map(ingredientIndex).set(justCreated.id, justCreated) : ingredientIndex;
      const pool = justCreated ? [...ingredients, justCreated] : ingredients;

      setDraft((d) =>
        withSwapRows({
          ...d,
          ingredients: d.ingredients.map((row) => {
            if (row.key !== rowKey) return row;
            let next: DraftIngredient = { ...row, ...changes };

            if ('name' in changes) {
              const typed = changes.name ?? '';
              next.typedName = typed;
              if (row.ingredientId && row.confirmed) {
                // Renaming a settled ingredient is a wording choice, not a new
                // question: the nutrition stays attached and the row simply stops
                // following the canonical name.
                next.customName = true;
              } else {
                // a re-typed name follows the same rule as the initial parse:
                // confident matches apply themselves, anything less asks
                next.match = matchIngredient(typed, pool);
                const auto = next.match.status === 'accepted' ? next.match.best : null;
                next.ingredientId = auto?.ingredient.id ?? null;
                next.confirmed = !!auto;
                next.customName = false;
                if (auto?.ingredient.default_basic) next.role = 'basic';
              }
            }

            if ('ingredientId' in changes) {
              next = applyMatch(next, changes.ingredientId ? (index.get(changes.ingredientId) ?? null) : null, index);
            }

            if ('customName' in changes) next = setCustomName(next, !!changes.customName, index);

            /**
             * Folding a row away is the moment it is finished with, so it is also the
             * moment it takes the ingredient's canonical name. Doing it any earlier
             * would rewrite the field while it is still being typed in.
             */
            if (changes.collapsed === true && !next.customName && next.ingredientId) {
              next = applyMatch(next, index.get(next.ingredientId) ?? null, index);
              next.collapsed = true;
            }

            next.grams = resolveGrams(next, index);
            return next;
          }),
        }),
      );
    },
    [ingredients, ingredientIndex, setDraft],
  );

  /**
   * Starting a new ingredient folds the finished ones away. Auto-matching means some
   * rows arrive already settled and others never close on their own, so the list
   * drifts into a mix of open and shut cards; reaching for "add" is the clearest
   * signal that you are done with everything above.
   */
  const addRow = useCallback(
    (swapOf: string | null = null) => {
      setDraft((d) => {
        const tidied = settleNames(d, ingredientIndex).ingredients.map((r) => ({ ...r, collapsed: true }));
        return withSwapRows({ ...d, ingredients: [...tidied, blankIngredient(swapOf)] });
      });
    },
    [ingredientIndex, setDraft],
  );

  const activeRow = useMemo(
    () => (sheet ? (draft.ingredients.find((r) => r.key === sheet.key) ?? null) : null),
    [sheet, draft],
  );

  const unresolved = unresolvedCount(draft);
  const swappable = draft.ingredients.some((r) => r.swapOf === null && r.role === 'substitutable' && isResolved(r));

  return (
    <>
      {header}

      <DraftHeader draft={draft} onChange={(changes) => setDraft((d) => ({ ...d, ...changes }))} />

      <section style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 className="t-micro t-dim" style={{ margin: 0, fontWeight: 300 }}>
            Ingredients
          </h2>
          <button
            type="button"
            onClick={() => addRow()}
            className="t-micro t-dim-2"
          >
            + Add ingredient
          </button>
        </div>

        <motion.ul layout style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          <AnimatePresence initial={false}>
            {draft.ingredients.map((row) => (
              <MatchRow
                key={row.key}
                draft={row}
                index={ingredientIndex}
                onChange={(changes) => patch(row.key, changes)}
                onSearch={() => setSheet({ mode: 'search', key: row.key })}
                onCreate={() => setSheet({ mode: 'create', key: row.key })}
                onRemove={() => setDraft((d) => removeRow(d, row.key))}
              />
            ))}
          </AnimatePresence>
        </motion.ul>

        {/* the same action again at the foot of the list — a fifteen-line recipe
            should not send you back to the top to add the sixteenth */}
        <button
          type="button"
          onClick={() => addRow()}
          className="t-micro"
          style={{
            width: '100%',
            marginTop: 8,
            padding: '13px 16px',
            borderRadius: 'var(--r-lg)',
            border: '1px dashed var(--ink-14)',
            color: 'var(--ink-45)',
            fontSize: 12.5,
          }}
        >
          + Add ingredient
        </button>

        {swappable && (
          <p className="t-micro t-dim-2" style={{ margin: '10px 0 0', lineHeight: 1.5 }}>
            A stand-in is costed as the same line, never as an extra one — the nutrition below uses one ingredient per
            swap chain.
          </p>
        )}
      </section>

      <InstructionEditor
        steps={draft.instructions}
        onChange={(instructions) => setDraft((d) => ({ ...d, instructions }))}
      />

      <div style={{ position: 'sticky', bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 8px)', marginTop: 26 }}>
        <motion.button
          type="button"
          onClick={onSave}
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
          {saving ? savingLabel : saveLabel}
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
            initialName={activeRow.typedName || activeRow.name}
            onSkip={() => {
              patch(activeRow.key, { confirmed: true, collapsed: true });
              setSheet(null);
            }}
            onCreate={async (payload) => {
              const created = await saveIngredient(payload);
              patch(activeRow.key, { ingredientId: created.id, collapsed: true }, created);
              setSheet(null);
            }}
          />
        )}

        {sheet?.mode === 'search' && activeRow && (
          <IngredientSearch
            initial={activeRow.typedName || activeRow.name}
            onPick={(id) => {
              patch(activeRow.key, { ingredientId: id, collapsed: true });
              setSheet(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function IngredientSearch({ initial, onPick }: { initial: string; onPick: (id: string) => void }) {
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
          fontSize: 16,
          fontWeight: 300,
        }}
      />
      <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'grid', gap: 6 }}>
        {results.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onPick(i.id)}
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
