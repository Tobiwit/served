'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { FoodLogEntry, MealSlot } from '@/lib/db/types';
import { MEAL_SLOTS, MEAL_SLOT_LABEL } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import { CalorieBar } from '@/components/tracker/CalorieBar';
import { RadialMenu, type RadialOption } from '@/components/tracker/RadialMenu';
import { FoodComposer } from '@/components/tracker/FoodComposer';
import { EntrySheet, GoalsSheet, RecipeLogSheet } from '@/components/tracker/TrackerSheets';
import { GradientField } from '@/components/glass/GradientField';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import {
  ACTIVITY_PRESETS,
  DEFAULT_GOALS,
  SLOT_COLOR,
  bandsFor,
  dayKey,
  dayTitle,
  loadGoals,
  saveGoals,
  shiftDay,
  totalsFor,
  type Goals,
} from '@/lib/tracker/model';
import { ease, spring } from '@/lib/motion';

/**
 * The tracker.
 *
 *   ┌──────────┬──────────────────────┐
 *   │ ▢ ▢ ▢ ▢  │  1 240   kcal left   │
 *   │ ▢ ▢ ▢ ▢  │                      │
 *   │ ▣ dinner (+)  add               │
 *   │ ▣ ▣ ▣ ▣  │                      │
 *   │ ▣ lunch  │  protein  ▪▪▪▪▪▫▫▫   │
 *   │ ▣ ▣ ▣ ▣  │  carbs    ▪▪▪▫▫▫▫▫   │
 *   │ ▣ bkfst  │  fat      ▪▪▪▪▫▫▫▫   │
 *   └──────────┴──────────────────────┘
 *
 * The whole left side is the day in 50 kcal cells. The right side answers the one
 * question that matters at a glance — how much is left — and keeps the macros
 * underneath it. The add button sits against the bar, halfway up, and everything
 * you can log fans out from it.
 */

type Ring = null | 'root' | 'slots' | 'activity';
type Action = 'transcript' | 'log' | 'recipe';

const ROOT: RadialOption[] = [
  { key: 'transcript', label: 'Transcript', icon: <Icon d="M9 3.5a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 9 3.5ZM4.5 9.5a4.5 4.5 0 0 0 9 0M9 14v2" /> },
  { key: 'log', label: 'Log', icon: <Icon d="M3.5 13.5 4 11l7.5-7.5 2 2L6 13l-2.5.5ZM10 5l2 2" /> },
  { key: 'recipe', label: 'Recipe', icon: <Icon d="M4 3.5h8.5v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM6 6.5h4.5M6 9h3" /> },
  { key: 'activity', label: 'Activity', icon: <Icon d="M2.5 9.5h3l2-4.5 3 8 2-3.5h3" /> },
];

const SLOT_OPTIONS: RadialOption[] = MEAL_SLOTS.map((s) => ({ key: s, label: MEAL_SLOT_LABEL[s], color: SLOT_COLOR[s] }));

const ACTIVITY_OPTIONS: RadialOption[] = ACTIVITY_PRESETS.map((a) => ({
  key: a.key,
  label: a.short,
  big: `+${a.kcal}`,
  color: 'rgba(191,231,200,0.95)',
}));

