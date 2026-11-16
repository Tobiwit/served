'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FoodLogEntry, FoodLogItem, Ingredient, MealSlot, Recipe } from '@/lib/db/types';
import { MEAL_SLOT_LABEL } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import { Sheet } from '@/components/add/Sheet';
import { NewIngredientForm } from '@/components/add/NewIngredientForm';
import type { QuickItem } from '@/lib/tracker/quick';
import { PrimaryButton } from './FoodComposer';
import { normalize } from '@/lib/match/fuzzy';
import { formatAmount } from '@/lib/nutrition/units';
import { ACTIVITY_COLOR, SLOT_COLOR, type Goals } from '@/lib/tracker/model';
import { findIngredient, gramsFor, parseUtterance, type SpokenItem } from '@/lib/tracker/spoken';
import { itemOf, openChoices, plateItems, plateOf, sumItems, type PlateChoices } from '@/lib/tracker/recipeLog';

/* ======================================================================= recipe */

/**
 * Logging a recipe from the collection: pick it, say how much of it, and say what
 * the plate actually was — which optionals made the cut, which stand-in filled each
 * swappable slot. The entry is logged line by line from those choices, so the bar
 * counts what was eaten rather than what was written, and the lines can still be
 * adjusted from the bar afterwards.
 */
export function RecipeLogSheet({
  open,
  slot,
  day,
  onClose,
}: {
  open: boolean;
  slot: MealSlot;
  day: string;
  onClose: () => void;
}) {
  const { recipes, analysisFor, lastCooked, saveFoodLog, ingredientIndex } = useData();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(1);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [choices, setChoices] = useState<PlateChoices>({ dropped: new Set(), swaps: new Map() });

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPicked(null);
    setServings(1);
    setLabel('');
    setSaving(false);
  }, [open]);

  const pick = (r: Recipe | null) => {
    setPicked(r);
    setLabel(r?.title ?? '');
    setChoices({ dropped: new Set(), swaps: new Map() });
  };

  // most recently cooked first — what you just made is what you are logging
  const list = useMemo(() => {
    const q = normalize(query);
    return recipes
      .filter((r) => !q || normalize(r.title).includes(q))
      .slice()
      .sort((a, b) => (lastCooked.get(b.id) ?? b.created_at).localeCompare(lastCooked.get(a.id) ?? a.created_at));
  }, [recipes, query, lastCooked]);

  const open_ = useMemo(() => (picked ? openChoices(picked, ingredientIndex) : null), [picked, ingredientIndex]);
  const items = useMemo(
    () => (picked ? plateItems(plateOf(picked, choices, ingredientIndex), servings, ingredientIndex) : []),
    [picked, choices, servings, ingredientIndex],
  );
  const totals = sumItems(items);

  const toggleOptional = (id: string) =>
    setChoices((c) => {
      const dropped = new Set(c.dropped);
      if (dropped.has(id)) dropped.delete(id);
      else dropped.add(id);
      return { ...c, dropped };
    });
  const chooseSwap = (riId: string, ingredientId: string) =>
    setChoices((c) => ({ ...c, swaps: new Map(c.swaps).set(riId, ingredientId) }));

  const save = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      await saveFoodLog({
        day,
        kind: 'food',
        slot,
        label: label.trim() || picked.title,
        ...totals,
        source: 'recipe',
        recipe_id: picked.id,
        servings,
        items,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title={`${MEAL_SLOT_LABEL[slot]} · Recipe`} onClose={onClose}>
      {!picked ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes"
            aria-label="Search recipes"
            className="surface hairline"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--r-pill)', border: 'none', outline: 'none', fontSize: 16, fontWeight: 300 }}
          />
          <ul className="surface hairline" style={{ listStyle: 'none', margin: 0, padding: '2px 0', borderRadius: 'var(--r-lg)' }}>
            {list.map((r, i) => {
              const n = analysisFor(r).nutrition.perServing;
              return (
                <li key={r.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--ink-04)' }}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    style={{ width: '100%', display: 'flex', alignItems: 'baseline', gap: 10, padding: '13px 14px', textAlign: 'left' }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title}
                    </span>
                    <span className="t-micro t-dim" style={{ flex: '0 0 auto' }}>
                      {n.kcal != null ? `${Math.round(n.kcal)} kcal` : '—'}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="t-micro t-dim" style={{ padding: 16, textAlign: 'center' }}>
                No recipe matches.
              </li>
            )}
          </ul>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <button type="button" onClick={() => pick(null)} className="t-micro t-dim" style={{ justifySelf: 'start' }}>
            ← All recipes
          </button>

          <label style={{ display: 'block' }}>
            <span className="t-micro t-dim" style={{ display: 'block', marginBottom: 6 }}>
              Label on the bar
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              aria-label="Label"
              className="surface hairline"
              style={{ width: '100%', padding: '13px 16px', borderRadius: 'var(--r-md)', border: 'none', outline: 'none', fontSize: 18, fontWeight: 300 }}
            />
          </label>

          <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="t-micro t-dim">Servings</div>
              <div style={{ fontSize: 30, fontWeight: 200, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{formatAmount(servings, null)}</div>
            </div>
            <Stepper onClick={() => setServings(lessServings)} label="Less" disabled={servings <= SMALL_PORTIONS[0]}>
              −
            </Stepper>
            <Stepper onClick={() => setServings(moreServings)} label="More" disabled={servings >= MAX_SERVINGS}>
              +
            </Stepper>
          </div>

          {open_ && open_.swaps.length > 0 && (
            <section className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 14, display: 'grid', gap: 12 }}>
              <div className="t-micro t-dim">What went in each slot</div>
              {open_.swaps.map(({ ri, options }) => {
                const chosen = choices.swaps.get(ri.id) ?? options[0].ingredientId;
                return (
                  <div key={ri.id} role="radiogroup" aria-label={ri.display_name} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {options.map((o) => (
                      <Chip key={o.ingredientId} on={chosen === o.ingredientId} onClick={() => chooseSwap(ri.id, o.ingredientId)} role="radio">
                        {o.name}
                      </Chip>
                    ))}
                  </div>
                );
              })}
            </section>
          )}

          {open_ && open_.optionals.length > 0 && (
            <section className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 14, display: 'grid', gap: 10 }}>
              <div className="t-micro t-dim">Optional — tap what didn&apos;t make the cut</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {open_.optionals.map((ri) => {
                  const dropped = choices.dropped.has(ri.id);
                  return (
                    <Chip key={ri.id} on={!dropped} struck={dropped} onClick={() => toggleOptional(ri.id)} role="checkbox">
                      {ingredientIndex.get(ri.ingredient_id ?? '')?.name ?? ri.display_name}
                    </Chip>
                  );
                })}
              </div>
            </section>
          )}

          <Totals {...totals} />

          <div style={{ position: 'sticky', bottom: 0, paddingTop: 4, background: 'var(--fog)', display: 'flex' }}>
            <PrimaryButton disabled={saving || items.length === 0} onClick={save}>
              {saving ? 'Saving…' : `Log ${totals.kcal} kcal`}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Chip({
  children,
  on,
  struck = false,
  onClick,
  role,
}: {
  children: React.ReactNode;
  on: boolean;
  struck?: boolean;
  onClick: () => void;
  role: 'radio' | 'checkbox';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={on}
      onClick={onClick}
      style={{
        padding: '8px 13px',
        borderRadius: 'var(--r-pill)',
        fontSize: 12.5,
        fontWeight: 300,
        whiteSpace: 'nowrap',
        background: on ? 'var(--ink)' : 'var(--paper)',
        color: on ? '#fff' : 'var(--ink-45)',
        boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--ink-08)',
        textDecoration: struck ? 'line-through' : 'none',
        transition: 'background 200ms ease, color 200ms ease',
      }}
    >
      {children}
    </button>
  );
}

function Totals({ kcal, protein, carbs, fat }: { kcal: number; protein: number; carbs: number; fat: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '0 4px' }}>
      <span style={{ fontSize: 22, fontWeight: 200, letterSpacing: '-0.03em' }}>
        {Math.round(kcal)} <span className="t-micro t-dim">kcal</span>
      </span>
      <span className="t-micro t-dim">
        P {Math.round(protein)} · C {Math.round(carbs)} · F {Math.round(fat)}
      </span>
    </div>
  );
}

