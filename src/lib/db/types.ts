/** Domain model. Mirrors the Postgres schema in supabase/migrations. */

export type IngredientRole = 'core' | 'optional' | 'substitutable' | 'basic';

export const INGREDIENT_ROLES: IngredientRole[] = ['core', 'optional', 'substitutable', 'basic'];

/**
 * Categories carry the qualitative signal the macros can't: a category is how the
 * scoring engine knows that 300 kcal of almonds and 300 kcal of chorizo are not
 * the same food. Keep them coarse and honest.
 */
export type IngredientCategory =
  | 'vegetable'
  | 'fruit'
  | 'legume'
  | 'whole_grain'
  | 'refined_grain'
  | 'protein_lean'
  | 'protein_fatty'
  | 'processed_meat'
  | 'seafood'
  | 'egg'
  | 'dairy_low_fat'
  | 'dairy_full_fat'
  | 'cheese'
  | 'nuts_seeds'
  | 'oil'
  | 'fat_solid'
  | 'sweetener'
  | 'sauce_condiment'
  | 'spice'
  | 'beverage'
  | 'other';

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  'vegetable',
  'fruit',
  'legume',
  'whole_grain',
  'refined_grain',
  'protein_lean',
  'protein_fatty',
  'processed_meat',
  'seafood',
  'egg',
  'dairy_low_fat',
  'dairy_full_fat',
  'cheese',
  'nuts_seeds',
  'oil',
  'fat_solid',
  'sweetener',
  'sauce_condiment',
  'spice',
  'beverage',
  'other',
];

export const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  vegetable: 'Vegetable',
  fruit: 'Fruit',
  legume: 'Legume',
  whole_grain: 'Whole grain',
  refined_grain: 'Refined grain',
  protein_lean: 'Lean protein',
  protein_fatty: 'Fatty protein',
  processed_meat: 'Processed meat',
  seafood: 'Seafood',
  egg: 'Egg',
  dairy_low_fat: 'Low-fat dairy',
  dairy_full_fat: 'Full-fat dairy',
  cheese: 'Cheese',
  nuts_seeds: 'Nuts & seeds',
  oil: 'Oil',
  fat_solid: 'Solid fat',
  sweetener: 'Sweetener',
  sauce_condiment: 'Sauce / condiment',
  spice: 'Spice / herb',
  beverage: 'Liquid',
  other: 'Other',
};

export interface UnitConversion {
  unit: string;
  grams_per_unit: number;
}

export interface Ingredient {
  id: string;
  name: string;
  search_name: string;
  category: IngredientCategory;
  /** all macros nullable — missing means unknown, never zero */
  kcal_100g: number | null;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  fiber_100g: number | null;
  water_100g: number | null;
  default_basic: boolean;
  aliases: string[];
  unit_conversions: UnitConversion[];
  created_at: string;
  updated_at: string;
}

export interface IngredientSubstitution {
  id: string;
  substitute_ingredient_id: string | null;
  display_name: string;
  /**
   * A stand-in is rarely a like-for-like swap by weight: 80 g of halloumi is not
   * 80 g of tofu, and a tablespoon of tahini is not a tablespoon of yoghurt. Left
   * null these fall back to the line the substitution hangs off.
   */
  amount: number | null;
  unit: string | null;
  grams: number | null;
  amount_multiplier: number | null;
  notes: string | null;
}

export interface RecipeIngredient {
  id: string;
  ingredient_id: string | null;
  display_name: string;
  amount: number | null;
  unit: string | null;
  grams: number | null;
  role: IngredientRole;
  sort_order: number;
  notes: string | null;
  substitutions: IngredientSubstitution[];
}

export interface RecipeInstruction {
  id: string;
  step_number: number;
  text: string;
}

/**
 * Lunch and dinner were never a distinction this app could act on: the same bowl of
 * noodles answers both, so tagging one of them only ever hid recipes from the other.
 * They are one course — `main`.
 */
export type CourseType = 'breakfast' | 'main' | 'snack' | 'dessert';

export const COURSE_TYPES: CourseType[] = ['breakfast', 'main', 'snack', 'dessert'];

export const COURSE_LABEL: Record<CourseType, string> = {
  breakfast: 'Breakfast',
  main: 'Main',
  snack: 'Snack',
  dessert: 'Dessert',
};

/** Recipes saved before the merge still carry the old tags. */
const LEGACY_COURSE: Record<string, CourseType> = { lunch: 'main', dinner: 'main' };

export function normalizeCourse(value: string | null | undefined): CourseType | null {
  if (!value) return null;
  if (LEGACY_COURSE[value]) return LEGACY_COURSE[value];
  return (COURSE_TYPES as string[]).includes(value) ? (value as CourseType) : null;
}

export const CUISINES = [
  'Italian',
  'Mediterranean',
  'Japanese',
  'Korean',
  'Mexican',
  'Indian',
  'German',
  'Other',
] as const;

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  cuisine: string | null;
  course_type: CourseType | null;
  image_url: string | null;
  image_prompt: string | null;
  source_text: string | null;
  source_name: string | null;
  notes: string | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  tags: string[];
}

export type NewRecipe = Omit<Recipe, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type NewIngredient = Omit<Ingredient, 'id' | 'created_at' | 'updated_at'> & { id?: string };

/**
 * Rotation history. One row each time a recipe was actually made — append-only, so
 * "last cooked" is a max() and "how often" is a count, rather than two fields on the
 * recipe that have to be kept honest.
 */
export interface CookLogEntry {
  id: string;
  recipe_id: string;
  cooked_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** `cooked_at` defaults to now and a note is rarely wanted, so neither is required. */
export type NewCookLogEntry = Omit<CookLogEntry, 'id' | 'created_at' | 'updated_at' | 'cooked_at' | 'note'> & {
  id?: string;
  cooked_at?: string;
  note?: string | null;
};
