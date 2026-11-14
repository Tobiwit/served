'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { FoodLogItem, Ingredient, MealSlot } from '@/lib/db/types';
import { MEAL_SLOT_LABEL } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import { Sheet } from '@/components/add/Sheet';
import { NewIngredientForm } from '@/components/add/NewIngredientForm';
import { GradientField } from '@/components/glass/GradientField';
import { Ripple } from '@/components/instrument/Ripple';
import { formatAmount } from '@/lib/nutrition/units';
import { findIngredient, gramsFor, parseUtterance, type SpeechLang, type SpokenItem } from '@/lib/tracker/spoken';
import { useDictation } from '@/lib/tracker/useDictation';
import { SLOT_COLOR, round1 } from '@/lib/tracker/model';
import { ease, spring } from '@/lib/motion';

/**
 * Logging a meal by its ingredients — talking it through, or typing one line.
 *
 *   collect   say (or type) what went in; each item resolves against the ingredient
 *             table as it lands, and "no" takes the last one back off
 *   unknown   anything the table has never heard of is filled in once and saved,
 *             so next time it simply matches
 *   name      call it something — that is the label on the bar
 *
 * Grams are always editable on the row: dictation gets "two eggs" right only if the
 * egg knows what a piece weighs, and the fix should be one tap away, not a re-take.
 */

type Mode = 'voice' | 'type';
type Stage = 'collect' | 'unknown' | 'name';

interface Draft {
  key: string;
  spoken: string;
  name: string;
  amount: number | null;
  unit: string | null;
  ingredient: Ingredient | null;
  grams: number | null;
  /** an unknown item you chose not to fill in — kept on the meal, counted as nothing */
  skipped?: boolean;
}

const LANG_KEY = 'served.tracker.lang';

let seq = 0;
const nextKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

function toDraft(s: SpokenItem, ingredients: Ingredient[]): Draft {
  const ingredient = findIngredient(s.name, ingredients)?.ingredient ?? null;
  return {
    key: nextKey(),
    spoken: s.spoken,
    name: s.name,
    amount: s.amount,
    unit: s.unit,
    ingredient,
    grams: gramsFor(s.amount, s.unit, ingredient),
  };
}

function itemOf(d: Draft): FoodLogItem {
  const g = d.grams;
  const per = (v: number | null | undefined) => (g != null && v != null ? round1((g / 100) * v) : null);
  return {
    name: d.ingredient?.name ?? d.name,
    ingredient_id: d.ingredient?.id ?? null,
    amount: d.amount,
    unit: d.unit,
    grams: g,
    kcal: per(d.ingredient?.kcal_100g),
    protein: per(d.ingredient?.protein_100g),
    carbs: per(d.ingredient?.carbs_100g),
    fat: per(d.ingredient?.fat_100g),
  };
}