/**
 * Portions step by halves from one upwards, but below one they follow the fractions
 * a plate actually gets split into: half, then a third, then a quarter.
 */
const SMALL_PORTIONS = [1 / 4, 1 / 3, 1 / 2, 1];
const MAX_SERVINGS = 10;

function lessServings(s: number): number {
  if (s > 1) return Math.max(1, s - 0.5);
  const below = SMALL_PORTIONS.filter((p) => p < s - 1e-6);
  return below.length ? below[below.length - 1] : s;
}

function moreServings(s: number): number {
  if (s >= 1) return Math.min(MAX_SERVINGS, s + 0.5);
  return SMALL_PORTIONS.find((p) => p > s + 1e-6) ?? 1;
}

function Stepper({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'var(--ink-04)',
        fontSize: 20,
        fontWeight: 200,
        opacity: disabled ? 0.35 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {children}
    </button>
  );
}

/* ======================================================================== entry */

interface Row {
  key: string;
  item: FoodLogItem;
}

let rowSeq = 0;
const rowKey = () => `r${(rowSeq++).toString(36)}`;

/**
 * Entries logged before lines were kept carry only a total. They open as a single
 * line standing for the whole thing, so they can be added to — or replaced — the
 * same way as any other entry.
 */
function rowsOf(entry: FoodLogEntry): Row[] {
  if (entry.items.length) return entry.items.map((item) => ({ key: rowKey(), item }));
  return [
    {
      key: rowKey(),
      item: {
        name: `${entry.label} (as logged)`,
        ingredient_id: null,
        amount: entry.servings,
        unit: entry.servings ? 'serving' : null,
        grams: null,
        kcal: entry.kcal,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      },
    },
  ];
}

