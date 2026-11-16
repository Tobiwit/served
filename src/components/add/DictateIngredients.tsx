'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Ingredient } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import { Sheet } from './Sheet';
import { VoicePanel, PrimaryButton } from '@/components/tracker/FoodComposer';
import { formatAmount } from '@/lib/nutrition/units';
import { findIngredient, parseUtterance, type SpokenItem } from '@/lib/tracker/spoken';
import { useDictation, useSpeechLang } from '@/lib/tracker/useDictation';
import { ease, spring } from '@/lib/motion';

/**
 * Talking a recipe's ingredients in, before the recipe exists.
 *
 * The same listening loop as the tracker's transcript — say each item with its
 * amount, in English or German, "no" takes the last one back — but nothing is
 * weighed or saved here. Each line is matched just far enough to show what it was
 * heard as, then handed to the recipe editor, which does the real matching and asks
 * about anything it does not know, exactly as it does for pasted text.
 */

export interface DictatedLine {
  raw: string;
  name: string;
  amount: number | null;
  unit: string | null;
}

interface Line {
  key: string;
  spoken: SpokenItem;
  match: Ingredient | null;
}

let seq = 0;
const nextKey = () => `l${(seq++).toString(36)}`;

export function DictateIngredients({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (lines: DictatedLine[]) => void;
}) {
  const { ingredients } = useData();
  const [lines, setLines] = useState<Line[]>([]);
  const [typed, setTyped] = useState('');
  const [lang, chooseLang] = useSpeechLang();

  const ingredientsRef = useRef(ingredients);
  ingredientsRef.current = ingredients;

  useEffect(() => {
    if (open) {
      setLines([]);
      setTyped('');
    }
  }, [open]);

  const finishRef = useRef<() => void>(() => {});

  const take = useCallback((text: string) => {
    let finish = false;
    setLines((prev) => {
      let next = prev;
      for (const p of parseUtterance(text)) {
        if (p === 'undo') next = next.slice(0, -1);
        else if (p === 'done') finish = true;
        else next = [...next, { key: nextKey(), spoken: p, match: findIngredient(p.name, ingredientsRef.current)?.ingredient ?? null }];
      }
      return next;
    });
    if (finish) finishRef.current();
  }, []);

  const dictation = useDictation({ lang, onFinal: take });

  const finish = () => {
    dictation.stop();
    setLines((current) => {
      if (current.length) {
        // hand over outside the updater — it changes state elsewhere
        queueMicrotask(() =>
          onDone(
            current.map((l) => ({
              raw: l.spoken.spoken,
              // a line heard as something in the table goes over under that name, so the
              // editor's own matching lands on it rather than guessing again from German
              name: l.match?.name ?? capitalise(l.spoken.name),
              amount: l.spoken.amount,
              unit: l.spoken.unit,
            })),
          ),
        );
      }
      return current;
    });
  };
  finishRef.current = finish;

  const close = () => {
    dictation.stop();
    onClose();
  };

  return (
    <Sheet open={open} title="Dictate ingredients" onClose={close}>
      <div style={{ display: 'grid', gap: 14, paddingBottom: 4 }}>
        <VoicePanel
          lang={lang}
          onLang={chooseLang}
          supported={dictation.supported}
          listening={dictation.listening}
          interim={dictation.interim}
          error={dictation.error}
          onToggle={dictation.listening ? dictation.stop : dictation.start}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!typed.trim()) return;
            take(typed);
            setTyped('');
          }}
          className="surface hairline"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 'var(--r-pill)' }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Or type one — tofu 200 g"
            aria-label="Ingredient"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 300 }}
          />
          <button
            type="submit"
            disabled={!typed.trim()}
            className="t-micro"
            style={{ padding: '8px 13px', borderRadius: 'var(--r-pill)', background: 'var(--ink-08)', opacity: typed.trim() ? 1 : 0.4 }}
          >
            Add
          </button>
        </form>

        {lines.length > 0 && (
          <ul className="surface hairline" style={{ listStyle: 'none', margin: 0, padding: '2px 0', borderRadius: 'var(--r-lg)' }}>
            <AnimatePresence initial={false}>
              {lines.map((l, i) => (
                <motion.li
                  key={l.key}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16, transition: { duration: 0.18, ease: ease.depart } }}
                  transition={spring.settle}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px 11px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--ink-04)' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {l.match?.name ?? capitalise(l.spoken.name)}
                      {!l.match && (
                        <span
                          className="t-label"
                          style={{ marginLeft: 8, fontSize: 8.5, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: 'rgba(255,131,96,0.16)', color: '#c4472f' }}
                        >
                          New
                        </span>
                      )}
                    </div>
                    <div className="t-micro t-dim-2" style={{ marginTop: 2, fontSize: 11 }}>
                      {l.spoken.amount != null ? formatAmount(l.spoken.amount, l.spoken.unit) : 'no amount'}
                      {l.match && l.match.name.toLowerCase() !== l.spoken.name.toLowerCase() ? ` · heard “${l.spoken.name}”` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    aria-label={`Remove ${l.spoken.name}`}
                    style={{ padding: 4, color: 'var(--ink-30)', flex: '0 0 auto' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                      <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        <p className="t-micro t-dim-2" style={{ margin: '-4px 4px 0', fontSize: 11 }}>
          Anything marked new is asked about in the editor, where the recipe gets its title and method.
        </p>

        <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, paddingTop: 4, background: 'var(--fog)' }}>
          <button
            type="button"
            onClick={() => setLines((prev) => prev.slice(0, -1))}
            disabled={!lines.length}
            className="surface hairline"
            style={{ padding: '13px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, color: 'var(--ink-45)', opacity: lines.length ? 1 : 0.5 }}
          >
            No — drop last
          </button>
          <PrimaryButton disabled={!lines.length} onClick={finish}>
            {lines.length ? `Start recipe · ${lines.length}` : 'Start recipe'}
          </PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}

function capitalise(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
