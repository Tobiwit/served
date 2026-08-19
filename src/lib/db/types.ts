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

export type CourseType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert';

export const COURSE_TYPES: CourseType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];

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
