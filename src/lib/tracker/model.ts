import type { FoodLogEntry, MealSlot } from '@/lib/db/types';

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

/** Taken from the palette families — light enough that ink labels sit on them. */
export const SLOT_COLOR: Record<MealSlot, string> = {
  breakfast: '#ffd0aa',
  coffee: '#f5a951',
  lunch: '#d9f265',
  snack: '#ffa3c6',
  dinner: '#c9bcee',
  postgym: '#a5d8e6',
};

export const ACTIVITY_COLOR = '#4da566';

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

/** A run of kcal on the bar, in kcal from the bottom. */
export interface Band {
  entry: FoodLogEntry;
  from: number;
  to: number;
  color: string;
}

/**
 * Food stacks from the floor in the order it was eaten. Activities sit above the
 * goal line — they are the room they earned, and food fills into them like any
 * other segment.
 */
export function bandsFor(t: DayTotals, goals: Goals): { food: Band[]; activity: Band[]; capacity: number } {
  let at = 0;
  const food = t.food.map((entry) => {
    const band = { entry, from: at, to: at + Math.max(0, entry.kcal), color: entry.slot ? SLOT_COLOR[entry.slot] : SLOT_COLOR.snack };
    at = band.to;
    return band;
  });

  let top = goals.kcal;
  const activity = t.activities.map((entry) => {
    const band = { entry, from: top, to: top + Math.max(0, entry.kcal), color: ACTIVITY_COLOR };
    top = band.to;
    return band;
  });

  const capacity = Math.max(SEGMENT_KCAL, Math.ceil(Math.max(t.budget, t.eaten) / SEGMENT_KCAL) * SEGMENT_KCAL);
  return { food, activity, capacity };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
