import type { FoodLogEntry, MealSlot } from '@/lib/db/types';
import type { Tone } from '@/components/glass/GradientField';

/**
 * The tracker's vocabulary: goals, days, the colour of each part of the day, and the
 * arithmetic that turns a day's log into a bar of 50 kcal segments.
 */

/* ----------------------------------------------------------------------- goals */

export interface Goals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_GOALS: Goals = { kcal: 2200, protein: 150, carbs: 220, fat: 70 };

const GOALS_KEY = 'served.tracker.goals.v1';

/**
 * Goals are a setting on this phone, like the other prefs — they are how you want
 * to read the log, not part of it. Stored apart from `prefs` so a malformed one
 * cannot take the starter-collection toggle down with it.
 */
export function loadGoals(): Goals {
  if (typeof window === 'undefined') return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(GOALS_KEY);
    if (!raw) return DEFAULT_GOALS;
    const parsed = JSON.parse(raw) as Partial<Goals>;
    const pick = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);
    return {
      kcal: pick(parsed.kcal, DEFAULT_GOALS.kcal),
      protein: pick(parsed.protein, DEFAULT_GOALS.protein),
      carbs: pick(parsed.carbs, DEFAULT_GOALS.carbs),
      fat: pick(parsed.fat, DEFAULT_GOALS.fat),
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

export function saveGoals(goals: Goals) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  } catch {
    /* private mode — the goals simply do not stick */
  }
}

/* ------------------------------------------------------------------------ days */

/** The local calendar day — not `toISOString`, which is UTC and flips at 1 am here. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDay(key: string, by: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + by));
}

export function dayTitle(key: string): { title: string; sub: string } {
  const today = dayKey();
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sub = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  if (key === today) return { title: 'Today', sub };
  if (key === shiftDay(today, -1)) return { title: 'Yesterday', sub };
  return { title: date.toLocaleDateString('en-GB', { weekday: 'long' }), sub: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) };
}

/* ----------------------------------------------------------------------- slots */

/**
 * Each part of the day lights in one of the instrument's own colour fields — the
 * same light that sits under the Explore panels, so a lit cell on the tracker and
 * an engaged filter are visibly the same material.
 */
export const SLOT_TONE: Record<MealSlot, Tone> = {
  breakfast: 'calories',
  coffee: 'plateWarm',
  lunch: 'health',
  snack: 'boost',
  dinner: 'time',
  postgym: 'volume',
};

/** A solid stand-in for each field, for chips and small marks. */
export const SLOT_COLOR: Record<MealSlot, string> = {
  breakfast: '#e28a45',
  coffee: '#8a3520',
  lunch: '#5ba055',
  snack: '#e77ba0',
  dinner: '#8f8ad2',
  postgym: '#6d8cc4',
};

export const ACTIVITY_TONE: Tone = 'engage';
export const ACTIVITY_COLOR = '#1f6b52';

export interface ActivityPreset {
  key: string;
  label: string;
  short: string;
  kcal: number;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { key: 'gym', label: 'Gym', short: 'Gym', kcal: 100 },
  { key: 'intense', label: 'Intense gym', short: 'Intense', kcal: 200 },
  { key: 'cardio', label: 'Cardio', short: 'Cardio', kcal: 100 },
  { key: 'steps', label: '10k steps', short: '10k steps', kcal: 100 },
  { key: 'extra50', label: 'Activity', short: 'Other', kcal: 50 },
  { key: 'extra100', label: 'Activity', short: 'Other', kcal: 100 },
];

/* ------------------------------------------------------------------------- bar */

export const SEGMENT_KCAL = 50;

export interface DayTotals {
  eaten: number;
  earned: number;
  budget: number;
  left: number;
  protein: number;
  carbs: number;
  fat: number;
  food: FoodLogEntry[];
  activities: FoodLogEntry[];
}

