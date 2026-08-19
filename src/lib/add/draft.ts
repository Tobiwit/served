import type { CourseType, Ingredient, IngredientRole, NewRecipe } from '@/lib/db/types';
import { toGrams } from '@/lib/nutrition/units';
import { matchIngredient, type MatchResult } from '@/lib/match/fuzzy';
import type { ParsedRecipe } from '@/lib/parse/recipeText';

/** The editable recipe in progress, between "parsed" and "saved". */

export interface DraftIngredient {
  key: string;
  name: string;
  amount: number | null;
  unit: string | null;
  grams: number | null;
  /** true once the user has typed a gram value themselves */
  gramsOverridden: boolean;
  role: IngredientRole;
  notes: string | null;
  match: MatchResult;
  ingredientId: string | null;
  /** the user has explicitly accepted or chosen this match */
  confirmed: boolean;
}

export interface Draft {
  title: string;
  description: string;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  cuisine: string | null;
  courseType: CourseType | null;
  ingredients: DraftIngredient[];
  instructions: string[];
  sourceText: string | null;
  notes: string;
}

let seq = 0;
const key = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export function resolveGrams(d: DraftIngredient, index: Map<string, Ingredient>): number | null {
  if (d.gramsOverridden) return d.grams;
  const ing = d.ingredientId ? (index.get(d.ingredientId) ?? null) : null;
  return toGrams(d.amount, d.unit, ing);
}

export function draftIngredient(
  parsed: { name: string; amount: number | null; unit: string | null; notes: string | null; role: IngredientRole },
  ingredients: Ingredient[],
  index: Map<string, Ingredient>,
): DraftIngredient {
  const match = matchIngredient(parsed.name, ingredients);
  const auto = match.status === 'accepted' ? match.best : null;
  const ing = auto?.ingredient ?? null;

  // pantry staples default to the `basic` role so they stay out of Explore
  const role: IngredientRole = ing?.default_basic ? 'basic' : parsed.role;

  const d: DraftIngredient = {
    key: key(),
    name: parsed.name,
    amount: parsed.amount,
    unit: parsed.unit,
    grams: null,
    gramsOverridden: false,
    role,
    notes: parsed.notes,
    match,
    ingredientId: ing?.id ?? null,
    confirmed: match.status === 'accepted',
  };
  d.grams = resolveGrams(d, index);
  return d;
}

export function draftFromParsed(parsed: ParsedRecipe, ingredients: Ingredient[], index: Map<string, Ingredient>): Draft {
  return {
    title: parsed.title,
    description: parsed.description ?? '',
    servings: parsed.servings,
    prepMinutes: parsed.prep_minutes,
    cookMinutes: parsed.cook_minutes,
    cuisine: parsed.cuisine,
    courseType: parsed.course_type,
    ingredients: parsed.ingredients.map((p) => draftIngredient(p, ingredients, index)),
    instructions: parsed.instructions,
    sourceText: null,
    notes: '',
  };
}

export function emptyDraft(): Draft {
  return {
    title: '',
    description: '',
    servings: 1,
    prepMinutes: null,
    cookMinutes: null,
    cuisine: null,
    courseType: null,
    ingredients: [],
    instructions: [],
    sourceText: null,
    notes: '',
  };
}

export function blankIngredient(): DraftIngredient {
  return {
    key: key(),
    name: '',
    amount: null,
    unit: null,
    grams: null,
    gramsOverridden: false,
    role: 'core',
    notes: null,
    match: { query: '', status: 'none', best: null, alternatives: [] },
    ingredientId: null,
    confirmed: false,
  };
}

/** Ingredients still needing a decision before the recipe is trustworthy. */
export function unresolvedCount(draft: Draft): number {
  return draft.ingredients.filter((d) => !d.confirmed && !d.ingredientId).length;
}

export function toNewRecipe(draft: Draft, id?: string): NewRecipe {
  const total =
    draft.prepMinutes != null || draft.cookMinutes != null
      ? (draft.prepMinutes ?? 0) + (draft.cookMinutes ?? 0)
      : null;

  return {
    id,
    title: draft.title.trim() || 'Untitled recipe',
    description: draft.description.trim() || null,
    servings: Math.max(1, draft.servings),
    prep_minutes: draft.prepMinutes,
    cook_minutes: draft.cookMinutes,
    total_minutes: total,
    cuisine: draft.cuisine,
    course_type: draft.courseType,
    image_url: null,
    image_prompt: null,
    source_text: draft.sourceText,
    source_name: null,
    notes: draft.notes.trim() || null,
    favorite: false,
    ingredients: draft.ingredients
      .filter((d) => d.name.trim())
      .map((d, i) => ({
        id: `${d.key}`,
        ingredient_id: d.ingredientId,
        display_name: d.name.trim(),
        amount: d.amount,
        unit: d.unit,
        grams: d.grams,
        role: d.role,
        sort_order: i,
        notes: d.notes,
        substitutions: [],
      })),
    instructions: draft.instructions
      .filter((t) => t.trim())
      .map((text, i) => ({ id: `${key()}_${i}`, step_number: i + 1, text: text.trim() })),
    tags: [],
  };
}
