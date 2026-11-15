'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import type { FoodLogEntry, Ingredient, MealSlot } from '@/lib/db/types';
import { MEAL_SLOTS, MEAL_SLOT_LABEL } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import { CalorieBar } from '@/components/tracker/CalorieBar';
import { RadialMenu, type RadialOption } from '@/components/tracker/RadialMenu';
import { FoodComposer } from '@/components/tracker/FoodComposer';
import { EntrySheet, GoalsSheet, QuickIngredientSheet, RecipeLogSheet } from '@/components/tracker/TrackerSheets';
import { Toast } from '@/components/explore/Toast';
import { GradientField, type Tone } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import {
  ACTIVITY_PRESETS,
  DEFAULT_GOALS,
  SLOT_TONE,
  bandsFor,
  dayKey,
  dayTitle,
  loadGoals,
  saveGoals,
  shiftDay,
  totalsFor,
  type Goals,
} from '@/lib/tracker/model';
import { QUICKLINKS, planQuick, quickCaption, type QuickItem, type Quicklink } from '@/lib/tracker/quick';
import { ease, spring } from '@/lib/motion';

/**
 * The tracker, built as a second instrument face beside Explore.
 *
 *   ┌──────────┐ ┌──────────────┐
 *   │ ◖      ◗ │ │  left today  │   rose, like "matching now"
 *   │ ◖      ◗ │ │    1 240     │
 *   │ ◖ dinner◗ │ └──────────────┘
 *   │ ◖      (+)   3 logged          the add button, notched halfway into the bar
 *   │ ◖ lunch ◗ │ ┌──────────────┐
 *   │ ◖      ◗ │ │ protein  · · │   each macro lights like an engaged filter
 *   │ ◖ bkfst ◗ │ │ carbs    · · │
 *   │ ◖      ◗ │ │ fat      · · │
 *   └──────────┘ └──────────────┘
 */

type Ring = null | 'root' | 'quick' | 'slots' | 'activity';
type Action = 'transcript' | 'log' | 'recipe';

const BAR_SHARE = 50; // % of the row the labels and bar take together
const BUTTON = 64;

const ROOT: RadialOption[] = [
  { key: 'quick', label: 'Quick', tone: 'course', icon: <Icon d="M10 2.5 4.5 10h4l-1 5.5L13.5 8h-4l.5-5.5Z" /> },
  { key: 'transcript', label: 'Transcript', tone: 'hero', icon: <Icon d="M9 3.5a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 9 3.5ZM4.5 9.5a4.5 4.5 0 0 0 9 0M9 14v2" /> },
  { key: 'log', label: 'Log', tone: 'calories', icon: <Icon d="M3.5 13.5 4 11l7.5-7.5 2 2L6 13l-2.5.5ZM10 5l2 2" /> },
  { key: 'recipe', label: 'Recipe', tone: 'health', icon: <Icon d="M4 3.5h8.5v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM6 6.5h4.5M6 9h3" /> },
  { key: 'activity', label: 'Activity', tone: 'volume', icon: <Icon d="M2.5 9.5h3l2-4.5 3 8 2-3.5h3" /> },
];

const SLOT_OPTIONS: RadialOption[] = MEAL_SLOTS.map((s) => ({ key: s, label: MEAL_SLOT_LABEL[s], tone: SLOT_TONE[s] }));

const ACTIVITY_TONE: Record<string, Tone> = {
  gym: 'protein',
  intense: 'engage',
  cardio: 'health',
  steps: 'plateGreen',
  extra50: 'course',
  extra100: 'time',
};

const ACTIVITY_OPTIONS: RadialOption[] = ACTIVITY_PRESETS.map((a) => ({
  key: a.key,
  label: a.short,
  big: `+${a.kcal}`,
  tone: ACTIVITY_TONE[a.key] ?? 'protein',
}));

