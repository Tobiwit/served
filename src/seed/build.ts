import type { Ingredient, IngredientCategory, UnitConversion } from '@/lib/db/types';

export type SeedOpts = {
  basic?: boolean;
  aliases?: string[];
  units?: [string, number][];
};

export type SeedRow = [
  name: string,
  category: IngredientCategory,
  kcal: number | null,
  protein: number | null,
  carbs: number | null,
  fat: number | null,
  fiber: number | null,
  water: number | null,
  opts?: SeedOpts,
];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Lowercased, accent-stripped, punctuation-free form used for matching. */
export function searchName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STAMP = '2026-01-01T00:00:00.000Z';

export function buildIngredient(row: SeedRow): Ingredient {
  const [name, category, kcal, protein, carbs, fat, fiber, water, opts] = row;
  const units: UnitConversion[] = (opts?.units ?? []).map(([unit, grams_per_unit]) => ({ unit, grams_per_unit }));
  return {
    id: `ing_${slugify(name)}`,
    name,
    search_name: searchName(name),
    category,
    kcal_100g: kcal,
    protein_100g: protein,
    carbs_100g: carbs,
    fat_100g: fat,
    fiber_100g: fiber,
    water_100g: water,
    default_basic: opts?.basic ?? false,
    aliases: opts?.aliases ?? [],
    unit_conversions: units,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

import type { CourseType, IngredientRole, Recipe, RecipeIngredient } from '@/lib/db/types';

export type IngRow = [
  name: string,
  amount: number | null,
  unit: string | null,
  grams: number | null,
  role: IngredientRole,
  notes?: string,
];

export interface RecipeSeed {
  title: string;
  description: string;
  servings: number;
  prep: number;
  cook: number;
  cuisine: string;
  course: CourseType;
  tags: string[];
  ing: IngRow[];
  steps: string[];
  notes?: string;
  /** display name -> alternative ingredient names */
  subs?: Record<string, string[]>;
}

export function buildRecipe(seed: RecipeSeed, createdOffsetDays: number): Recipe {
  const id = `rec_${slugify(seed.title)}`;
  const created = new Date(Date.UTC(2026, 0, 1) - createdOffsetDays * 86400000).toISOString();

  const ingredients: RecipeIngredient[] = seed.ing.map((row, i) => {
    const [name, amount, unit, grams, role, notes] = row;
    const subs = seed.subs?.[name] ?? [];
    return {
      id: `${id}_ri${i}`,
      ingredient_id: `ing_${slugify(name)}`,
      display_name: name,
      amount,
      unit,
      grams,
      role,
      sort_order: i,
      notes: notes ?? null,
      substitutions: subs.map((s, j) => ({
        id: `${id}_ri${i}_s${j}`,
        substitute_ingredient_id: `ing_${slugify(s)}`,
        display_name: s,
        amount_multiplier: null,
        notes: null,
      })),
    };
  });

  return {
    id,
    title: seed.title,
    description: seed.description,
    servings: seed.servings,
    prep_minutes: seed.prep,
    cook_minutes: seed.cook,
    total_minutes: seed.prep + seed.cook,
    cuisine: seed.cuisine,
    course_type: seed.course,
    image_url: null,
    image_prompt: null,
    source_text: null,
    source_name: null,
    notes: seed.notes ?? null,
    favorite: false,
    created_at: created,
    updated_at: created,
    ingredients,
    instructions: seed.steps.map((text, i) => ({ id: `${id}_st${i}`, step_number: i + 1, text })),
    tags: seed.tags,
  };
}