export default function TrackerPage() {
  const { foodLog, saveFoodLog, ready } = useData();
  const [day, setDay] = useState(dayKey);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  useEffect(() => setGoals(loadGoals()), []);

  const [ring, setRing] = useState<Ring>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [action, setAction] = useState<Action>('transcript');
  const [composer, setComposer] = useState<{ mode: 'voice' | 'type'; slot: MealSlot } | null>(null);
  const [recipeSlot, setRecipeSlot] = useState<MealSlot | null>(null);
  const [selected, setSelected] = useState<FoodLogEntry | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement | null>(null);

  const entries = useMemo(() => foodLog.filter((e) => e.day === day), [foodLog, day]);
  const totals = useMemo(() => totalsFor(entries, goals), [entries, goals]);
  const bands = useMemo(() => bandsFor(totals, goals), [totals, goals]);
  const { title, sub } = dayTitle(day);
  const isToday = day === dayKey();

  const openRing = () => {
    const rect = addRef.current?.getBoundingClientRect() ?? null;
    setAnchor(rect);
    setRing('root');
  };
  const closeRing = () => {
    setRing(null);
    setAnchor(null);
  };

  const pick = async (key: string) => {
    if (ring === 'root') {
      if (key === 'activity') setRing('activity');
      else {
        setAction(key as Action);
        setRing('slots');
      }
      return;
    }
    if (ring === 'slots') {
      const slot = key as MealSlot;
      closeRing();
      if (action === 'recipe') setRecipeSlot(slot);
      else setComposer({ mode: action === 'transcript' ? 'voice' : 'type', slot });
      return;
    }
    if (ring === 'activity') {
      const preset = ACTIVITY_PRESETS.find((a) => a.key === key);
      closeRing();
      if (!preset) return;
      await saveFoodLog({
        day,
        kind: 'activity',
        slot: null,
        label: preset.label,
        kcal: preset.kcal,
        protein: null,
        carbs: null,
        fat: null,
        source: 'activity',
        recipe_id: null,
        servings: null,
        items: [],
      });
    }
  };

  const options = ring === 'activity' ? ACTIVITY_OPTIONS : ring === 'slots' ? SLOT_OPTIONS : ROOT;
  const over = totals.left < 0;

  return (
    <main
      style={{
        position: 'relative',
        zIndex: 1,
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 'calc(var(--safe-t) + 18px) var(--shell-pad) calc(var(--tabbar-h) + var(--safe-b) + 10px)',
        overflow: 'hidden',
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ease.arrive }}
        style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 6 }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="t-display" style={{ margin: 0 }}>
            {title}
          </h1>
          <p className="t-micro t-dim" style={{ margin: '6px 0 0' }}>
            {sub}
          </p>
        </div>
        <RoundButton label="Previous day" onClick={() => setDay((d) => shiftDay(d, -1))}>
          <path d="M10 4 6 8l4 4" />
        </RoundButton>
        <RoundButton label="Next day" onClick={() => setDay((d) => shiftDay(d, 1))} disabled={isToday}>
          <path d="m6 4 4 4-4 4" />
        </RoundButton>
        <button
          type="button"
          onClick={() => setGoalsOpen(true)}
          className="surface hairline t-micro"
          style={{ height: 34, padding: '0 13px', borderRadius: 'var(--r-pill)', color: 'var(--ink-70)', marginLeft: 2 }}
        >
          Goals
        </button>
      </motion.header>

      <section style={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: '46% 1fr', gap: 12 }}>
        <div style={{ minHeight: 0, opacity: ready ? 1 : 0.5, transition: 'opacity 300ms ease' }}>
          <CalorieBar
            key={day}
            food={bands.food}
            activity={bands.activity}
            capacity={bands.capacity}
            goal={goals.kcal}
            budget={totals.budget}
            onSelect={setSelected}
          />
        </div>

        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 2 }}>
          {/* how much is left — the reading the whole screen exists for */}
          <div>
            <div className="t-label t-dim-2">{over ? 'Over today' : 'Left today'}</div>
            <div style={{ marginTop: 10, maxWidth: '100%', overflow: 'hidden' }}>
              <DottedNumber
                value={Math.abs(Math.round(totals.left))}
                size={52}
                weight={0.62}
                color={over ? 'var(--coral)' : 'var(--ink)'}
                animate={false}
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
            <div className="t-micro t-dim" style={{ marginTop: 10, lineHeight: 1.5 }}>
              kcal · {Math.round(totals.eaten)} eaten of {totals.budget}
              {totals.earned > 0 && <span style={{ color: 'var(--green-deep)' }}> · +{totals.earned} active</span>}
            </div>
          </div>

          {/* the add button, against the bar and halfway up it */}
          <div style={{ flex: 1, minHeight: 90, display: 'flex', alignItems: 'center' }}>
            <motion.button
              ref={addRef}
              type="button"
              onClick={openRing}
              aria-label="Add to the day"
              whileTap={{ scale: 0.93 }}
              transition={spring.dial}
              className="grain hairline-lume"
              style={{
                position: 'relative',
                width: 64,
                height: 64,
                marginLeft: -4,
                borderRadius: '50%',
                overflow: 'hidden',
                isolation: 'isolate',
                boxShadow: 'var(--lift-3)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                opacity: ring ? 0 : 1,
              }}
            >
              <GradientField tone="engage" blur={18} />
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden style={{ position: 'relative', zIndex: 2 }}>
                <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </motion.button>
            <span className="t-micro t-dim-2" style={{ marginLeft: 12 }}>
              {entries.length === 0 ? 'Log the first thing' : `${totals.food.length} logged`}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <Macro label="Protein" value={totals.protein} goal={goals.protein} color="#4da566" />
            <Macro label="Carbs" value={totals.carbs} goal={goals.carbs} color="#f5a951" />
            <Macro label="Fat" value={totals.fat} goal={goals.fat} color="#8ba4d8" />
          </div>
        </div>
      </section>

      <RadialMenu
        anchor={ring ? anchor : null}
        level={ring ?? 'none'}
        options={options}
        canGoBack={ring === 'slots' || ring === 'activity'}
        onPick={(k) => void pick(k)}
        onBack={() => setRing('root')}
        onClose={closeRing}
      />

      <FoodComposer
        open={composer !== null}
        mode={composer?.mode ?? 'voice'}
        slot={composer?.slot ?? 'lunch'}
        day={day}
        onClose={() => setComposer(null)}
      />
      <RecipeLogSheet open={recipeSlot !== null} slot={recipeSlot ?? 'lunch'} day={day} onClose={() => setRecipeSlot(null)} />
      <EntrySheet entry={selected} onClose={() => setSelected(null)} />
      <GoalsSheet
        open={goalsOpen}
        goals={goals}
        onSave={(g) => {
          setGoals(g);
          saveGoals(g);
        }}
        onClose={() => setGoalsOpen(false)}
      />
    </main>
  );
}