export function totalsFor(entries: FoodLogEntry[], goals: Goals): DayTotals {
  const food = entries.filter((e) => e.kind === 'food');
  const activities = entries.filter((e) => e.kind === 'activity');
  const eaten = food.reduce((s, e) => s + (e.kcal || 0), 0);
  const earned = activities.reduce((s, e) => s + (e.kcal || 0), 0);
  const budget = goals.kcal + earned;
  return {
    eaten,
    earned,
    budget,
    left: budget - eaten,
    protein: food.reduce((s, e) => s + (e.protein ?? 0), 0),
    carbs: food.reduce((s, e) => s + (e.carbs ?? 0), 0),
    fat: food.reduce((s, e) => s + (e.fat ?? 0), 0),
    food,
    activities,
  };
}

/**
 * A run of whole cells on the bar, counted from the floor. `start` is the first
 * cell it lights and `end` the one after its last.
 */
export interface Band {
  entry: FoodLogEntry;
  start: number;
  end: number;
  tone: Tone;
  color: string;
}

export interface BarLayout {
  food: Band[];
  activity: Band[];
  /** cells in the column */
  cells: number;
  /** cells up to the plain goal; anything above it up to `budgetCells` was earned */
  goalCells: number;
  budgetCells: number;
  /** cells food has lit */
  litCells: number;
}

/**
 * Food stacks from the floor in the order it was eaten. Activities sit above the
 * goal line — they are the room they earned, and food fills into them like any
 * other cell.
 *
 * The bar only ever lights whole cells. Each band's edges are the running total
 * rounded to the nearest cell, so the column stays honest about the day as a whole
 * (rounding errors don't pile up meal after meal), and every meal gets at least one
 * cell — a coffee under 25 kcal should still be visible on the day it was drunk.
 * The exact number lives in the readout beside the bar.
 */
export function bandsFor(t: DayTotals, goals: Goals): BarLayout {
  const cellOf = (kcal: number) => Math.round(kcal / SEGMENT_KCAL);

  let kcal = 0;
  let cell = 0;
  const food = t.food.map((entry) => {
    kcal += Math.max(0, entry.kcal);
    const start = cell;
    const end = Math.max(start + 1, cellOf(kcal));
    cell = end;
    const tone = entry.slot ? SLOT_TONE[entry.slot] : SLOT_TONE.snack;
    const color = entry.slot ? SLOT_COLOR[entry.slot] : SLOT_COLOR.snack;
    return { entry, start, end, tone, color };
  });

  const goalCells = Math.max(1, cellOf(goals.kcal));
  let earnedKcal = goals.kcal;
  let top = goalCells;
  const activity = t.activities.map((entry) => {
    earnedKcal += Math.max(0, entry.kcal);
    const start = top;
    const end = Math.max(start + 1, cellOf(earnedKcal));
    top = end;
    return { entry, start, end, tone: ACTIVITY_TONE, color: ACTIVITY_COLOR };
  });

  return { food, activity, cells: Math.max(top, cell, 1), goalCells, budgetCells: top, litCells: cell };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ---------------------------------------------------------------- macro focus */

export type MacroFocus = 'protein' | 'carbs' | 'fat';

export const MACRO_LABEL: Record<MacroFocus, string> = { protein: 'protein', carbs: 'carbs', fat: 'fat' };

/** The colour field each macro lights in — the same as its panel beside the bar. */
export const MACRO_TONE: Record<MacroFocus, Tone> = { protein: 'protein', carbs: 'calories', fat: 'time' };

const KCAL_PER_G: Record<MacroFocus, number> = { protein: 4, carbs: 4, fat: 9 };

/**
 * How much of a meal's energy came from one macro, 0..1 — or null when the meal was
 * logged without that macro, which is unknown rather than none. Clamped because
 * the 4/4/9 factors are approximations and rounded labels can add up past 100%.
 */
export function macroShare(entry: FoodLogEntry, macro: MacroFocus): number | null {
  const g = entry[macro];
  if (g == null || !(entry.kcal > 0)) return null;
  return Math.max(0, Math.min(1, (g * KCAL_PER_G[macro]) / entry.kcal));
}