export default function TrackerPage() {
  const router = useRouter();
  const { foodLog, saveFoodLog, deleteFoodLog, ready, ingredients, allRecipes, analysisFor } = useData();
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
  const [quickSetup, setQuickSetup] = useState<{ q: Quicklink; item: QuickItem } | null>(null);
  const [toast, setToast] = useState<{ message: string; actionLabel?: string; action?: () => void } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const addRef = useRef<HTMLButtonElement | null>(null);

  const entries = useMemo(() => foodLog.filter((e) => e.day === day), [foodLog, day]);
  const totals = useMemo(() => totalsFor(entries, goals), [entries, goals]);
  const bands = useMemo(() => bandsFor(totals, goals), [totals, goals]);
  const { title, sub } = dayTitle(day);
  const isToday = day === dayKey();

  /* ---- quicklinks: one tap, or one question first if something is missing ---- */

  const perServing = useMemo(() => (r: Parameters<typeof analysisFor>[0]) => analysisFor(r).nutrition.perServing, [analysisFor]);
  const quick = useMemo(
    () => QUICKLINKS.map((q) => ({ q, plan: planQuick(q, ingredients, allRecipes, perServing) })),
    [ingredients, allRecipes, perServing],
  );
  const quickOptions: RadialOption[] = quick.map(({ q, plan }) => ({
    key: q.key,
    label: q.label,
    sub: quickCaption(q, plan),
    tone: SLOT_TONE[q.slot],
  }));

  const say = (message: string, actionLabel?: string, action?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, actionLabel, action });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };
  useEffect(() => () => void (toastTimer.current && window.clearTimeout(toastTimer.current)), []);

  const logQuick = async (q: Quicklink, extra: Ingredient[] = []) => {
    const plan = planQuick(q, [...ingredients, ...extra], allRecipes, perServing);
    if (!plan.ok) {
      if (plan.missing === 'ingredient') setQuickSetup({ q, item: plan.item });
      else
        say(`${plan.title} isn't in your recipes yet`, 'Add it', () => {
          setToast(null);
          router.push('/add');
        });
      return;
    }
    const saved = await saveFoodLog({ ...plan.entry, day });
    say(`${q.label} · ${saved.kcal} kcal`, 'Undo', () => {
      setToast(null);
      void deleteFoodLog(saved.id);
    });
  };

  const openRing = () => {
    setAnchor(addRef.current?.getBoundingClientRect() ?? null);
    setRing('root');
  };
  const closeRing = () => {
    setRing(null);
    setAnchor(null);
  };

  const pick = async (key: string) => {
    if (ring === 'root') {
      if (key === 'quick') setRing('quick');
      else if (key === 'activity') setRing('activity');
      else {
        setAction(key as Action);
        setRing('slots');
      }
      return;
    }
    if (ring === 'quick') {
      const q = QUICKLINKS.find((x) => x.key === key);
      closeRing();
      if (q) await logQuick(q);
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

  const options =
    ring === 'activity' ? ACTIVITY_OPTIONS : ring === 'slots' ? SLOT_OPTIONS : ring === 'quick' ? quickOptions : ROOT;

  return (
    <main
      style={{
        position: 'relative',
        zIndex: 1,
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        padding: 'calc(var(--safe-t) + 16px) var(--shell-pad) calc(var(--tabbar-h) + var(--safe-b) + 8px)',
        overflow: 'hidden',
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ease.arrive }}
        style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <h1 className="t-sub" style={{ margin: 0, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title} <span className="t-dim-2">· {sub}</span>
        </h1>
        <RoundButton label="Previous day" onClick={() => setDay((d) => shiftDay(d, -1))}>
          <path d="M10 4 6 8l4 4" />
        </RoundButton>
        <RoundButton label="Next day" onClick={() => setDay((d) => shiftDay(d, 1))} disabled={isToday}>
          <path d="m6 4 4 4-4 4" />
        </RoundButton>
      </motion.header>

      <section
        style={{
          position: 'relative',
          flex: '1 1 0',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `${BAR_SHARE}% 1fr`,
          gap: 9,
        }}
      >
        <div style={{ minHeight: 0, opacity: ready ? 1 : 0.5, transition: 'opacity 300ms ease' }}>
          <CalorieBar key={day} layout={bands} onSelect={setSelected} />
        </div>

        {/* the readouts step aside while the menu is open — the ring opens over
            exactly this column */}
        <motion.div
          initial={false}
          animate={{ opacity: ring ? 0 : 1 }}
          transition={{ duration: 0.22, ease: ease.glass }}
          style={{ minHeight: 0, display: 'grid', gridTemplateRows: '1fr 74px 1fr', gap: 0, pointerEvents: ring ? 'none' : undefined }}
        >
          <LeftPanel left={totals.left} eaten={totals.eaten} budget={totals.budget} earned={totals.earned} onGoals={() => setGoalsOpen(true)} />

          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: BUTTON / 2 - 2 }}>
            <span className="t-micro t-dim-2">
              {entries.length === 0 ? 'Log the first thing' : `${totals.food.length} logged${totals.activities.length ? ` · ${totals.activities.length} active` : ''}`}
            </span>
          </div>

          <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: '1fr 1fr 1fr', gap: 9 }}>
            <MacroPanel label="Protein" value={totals.protein} goal={goals.protein} tone="protein" />
            <MacroPanel label="Carbs" value={totals.carbs} goal={goals.carbs} tone="calories" />
            <MacroPanel label="Fat" value={totals.fat} goal={goals.fat} tone="time" />
          </div>
        </motion.div>

        {/* The add button, notched halfway into the bar's right edge. The fog ring
            around it cuts it out of the bar and the panels alike, so it reads as set
            into the instrument rather than floating over it. */}
        <motion.button
          ref={addRef}
          type="button"
          onClick={openRing}
          aria-label="Add to the day"
          whileTap={{ scale: 0.93 }}
          transition={spring.dial}
          className="grain hairline-lume"
          style={{
            position: 'absolute',
            left: `calc(${BAR_SHARE}% - ${BUTTON / 2}px)`,
            top: `calc(50% - ${BUTTON / 2}px)`,
            width: BUTTON,
            height: BUTTON,
            borderRadius: '50%',
            overflow: 'hidden',
            isolation: 'isolate',
            boxShadow: '0 0 0 6px var(--fog), var(--lift-3)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            opacity: ring ? 0 : 1,
            zIndex: 6,
          }}
        >
          <GradientField tone="engage" blur={18} />
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden style={{ position: 'relative', zIndex: 2 }}>
            <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </motion.button>
      </section>

      <RadialMenu
        anchor={ring ? anchor : null}
        level={ring ?? 'none'}
        options={options}
        canGoBack={ring === 'slots' || ring === 'activity' || ring === 'quick'}
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
      <QuickIngredientSheet
        item={quickSetup?.item ?? null}
        quickLabel={quickSetup?.q.label ?? ''}
        onClose={() => setQuickSetup(null)}
        onCreated={(ingredient) => {
          const q = quickSetup?.q;
          setQuickSetup(null);
          if (q) void logQuick(q, [ingredient]);
        }}
      />
      <Toast message={toast?.message ?? null} actionLabel={toast?.actionLabel} onAction={toast?.action} />
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

