'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FoodLogEntry, Ingredient, MealSlot, Recipe } from '@/lib/db/types';
import { MEAL_SLOT_LABEL } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import { Sheet } from '@/components/add/Sheet';
import { NewIngredientForm } from '@/components/add/NewIngredientForm';
import type { QuickItem } from '@/lib/tracker/quick';
import { PrimaryButton } from './FoodComposer';
import { normalize } from '@/lib/match/fuzzy';
import { formatAmount } from '@/lib/nutrition/units';
import { ACTIVITY_COLOR, SLOT_COLOR, round1, type Goals } from '@/lib/tracker/model';

/* ======================================================================= recipe */

/**
 * Logging a recipe from the collection: pick it, say how much of it, done. The
 * per-serving numbers are the ones the recipe screen shows, so what the bar says
 * and what the recipe said always agree.
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
  const { recipes, analysisFor, lastCooked, saveFoodLog } = useData();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(1);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPicked(null);
    setServings(1);
    setLabel('');
    setSaving(false);
  }, [open]);

  // most recently cooked first — what you just made is what you are logging
  const list = useMemo(() => {
    const q = normalize(query);
    return recipes
      .filter((r) => !q || normalize(r.title).includes(q))
      .slice()
      .sort((a, b) => (lastCooked.get(b.id) ?? b.created_at).localeCompare(lastCooked.get(a.id) ?? a.created_at));
  }, [recipes, query, lastCooked]);

  const per = picked ? analysisFor(picked).nutrition.perServing : null;
  const scaled = (v: number | null | undefined) => (v == null ? null : round1(v * servings));

  const save = async () => {
    if (!picked || !per || saving) return;
    setSaving(true);
    try {
      await saveFoodLog({
        day,
        kind: 'food',
        slot,
        label: label.trim() || picked.title,
        kcal: Math.round((per.kcal ?? 0) * servings),
        protein: scaled(per.protein),
        carbs: scaled(per.carbs),
        fat: scaled(per.fat),
        source: 'recipe',
        recipe_id: picked.id,
        servings,
        items: [],
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
                    onClick={() => {
                      setPicked(r);
                      setLabel(r.title);
                    }}
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
          <button type="button" onClick={() => setPicked(null)} className="t-micro t-dim" style={{ justifySelf: 'start' }}>
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

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '0 4px' }}>
            <span style={{ fontSize: 22, fontWeight: 200, letterSpacing: '-0.03em' }}>
              {per?.kcal != null ? Math.round(per.kcal * servings) : '—'} <span className="t-micro t-dim">kcal</span>
            </span>
            <span className="t-micro t-dim">
              P {Math.round(scaled(per?.protein) ?? 0)} · C {Math.round(scaled(per?.carbs) ?? 0)} · F {Math.round(scaled(per?.fat) ?? 0)}
            </span>
          </div>

          <PrimaryButton disabled={saving || per?.kcal == null} onClick={save}>
            {saving ? 'Saving…' : 'Log it'}
          </PrimaryButton>
        </div>
      )}
    </Sheet>
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

/** What a segment of the bar was, and a way to take it back off. */
export function EntrySheet({ entry, onClose }: { entry: FoodLogEntry | null; onClose: () => void }) {
  const { deleteFoodLog } = useData();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [entry]);

  const activity = entry?.kind === 'activity';
  const color = entry ? (activity ? ACTIVITY_COLOR : entry.slot ? SLOT_COLOR[entry.slot] : SLOT_COLOR.snack) : 'transparent';
  const time = entry ? new Date(entry.logged_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

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
              {Math.round(entry.kcal)} <span className="t-micro t-dim">kcal</span>
            </span>
            {!activity && (
              <span className="t-micro t-dim">
                P {Math.round(entry.protein ?? 0)} · C {Math.round(entry.carbs ?? 0)} · F {Math.round(entry.fat ?? 0)}
              </span>
            )}
          </div>

          {entry.items.length > 0 && (
            <ul className="surface hairline" style={{ listStyle: 'none', margin: 0, padding: '2px 0', borderRadius: 'var(--r-lg)' }}>
              {entry.items.map((it, i) => (
                <li
                  key={i}
                  style={{ display: 'flex', gap: 10, padding: '10px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--ink-04)', alignItems: 'baseline' }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{it.name}</span>
                  <span className="t-micro t-dim-2">{it.grams != null ? `${Math.round(it.grams)} g` : '—'}</span>
                  <span className="t-micro t-dim" style={{ width: 60, textAlign: 'right' }}>
                    {it.kcal != null ? `${Math.round(it.kcal)} kcal` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {confirming ? (
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
          )}
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