/* ---------------------------------------------------------------------- pieces */

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden style={{ marginBottom: 2 }}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="surface hairline"
      style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </g>
      </svg>
    </button>
  );
}

/** A macro against its goal, drawn in the same rounded cells as the bar. */
function Macro({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const CELLS = 12;
  const share = goal > 0 ? value / goal : 0;
  const lit = Math.min(CELLS, share * CELLS);
  const done = share >= 1;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span className="t-micro" style={{ color: 'var(--ink-70)' }}>
          {label}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 15, fontWeight: 300, letterSpacing: '-0.02em' }}>{Math.round(value)}</span>
        <span className="t-micro t-dim-2">/ {goal} g</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CELLS}, 1fr)`, gap: 2.5 }}>
        {Array.from({ length: CELLS }, (_, i) => {
          const fill = Math.max(0, Math.min(1, lit - i));
          return (
            <span
              key={i}
              style={{
                position: 'relative',
                height: 9,
                borderRadius: 3,
                overflow: 'hidden',
                background: 'var(--paper)',
                boxShadow: done ? `inset 0 0 0 1px ${color}` : 'inset 0 0 0 1px var(--ink-08)',
              }}
            >
              <motion.span
                initial={false}
                animate={{ scaleX: fill }}
                transition={{ duration: 0.5, ease: ease.arrive, delay: i * 0.02 }}
                style={{ position: 'absolute', inset: 0, background: color, transformOrigin: 'left' }}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