/* ---------------------------------------------------------------------- panels */

/** How much is left — rose, with the same slow rings as "matching now". */
function LeftPanel({
  left,
  eaten,
  budget,
  earned,
  onGoals,
}: {
  left: number;
  eaten: number;
  budget: number;
  earned: number;
  onGoals: () => void;
}) {
  const over = left < 0;
  const value = Math.abs(Math.round(left));
  const digits = String(value).length;
  return (
    <Squircle
      as="section"
      radius={30}
      stroke="lume"
      className="grain"
      style={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 14px 12px',
        boxShadow: 'var(--lift-2)',
        overflow: 'hidden',
      }}
    >
      <GradientField tone={over ? 'heroThin' : 'hero'} blur={30} />

      <svg
        aria-hidden
        viewBox="0 0 200 200"
        style={{ position: 'absolute', left: '50%', top: '54%', width: 170, height: 170, transform: 'translate(-50%, -50%)', zIndex: 1, opacity: 0.45 }}
      >
        {[46, 68, 90].map((r, i) => (
          <motion.circle
            key={r}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 58 + i * 16, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '100px 100px' }}
            cx={100}
            cy={100}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={0.7}
            strokeDasharray={i === 1 ? '1.5 6' : '1 7'}
          />
        ))}
      </svg>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="t-micro" style={{ color: 'var(--lume-70)', flex: 1 }}>
          {over ? 'Over today' : 'Left today'}
        </span>
        <button
          type="button"
          onClick={onGoals}
          className="t-micro hairline-lume"
          style={{
            position: 'relative',
            padding: '4px 10px',
            borderRadius: 'var(--r-pill)',
            background: 'rgba(255,255,255,0.16)',
            color: '#fff',
            fontSize: 11,
          }}
        >
          Goals
        </button>
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <DottedNumber value={value} size={digits >= 4 ? 44 : 52} color="#fff" weight={0.62} glow animate={false} />
        <span className="t-micro" style={{ color: 'var(--lume-70)', fontSize: 11 }}>
          kcal
        </span>
      </div>

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
        <p className="t-micro" style={{ margin: 0, color: 'var(--lume-70)', fontSize: 11 }}>
          {Math.round(eaten)} of {budget}
          {earned > 0 ? ` · +${earned} active` : ''}
        </p>
        <BudgetDots eaten={eaten} budget={budget} />
      </div>
    </Squircle>
  );
}