/**
 * A segment of the bar, opened. Its lines can be changed for this log only — a line
 * taken out, reweighed, or something added — and the recipe it came from is never
 * touched. The whole entry can also come off the day.
 */
export function EntrySheet({ entry, onClose }: { entry: FoodLogEntry | null; onClose: () => void }) {
  const { deleteFoodLog, saveFoodLog, ingredients, ingredientIndex, saveIngredient } = useData();
  const [confirming, setConfirming] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState('');
  const [unknown, setUnknown] = useState<SpokenItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfirming(false);
    setDirty(false);
    setAdding('');
    setUnknown(null);
    setSaving(false);
    setRows(entry ? rowsOf(entry) : []);
  }, [entry]);

  const activity = entry?.kind === 'activity';
  const color = entry ? (activity ? ACTIVITY_COLOR : entry.slot ? SLOT_COLOR[entry.slot] : SLOT_COLOR.snack) : 'transparent';
  const time = entry ? new Date(entry.logged_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  const items = rows.map((r) => r.item);
  const totals = activity || !entry ? null : dirty ? sumItems(items) : { kcal: entry.kcal, protein: entry.protein ?? 0, carbs: entry.carbs ?? 0, fat: entry.fat ?? 0 };

  const change = (next: Row[]) => {
    setRows(next);
    setDirty(true);
  };

  const reweigh = (key: string, grams: number | null) =>
    change(
      rows.map((r) => {
        if (r.key !== key) return r;
        const ing = r.item.ingredient_id ? (ingredientIndex.get(r.item.ingredient_id) ?? null) : null;
        if (!ing) return r;
        return { key, item: itemOf(ing, grams, r.item.name, grams, grams == null ? null : 'g') };
      }),
    );

  const addLine = (s: SpokenItem, ing: Ingredient) =>
    change([...rows, { key: rowKey(), item: itemOf(ing, gramsFor(s.amount, s.unit, ing), s.name, s.amount, s.unit) }]);

  const submitAdd = () => {
    const parsed = parseUtterance(adding).filter((p): p is SpokenItem => typeof p !== 'string');
    if (!parsed.length) return;
    const next = [...rows];
    for (const s of parsed) {
      const ing = findIngredient(s.name, ingredients)?.ingredient ?? null;
      if (!ing) {
        // one unknown at a time: fill it in, and it lands like any other line
        setRows(next);
        setDirty(true);
        setUnknown(s);
        setAdding('');
        return;
      }
      next.push({ key: rowKey(), item: itemOf(ing, gramsFor(s.amount, s.unit, ing), s.name, s.amount, s.unit) });
    }
    change(next);
    setAdding('');
  };

  const save = async () => {
    if (!entry || saving) return;
    setSaving(true);
    try {
      const { created_at, updated_at, ...rest } = entry;
      void created_at;
      void updated_at;
      await saveFoodLog({ ...rest, ...sumItems(items), items });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={entry !== null} title={entry?.label ?? ''} onClose={onClose}>
      {entry && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span className="t-micro t-dim">
              {activity ? 'Activity' : entry.slot ? MEAL_SLOT_LABEL[entry.slot] : 'Food'} · {time}
              {entry.servings ? ` · ${formatAmount(entry.servings, null)} serving${entry.servings <= 1 ? '' : 's'}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 34, fontWeight: 200, letterSpacing: '-0.04em' }}>
              {activity ? '+' : ''}
              {Math.round(totals?.kcal ?? entry.kcal)} <span className="t-micro t-dim">kcal</span>
            </span>
            {totals && (
              <span className="t-micro t-dim">
                P {Math.round(totals.protein)} · C {Math.round(totals.carbs)} · F {Math.round(totals.fat)}
              </span>
            )}
            {dirty && (
              <span className="t-micro" style={{ marginLeft: 'auto', color: 'var(--ink-45)' }}>
                was {Math.round(entry.kcal)}
              </span>
            )}
          </div>

          {!activity && (
            <>
              <ul className="surface hairline" style={{ listStyle: 'none', margin: 0, padding: '2px 0', borderRadius: 'var(--r-lg)' }}>
                {rows.map((r, i) => {
                  const weighable = r.item.ingredient_id != null && ingredientIndex.has(r.item.ingredient_id);
                  return (
                    <li
                      key={r.key}
                      style={{ display: 'flex', gap: 10, padding: '9px 10px 9px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--ink-04)', alignItems: 'center' }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item.name}</span>
                      {weighable ? (
                        <label style={{ display: 'flex', alignItems: 'baseline', gap: 3, flex: '0 0 auto' }}>
                          <input
                            value={r.item.grams == null ? '' : String(Math.round(r.item.grams))}
                            onChange={(e) => {
                              const v = e.target.value.replace(',', '.').trim();
                              const n = Number(v);
                              reweigh(r.key, v === '' ? null : Number.isFinite(n) ? n : r.item.grams);
                            }}
                            inputMode="decimal"
                            placeholder="?"
                            aria-label={`Grams of ${r.item.name}`}
                            style={{
                              width: 50,
                              textAlign: 'right',
                              padding: '5px 6px',
                              borderRadius: 'var(--r-xs)',
                              border: 'none',
                              outline: 'none',
                              background: r.item.grams == null ? 'rgba(255,131,96,0.14)' : 'var(--ink-04)',
                              fontSize: 16,
                              fontWeight: 300,
                            }}
                          />
                          <span className="t-micro t-dim-2">g</span>
                        </label>
                      ) : (
                        <span className="t-micro t-dim-2" style={{ flex: '0 0 auto' }}>
                          {r.item.grams != null ? `${Math.round(r.item.grams)} g` : r.item.amount != null ? formatAmount(r.item.amount, r.item.unit) : ''}
                        </span>
                      )}
                      <span className="t-micro t-dim" style={{ width: 54, textAlign: 'right', flex: '0 0 auto' }}>
                        {r.item.kcal != null ? `${Math.round(r.item.kcal)} kcal` : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => change(rows.filter((x) => x.key !== r.key))}
                        aria-label={`Remove ${r.item.name}`}
                        style={{ padding: 4, color: 'var(--ink-30)', flex: '0 0 auto' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                          <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
                {rows.length === 0 && (
                  <li className="t-micro t-dim" style={{ padding: 14, textAlign: 'center' }}>
                    Nothing left on this plate.
                  </li>
                )}
              </ul>

              {unknown ? (
                <div>
                  <p className="t-body" style={{ margin: '0 0 4px' }}>
                    <span className="t-dim">Not in your ingredients yet:</span> {unknown.name}
                  </p>
                  <p className="t-micro t-dim-2" style={{ margin: '0 0 14px' }}>
                    Fill it in once and it is saved for next time.
                  </p>
                  <NewIngredientForm
                    key={unknown.spoken}
                    initialName={unknown.name.charAt(0).toUpperCase() + unknown.name.slice(1)}
                    onCreate={async (i) => {
                      const saved = await saveIngredient(i);
                      addLine(unknown, saved);
                      setUnknown(null);
                    }}
                    onSkip={() => setUnknown(null)}
                  />
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitAdd();
                  }}
                  className="surface hairline"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 'var(--r-pill)' }}
                >
                  <input
                    value={adding}
                    onChange={(e) => setAdding(e.target.value)}
                    placeholder="Add — e.g. feta 30 g"
                    aria-label="Add an ingredient"
                    enterKeyHint="enter"
                    style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 300 }}
                  />
                  <button
                    type="submit"
                    disabled={!adding.trim()}
                    className="t-micro"
                    style={{ padding: '8px 13px', borderRadius: 'var(--r-pill)', background: 'var(--ink-08)', opacity: adding.trim() ? 1 : 0.4 }}
                  >
                    Add
                  </button>
                </form>
              )}

              <p className="t-micro t-dim-2" style={{ margin: '-4px 4px 0', fontSize: 11 }}>
                Changes here are for today&apos;s log only{entry.recipe_id ? ' — the recipe stays as it is' : ''}.
              </p>
            </>
          )}

          {dirty && !unknown && (
            <div style={{ position: 'sticky', bottom: 0, paddingTop: 4, background: 'var(--fog)', display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setRows(rowsOf(entry));
                  setDirty(false);
                }}
                className="surface hairline"
                style={{ padding: '13px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, color: 'var(--ink-45)' }}
              >
                Revert
              </button>
              <PrimaryButton disabled={saving} onClick={save}>
                {saving ? 'Saving…' : `Save · ${sumItems(items).kcal} kcal`}
              </PrimaryButton>
            </div>
          )}

          {!dirty &&
            (confirming ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="surface hairline"
                  style={{ flex: 1, padding: '13px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, color: 'var(--ink-45)' }}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteFoodLog(entry.id);
                    onClose();
                  }}
                  style={{ flex: 1, padding: '13px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, background: 'var(--coral)', color: '#fff' }}
                >
                  Remove from the day
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="t-micro"
                style={{ justifySelf: 'start', color: '#c4472f', padding: '6px 0' }}
              >
                Remove…
              </button>
            ))}
        </div>
      )}
    </Sheet>
  );
}

/* ======================================================================== goals */

export function GoalsSheet({
  open,
  goals,
  onSave,
  onClose,
}: {
  open: boolean;
  goals: Goals;
  onSave: (g: Goals) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({ kcal: '', protein: '', carbs: '', fat: '' });

  useEffect(() => {
    if (!open) return;
    setDraft({ kcal: String(goals.kcal), protein: String(goals.protein), carbs: String(goals.carbs), fat: String(goals.fat) });
  }, [open, goals]);

  const num = (v: string, fallback: number) => {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
  };

  // what the macros add up to, so a goal set that contradicts itself is visible
  const fromMacros = num(draft.protein, 0) * 4 + num(draft.carbs, 0) * 4 + num(draft.fat, 0) * 9;

  const field = (key: keyof typeof draft, label: string, unit: string, big = false) => (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span className="t-micro t-dim" style={{ display: 'block', marginBottom: 6 }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <input
          value={draft[key]}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          inputMode="numeric"
          aria-label={label}
          style={{
            width: '100%',
            minWidth: 0,
            padding: '4px 0',
            border: 'none',
            borderBottom: '1px solid var(--ink-08)',
            outline: 'none',
            background: 'transparent',
            fontSize: big ? 34 : 22,
            fontWeight: 200,
            letterSpacing: '-0.03em',
          }}
        />
        <span className="t-micro t-dim-2">{unit}</span>
      </span>
    </label>
  );

  return (
    <Sheet open={open} title="Daily goals" onClose={onClose}>
      <div style={{ display: 'grid', gap: 18 }}>
        <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 16 }}>
          {field('kcal', 'Calories', 'kcal', true)}
          <p className="t-micro t-dim-2" style={{ margin: '10px 0 0', fontSize: 11 }}>
            Activities you log add to this for the day.
          </p>
        </div>
        <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {field('protein', 'Protein', 'g')}
          {field('carbs', 'Carbs', 'g')}
          {field('fat', 'Fat', 'g')}
        </div>
        <p className="t-micro t-dim" style={{ margin: '-6px 4px 0' }}>
          The macros add up to {fromMacros} kcal.
        </p>
        <PrimaryButton
          onClick={() => {
            onSave({
              kcal: num(draft.kcal, goals.kcal),
              protein: num(draft.protein, goals.protein),
              carbs: num(draft.carbs, goals.carbs),
              fat: num(draft.fat, goals.fat),
            });
            onClose();
          }}
        >
          Save goals
        </PrimaryButton>
      </div>
    </Sheet>
  );
}

/* ================================================================ quick setup */

/**
 * A quicklink whose ingredient has never been stored. Asked once: the ingredient is
 * saved with every name the quicklink knows it by, so the next tap just logs.
 */
export function QuickIngredientSheet({
  item,
  quickLabel,
  onCreated,
  onClose,
}: {
  item: QuickItem | null;
  quickLabel: string;
  onCreated: (ingredient: Ingredient) => void;
  onClose: () => void;
}) {
  const { saveIngredient } = useData();
  return (
    <Sheet open={item !== null} title={item?.name ?? ''} onClose={onClose}>
      {item && (
        <div>
          <p className="t-body" style={{ margin: '0 0 4px' }}>
            Not in your ingredients yet.
          </p>
          <p className="t-micro t-dim-2" style={{ margin: '0 0 14px' }}>
            Fill it in once — {quickLabel} logs straight after, and every tap from then on is instant.
          </p>
          <NewIngredientForm
            initialName={item.name}
            onCreate={async (i) => {
              const known = new Set(i.aliases.map((a) => a.toLowerCase()));
              const aliases = [...i.aliases, ...item.match.filter((m) => !known.has(m) && m !== i.name.toLowerCase())];
              const saved = await saveIngredient({ ...i, aliases });
              onCreated(saved);
            }}
            onSkip={onClose}
          />
        </div>
      )}
    </Sheet>
  );
}
