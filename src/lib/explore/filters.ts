import type { CourseType } from '@/lib/db/types';

/** One quantitative filter module: off, or on with an exact threshold. */
export interface Quant {
  on: boolean;
  value: number;
}

export interface FilterState {
  protein: Quant;
  calories: Quant;
  volume: Quant;
  health: Quant;
  time: Quant;
  /** cuisine is engaged like any other filter before its tags do anything */
  cuisineOn: boolean;
  cuisines: string[];
  courses: CourseType[];
}

export type QuantKey = 'protein' | 'calories' | 'volume' | 'health' | 'time';

export interface QuantSpec {
  key: QuantKey;
  label: string;
  /** the one-tap recommended setting */
  /** the quick-preset word, e.g. "High protein" */
  preset: string;
  direction: 'atLeast' | 'atMost';
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
  labels: number[];
  tone: 'protein' | 'calories' | 'volume' | 'health' | 'time';
}

export const QUANT_SPECS: Record<QuantKey, QuantSpec> = {
  protein: {
    key: 'protein',
    label: 'Protein',
    preset: 'High protein',
    direction: 'atLeast',
    unit: 'g',
    min: 10,
    max: 70,
    step: 5,
    default: 35,
    labels: [10, 30, 50, 70],
    tone: 'protein',
  },
  calories: {
    key: 'calories',
    label: 'Calories',
    preset: 'Low calorie',
    direction: 'atMost',
    unit: 'kcal',
    min: 200,
    max: 1200,
    step: 25,
    default: 600,
    labels: [200, 500, 800, 1200],
    tone: 'calories',
  },
  volume: {
    key: 'volume',
    label: 'Volume',
    preset: 'High volume',
    direction: 'atLeast',
    unit: '',
    min: 0,
    max: 100,
    step: 5,
    default: 70,
    labels: [0, 40, 70, 100],
    tone: 'volume',
  },
  health: {
    key: 'health',
    label: 'Health',
    preset: 'Healthy',
    direction: 'atLeast',
    unit: '',
    min: 0,
    max: 100,
    step: 5,
    default: 70,
    labels: [0, 40, 70, 100],
    tone: 'health',
  },
  time: {
    key: 'time',
    label: 'Time',
    preset: 'Quick',
    direction: 'atMost',
    unit: 'min',
    min: 5,
    max: 90,
    step: 5,
    default: 30,
    labels: [5, 30, 60, 90],
    tone: 'time',
  },
};

export const QUANT_ORDER: QuantKey[] = ['protein', 'calories', 'volume', 'health', 'time'];

export function defaultFilters(): FilterState {
  return {
    protein: { on: false, value: QUANT_SPECS.protein.default },
    calories: { on: false, value: QUANT_SPECS.calories.default },
    volume: { on: false, value: QUANT_SPECS.volume.default },
    health: { on: false, value: QUANT_SPECS.health.default },
    time: { on: false, value: QUANT_SPECS.time.default },
    cuisineOn: false,
    cuisines: [],
    courses: [],
  };
}

export function activeCount(f: FilterState): number {
  let n = 0;
  for (const k of QUANT_ORDER) if (f[k].on) n++;
  if (f.cuisineOn && f.cuisines.length) n++;
  if (f.courses.length) n++;
  return n;
}

/** Human-readable summary of a threshold, e.g. "≥ 35 g" or "≤ 30 min". */
export function describeQuant(key: QuantKey, value: number): string {
  const s = QUANT_SPECS[key];
  const arrow = s.direction === 'atLeast' ? '≥' : '≤';
  return `${arrow} ${value}${s.unit ? ` ${s.unit}` : ''}`;
}