export function FoodComposer({
  open,
  mode,
  slot,
  day,
  onClose,
}: {
  open: boolean;
  mode: Mode;
  slot: MealSlot;
  day: string;
  onClose: () => void;
}) {
  const { ingredients, saveIngredient, saveFoodLog } = useData();
  const [stage, setStage] = useState<Stage>('collect');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [label, setLabel] = useState('');
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<SpeechLang>('en-US');

  // the ingredient list changes when one is created mid-flow; reads go through a ref
  // so a dictation callback never resolves against a stale copy
  const ingredientsRef = useRef(ingredients);
  ingredientsRef.current = ingredients;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === 'de-DE' || saved === 'en-US') setLang(saved);
    } catch {
      /* default */
    }
  }, []);

  const chooseLang = (l: SpeechLang) => {
    setLang(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* fine */
    }
  };

  // a fresh flow every time the sheet opens
  useEffect(() => {
    if (!open) return;
    setStage('collect');
    setDrafts([]);
    setLabel('');
    setTyped('');
    setSaving(false);
  }, [open, mode, slot]);

  const unknown = useMemo(() => drafts.filter((d) => !d.ingredient && !d.skipped), [drafts]);

  const advance = useCallback((list: Draft[]) => {
    if (!list.length) return;
    if (list.some((d) => !d.ingredient && !d.skipped)) setStage('unknown');
    else setStage('name');
  }, []);

  const finishRef = useRef<() => void>(() => {});

  const take = useCallback(
    (text: string) => {
      const parsed = parseUtterance(text);
      let finish = false;
      setDrafts((prev) => {
        let next = prev;
        for (const p of parsed) {
          if (p === 'undo') next = next.slice(0, -1);
          else if (p === 'done') finish = true;
          else next = [...next, toDraft(p, ingredientsRef.current)];
        }
        return next;
      });
      if (finish) finishRef.current();
    },
    [],
  );

  const dictation = useDictation({ lang, onFinal: take });

  const finish = () => {
    dictation.stop();
    setDrafts((list) => {
      // advance outside the updater — it sets other state
      queueMicrotask(() => advance(list));
      return list;
    });
  };
  finishRef.current = finish;

  const close = () => {
    dictation.stop();
    onClose();
  };

  // `type` mode is one line: what you type replaces what was there
  const submitTyped = () => {
    const text = typed.trim();
    if (!text) return;
    if (mode === 'type') {
      // Enter on a single line is "that's it" — straight on to naming it
      const first = parseUtterance(text).find((p): p is SpokenItem => typeof p !== 'string');
      const list = first ? [toDraft(first, ingredientsRef.current)] : [];
      setDrafts(list);
      advance(list);
    } else {
      take(text);
      setTyped('');
    }
  };

  // live preview while typing a single item
  useEffect(() => {
    if (mode !== 'type' || stage !== 'collect') return;
    const t = window.setTimeout(() => {
      const first = parseUtterance(typed).find((p): p is SpokenItem => typeof p !== 'string');
      setDrafts(first ? [toDraft(first, ingredientsRef.current)] : []);
    }, 220);
    return () => window.clearTimeout(t);
  }, [typed, mode, stage]);

  const setGrams = (key: string, grams: number | null) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, grams } : d)));
  const remove = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const items = drafts.map(itemOf);
  const totals = items.reduce(
    (t, i) => ({
      kcal: t.kcal + (i.kcal ?? 0),
      protein: t.protein + (i.protein ?? 0),
      carbs: t.carbs + (i.carbs ?? 0),
      fat: t.fat + (i.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  // only rows that could be counted if they had a weight
  const missingGrams = drafts.filter((d) => d.grams == null && d.ingredient).length;

  const save = async () => {
    if (!drafts.length || saving) return;
    setSaving(true);
    try {
      const fallback = mode === 'type' ? (drafts[0].ingredient?.name ?? drafts[0].name) : MEAL_SLOT_LABEL[slot];
      await saveFoodLog({
        day,
        kind: 'food',
        slot,
        label: label.trim() || fallback,
        kcal: Math.round(totals.kcal),
        protein: round1(totals.protein),
        carbs: round1(totals.carbs),
        fat: round1(totals.fat),
        source: mode === 'voice' ? 'transcript' : 'log',
        recipe_id: null,
        servings: null,
        items,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = `${MEAL_SLOT_LABEL[slot]} · ${mode === 'voice' ? 'Transcript' : 'Log'}`;
  const current = unknown[0] ?? null;

  return (
    <Sheet open={open} title={title} onClose={close}>
      <div style={{ display: 'grid', gap: 14, paddingBottom: 4 }}>
        <SlotStrip slot={slot} />

        {stage === 'collect' && (
          <>
            {mode === 'voice' ? (
              <VoicePanel
                lang={lang}
                onLang={chooseLang}
                supported={dictation.supported}
                listening={dictation.listening}
                interim={dictation.interim}
                error={dictation.error}
                onToggle={dictation.listening ? dictation.stop : dictation.start}
              />
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
              className="surface hairline"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 'var(--r-pill)' }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={mode === 'type' ? 'e.g. Skyr 250 g' : 'Or type an item — tofu 200 g'}
                aria-label="Food item"
                autoFocus={mode === 'type'}
                enterKeyHint={mode === 'type' ? 'done' : 'enter'}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 300 }}
              />
              {mode === 'voice' && (
                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="t-micro"
                  style={{ padding: '8px 13px', borderRadius: 'var(--r-pill)', background: 'var(--ink-08)', opacity: typed.trim() ? 1 : 0.4 }}
                >
                  Add
                </button>
              )}
            </form>

            <ItemList drafts={drafts} onGrams={setGrams} onRemove={remove} />

            {drafts.length > 0 && <Totals {...totals} missing={missingGrams} />}

            <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, paddingTop: 4, background: 'var(--fog)' }}>
              {mode === 'voice' && (
                <button
                  type="button"
                  onClick={() => setDrafts((prev) => prev.slice(0, -1))}
                  disabled={!drafts.length}
                  className="surface hairline"
                  style={{ padding: '13px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, color: 'var(--ink-45)', opacity: drafts.length ? 1 : 0.5 }}
                >
                  No — drop last
                </button>
              )}
              <PrimaryButton disabled={!drafts.length} onClick={finish}>
                {unknown.length ? `Next · ${unknown.length} new` : 'Next'}
              </PrimaryButton>
            </div>
          </>
        )}

        {stage === 'unknown' && current && (
          <div>
            <p className="t-body" style={{ margin: '0 0 4px' }}>
              <span className="t-dim">Not in the database yet:</span> {current.name}
            </p>
            <p className="t-micro t-dim-2" style={{ margin: '0 0 14px' }}>
              Fill it in once and it is saved for next time. {unknown.length > 1 ? `${unknown.length - 1} more after this.` : ''}
            </p>
            <NewIngredientForm
              key={current.key}
              initialName={capitalise(current.name)}
              onCreate={async (i) => {
                const saved = await saveIngredient(i);
                const next = drafts.map((d) =>
                  d.key === current.key ? { ...d, ingredient: saved, grams: d.grams ?? gramsFor(d.amount, d.unit, saved) } : d,
                );
                setDrafts(next);
                if (!next.some((d) => !d.ingredient && !d.skipped)) setStage('name');
              }}
              onSkip={() => {
                const next = drafts.map((d) => (d.key === current.key ? { ...d, skipped: true } : d));
                setDrafts(next);
                if (!next.some((d) => !d.ingredient && !d.skipped)) setStage('name');
              }}
            />
          </div>
        )}

        {stage === 'name' && (
          <>
            <label style={{ display: 'block' }}>
              <span className="t-micro t-dim" style={{ display: 'block', marginBottom: 6 }}>
                What was it?
              </span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={mode === 'type' ? (drafts[0]?.ingredient?.name ?? 'Name') : 'e.g. Tofu stir-fry'}
                aria-label="Meal name"
                autoFocus
                className="surface hairline"
                style={{ width: '100%', padding: '13px 16px', borderRadius: 'var(--r-md)', border: 'none', outline: 'none', fontSize: 18, fontWeight: 300 }}
              />
            </label>

            <ItemList drafts={drafts} onGrams={setGrams} onRemove={remove} />
            <Totals {...totals} missing={missingGrams} />

            <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, paddingTop: 4, background: 'var(--fog)' }}>
              <button
                type="button"
                onClick={() => setStage('collect')}
                className="surface hairline"
                style={{ padding: '13px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, color: 'var(--ink-45)' }}
              >
                ← Add more
              </button>
              <PrimaryButton disabled={!drafts.length || saving} onClick={save}>
                {saving ? 'Saving…' : `Log ${Math.round(totals.kcal)} kcal`}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------------- pieces */

function capitalise(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function SlotStrip({ slot }: { slot: MealSlot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: SLOT_COLOR[slot], boxShadow: 'inset 0 0 0 1px var(--ink-08)' }} />
      <span className="t-micro t-dim">{MEAL_SLOT_LABEL[slot]}</span>
    </div>
  );
}

function VoicePanel({
  lang,
  onLang,
  supported,
  listening,
  interim,
  error,
  onToggle,
}: {
  lang: SpeechLang;
  onLang: (l: SpeechLang) => void;
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  onToggle: () => void;
}) {
  return (
    <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <motion.button
          type="button"
          onClick={onToggle}
          disabled={!supported}
          whileTap={{ scale: 0.94 }}
          transition={spring.dial}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Start listening'}
          style={{
            position: 'relative',
            flex: '0 0 auto',
            width: 68,
            height: 68,
            borderRadius: '50%',
            overflow: 'hidden',
            isolation: 'isolate',
            background: listening ? undefined : 'var(--ink)',
            color: '#fff',
            opacity: supported ? 1 : 0.35,
            boxShadow: listening ? 'var(--lift-3)' : 'var(--lift-2)',
          }}
        >
          {listening && <GradientField tone="engage" blur={18} />}
          {listening && (
            <span aria-hidden style={{ position: 'absolute', inset: -12, zIndex: 1, opacity: 0.55, display: 'grid', placeItems: 'center' }}>
              <Ripple size={92} rings={3} ink="lume" />
            </span>
          )}
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden style={{ position: 'relative', zIndex: 2 }}>
            {listening ? (
              <rect x="6.5" y="6.5" width="9" height="9" rx="2" fill="currentColor" />
            ) : (
              <>
                <rect x="8" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 11a6 6 0 0 0 12 0M11 17v2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </>
            )}
          </svg>
        </motion.button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-sub">{!supported ? 'Dictation unavailable' : listening ? 'Listening…' : 'Tap to talk'}</div>
          <div className="t-micro t-dim" style={{ marginTop: 2 }}>
            {!supported ? 'This browser has no speech recognition — type below.' : 'Say each item with its amount.'}
          </div>
        </div>

        <div style={{ display: 'flex', borderRadius: 'var(--r-pill)', background: 'var(--ink-04)', padding: 3, flex: '0 0 auto' }}>
          {(['en-US', 'de-DE'] as SpeechLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLang(l)}
              aria-pressed={lang === l}
              style={{
                padding: '5px 9px',
                borderRadius: 'var(--r-pill)',
                fontSize: 11.5,
                background: lang === l ? 'var(--paper)' : 'transparent',
                color: lang === l ? 'var(--ink)' : 'var(--ink-45)',
                boxShadow: lang === l ? 'var(--lift-1)' : 'none',
              }}
            >
              {l === 'en-US' ? 'EN' : 'DE'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {interim && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="t-body t-dim"
            style={{ margin: 0, fontStyle: 'italic' }}
          >
            {interim}
          </motion.p>
        )}
      </AnimatePresence>

      {error && (
        <p className="t-micro" style={{ margin: 0, color: 'var(--coral)' }}>
          {error}
        </p>
      )}

      <p className="t-micro t-dim-2" style={{ margin: 0, fontSize: 11 }}>
        {lang === 'de-DE'
          ? '„Tofu 200 Gramm, Olivenöl ein halber Teelöffel“ · „nein“ nimmt das letzte zurück'
          : '"tofu 200 grams, olive oil half a teaspoon" · say "no" to drop the last one'}
      </p>
    </div>
  );
}

function ItemList({
  drafts,
  onGrams,
  onRemove,
}: {
  drafts: Draft[];
  onGrams: (key: string, grams: number | null) => void;
  onRemove: (key: string) => void;
}) {
  if (!drafts.length) return null;
  return (
    <ul className="surface hairline" style={{ listStyle: 'none', margin: 0, padding: '2px 0', borderRadius: 'var(--r-lg)' }}>
      <AnimatePresence initial={false}>
        {drafts.map((d, i) => {
          const item = itemOf(d);
          return (
            <motion.li
              key={d.key}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, transition: { duration: 0.18, ease: ease.depart } }}
              transition={spring.settle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 12px 11px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--ink-04)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.ingredient?.name ?? capitalise(d.name)}
                  {!d.ingredient && (
                    <span
                      className="t-label"
                      style={{ marginLeft: 8, fontSize: 8.5, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: 'rgba(255,131,96,0.16)', color: '#c4472f' }}
                    >
                      New
                    </span>
                  )}
                </div>
                <div className="t-micro t-dim-2" style={{ marginTop: 2, fontSize: 11 }}>
                  {d.amount != null ? formatAmount(d.amount, d.unit) : 'no amount'}
                  {d.ingredient && d.ingredient.name.toLowerCase() !== d.name.toLowerCase() ? ` · heard “${d.name}”` : ''}
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'baseline', gap: 3, flex: '0 0 auto' }}>
                <input
                  value={d.grams == null ? '' : String(Math.round(d.grams))}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.').trim();
                    onGrams(d.key, v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : d.grams);
                  }}
                  inputMode="decimal"
                  placeholder="?"
                  aria-label={`Grams of ${d.name}`}
                  style={{
                    width: 52,
                    textAlign: 'right',
                    padding: '6px 6px',
                    borderRadius: 'var(--r-xs)',
                    border: 'none',
                    outline: 'none',
                    background: d.grams == null && d.ingredient ? 'rgba(255,131,96,0.14)' : 'var(--ink-04)',
                    fontSize: 16,
                    fontWeight: 300,
                  }}
                />
                <span className="t-micro t-dim-2">g</span>
              </label>

              <span className="t-micro t-dim" style={{ width: 52, textAlign: 'right', flex: '0 0 auto' }}>
                {item.kcal != null ? `${Math.round(item.kcal)} kcal` : '—'}
              </span>

              <button type="button" onClick={() => onRemove(d.key)} aria-label={`Remove ${d.name}`} style={{ padding: 4, color: 'var(--ink-30)', flex: '0 0 auto' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

function Totals({ kcal, protein, carbs, fat, missing }: { kcal: number; protein: number; carbs: number; fat: number; missing: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '0 4px' }}>
      <span style={{ fontSize: 22, fontWeight: 200, letterSpacing: '-0.03em' }}>
        {Math.round(kcal)} <span className="t-micro t-dim">kcal</span>
      </span>
      <span className="t-micro t-dim">
        P {Math.round(protein)} · C {Math.round(carbs)} · F {Math.round(fat)}
      </span>
      <span style={{ flex: 1 }} />
      {missing > 0 && (
        <span className="t-micro" style={{ color: '#c4472f', fontSize: 11 }}>
          {missing} without grams
        </span>
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '13px 20px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--ink)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 300,
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {children}
    </button>
  );
}