/** The budget as a strip of dots, like the recipe dots under "matching now". */
function BudgetDots({ eaten, budget }: { eaten: number; budget: number }) {
  const N = 20;
  const lit = budget > 0 ? Math.min(N, Math.round((eaten / budget) * N)) : 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, height: 6, marginTop: 7 }} aria-hidden>
      {Array.from({ length: N }, (_, i) => (
        <motion.span
          key={i}
          initial={false}
          animate={{ width: i < lit ? 3.5 : 2.5, height: i < lit ? 3.5 : 2.5, opacity: i < lit ? 1 : 0.34 }}
          transition={spring.dial}
          style={{ display: 'block', borderRadius: 4, background: '#fff' }}
        />
      ))}
    </div>
  );
}

/**
 * A macro against its goal. Idle (nothing eaten yet) it is a white card like an
 * unengaged filter; the colour field comes up under the glass once it counts.
 */
function MacroPanel({ label, value, goal, tone }: { label: string; value: number; goal: number; tone: Tone }) {
  const active = value > 0;
  const N = 14;
  const share = goal > 0 ? value / goal : 0;
  const lit = Math.min(N, share * N);
  return (
    <Squircle
      radius={24}
      stroke={active ? 'lume' : 'ink'}
      className={active ? 'grain' : undefined}
      style={{
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 13px 11px',
        background: active ? undefined : 'var(--paper)',
        boxShadow: active ? 'var(--lift-2)' : 'var(--lift-1)',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.42, ease: ease.glass }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <GradientField tone={tone} blur={24} />
      </motion.div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="t-micro" style={{ color: active ? 'var(--lume-70)' : 'var(--ink-45)', flex: 1 }}>
          {label}
        </span>
        <DottedNumber value={Math.round(value)} size={24} color={active ? '#fff' : 'var(--ink)'} weight={0.58} glow={active} animate={false} />
        <span className="t-micro" style={{ color: active ? 'var(--lume-70)' : 'var(--ink-30)', fontSize: 10.5 }}>
          / {goal}g
        </span>
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 8 }} aria-hidden>
        {Array.from({ length: N }, (_, i) => {
          const on = i < Math.floor(lit) || (i < lit && lit - i >= 0.5);
          return (
            <motion.span
              key={i}
              initial={false}
              animate={{ scale: on ? 1.25 : 1, opacity: on ? 1 : active ? 0.38 : 1 }}
              transition={{ ...spring.dial, delay: i * 0.015 }}
              style={{
                display: 'block',
                width: 4,
                height: 4,
                borderRadius: 4,
                background: active ? '#fff' : 'var(--ink-14)',
              }}
            />
          );
        })}
      </div>
    </Squircle>
  );
}

/* ---------------------------------------------------------------------- pieces */

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden>
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
      style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </g>
      </svg>
    </button>
  );
}
