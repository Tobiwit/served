import type { CourseType, Ingredient, IngredientRole, NewRecipe, Recipe } from '@/lib/db/types';
import { normalizeCourse } from '@/lib/db/types';
import { toGrams } from '@/lib/nutrition/units';
import { matchIngredient, type MatchResult } from '@/lib/match/fuzzy';
import type { ParsedRecipe } from '@/lib/parse/recipeText';

/** The editable recipe in progress, between "parsed" and "saved". */

export interface DraftIngredient {
  key: string;
  /**
   * The row this one stands in for, or null for a real ingredient line.
   *
   * Swaps are held as an ordinary row attached to the row above rather than as a
   * nested list: the editor can then treat every line the same, and the chain is
   * flattened into the parent's `substitutions` on the way out. One consequence is
   * the one that matters — a swap never carries grams into the nutrition sum, so a
   * dish made with chicken *or* tofu is costed once, not twice.
   */
  swapOf: string | null;
  name: string;
  /** what was typed or parsed, kept so "keep my wording" has something to restore */
  typedName: string;
  /** the user chose their own wording over the matched ingredient's canonical name */
  customName: boolean;
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
  /** folded down to a summary line — a settled ingredient is not worth a card */
  collapsed: boolean;
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

/** The row has an answer: a matched ingredient, or a deliberate "save it anyway". */
export function isResolved(d: DraftIngredient): boolean {
  return !!d.name.trim() && (d.confirmed || !!d.ingredientId);
}

/**
 * Attach an ingredient to a row.
 *
 * The display name follows the ingredient unless the user has asked to keep their
 * own wording. Recipes read as one collection when "sourdough", "sourdough bread"
 * and "bread, sourdough" all settle on the same words, so adopting the canonical
 * name is the default and the individual name is the deliberate exception.
 */
export function applyMatch(
  row: DraftIngredient,
  ingredient: Ingredient | null,
  index: Map<string, Ingredient>,
): DraftIngredient {
  const next: DraftIngredient = {
    ...row,
    ingredientId: ingredient?.id ?? null,
    confirmed: true,
    role: ingredient?.default_basic ? 'basic' : row.role,
    name: ingredient && !row.customName ? ingredient.name : row.name,
  };
  next.grams = resolveGrams(next, ingredient ? new Map(index).set(ingredient.id, ingredient) : index);
  return next;
}

/** Swap between the matched ingredient's name and the wording the user typed. */
export function setCustomName(
  row: DraftIngredient,
  custom: boolean,
  index: Map<string, Ingredient>,
): DraftIngredient {
  const ing = row.ingredientId ? (index.get(row.ingredientId) ?? null) : null;
  return {
    ...row,
    customName: custom,
    name: custom ? row.typedName || row.name : (ing?.name ?? row.name),
  };
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
    swapOf: null,
    name: ing ? ing.name : parsed.name,
    typedName: parsed.name,
    customName: false,
    amount: parsed.amount,
    unit: parsed.unit,
    grams: null,
    gramsOverridden: false,
    role,
    notes: parsed.notes,
    match,
    ingredientId: ing?.id ?? null,
    confirmed: match.status === 'accepted',
    collapsed: match.status === 'accepted',
  };
  d.grams = resolveGrams(d, index);
  return d;
}

export function draftFromParsed(parsed: ParsedRecipe, ingredients: Ingredient[], index: Map<string, Ingredient>): Draft {
  return withSwapRows({
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
  });
}

/** Reopen a saved recipe for editing. Substitution chains come back as swap rows. */
export function draftFromRecipe(recipe: Recipe, index: Map<string, Ingredient>): Draft {
  const rows: DraftIngredient[] = [];

  for (const ri of recipe.ingredients) {
    const head = key();
    const ing = ri.ingredient_id ? (index.get(ri.ingredient_id) ?? null) : null;
    rows.push({
      key: head,
      swapOf: null,
      name: ri.display_name,
      typedName: ri.display_name,
      customName: !!ing && ing.name !== ri.display_name,
      amount: ri.amount,
      unit: ri.unit,
      grams: ri.grams,
      // a saved recipe already holds the grams it was costed with, and re-deriving
      // them here would quietly change the nutrition of a recipe merely opened
      gramsOverridden: ri.grams != null,
      role: ri.role,
      notes: ri.notes,
      match: { query: ri.display_name, status: 'none', best: null, alternatives: [] },
      ingredientId: ri.ingredient_id,
      confirmed: true,
      collapsed: true,
    });

    let parent = head;
    for (const sub of ri.substitutions) {
      const k = key();
      const subIng = sub.substitute_ingredient_id ? (index.get(sub.substitute_ingredient_id) ?? null) : null;
      rows.push({
        key: k,
        swapOf: parent,
        name: sub.display_name,
        typedName: sub.display_name,
        customName: !!subIng && subIng.name !== sub.display_name,
        amount: sub.amount,
        unit: sub.unit,
        grams: sub.grams,
        gramsOverridden: sub.grams != null,
        // a swap is only ever an alternative, so its own role is inert; it starts
        // closed and the user marks it swappable again to extend the chain
        role: 'core',
        notes: sub.notes,
        match: { query: sub.display_name, status: 'none', best: null, alternatives: [] },
        ingredientId: sub.substitute_ingredient_id,
        confirmed: true,
        collapsed: true,
      });
      parent = k;
    }
  }

  return withSwapRows({
    title: recipe.title,
    description: recipe.description ?? '',
    servings: recipe.servings,
    prepMinutes: recipe.prep_minutes,
    cookMinutes: recipe.cook_minutes,
    cuisine: recipe.cuisine,
    courseType: normalizeCourse(recipe.course_type),
    ingredients: rows,
    instructions: recipe.instructions.map((s) => s.text),
    sourceText: recipe.source_text,
    notes: recipe.notes ?? '',
  });
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

export function blankIngredient(swapOf: string | null = null): DraftIngredient {
  return {
    key: key(),
    swapOf,
    name: '',
    typedName: '',
    customName: false,
    amount: null,
    unit: null,
    grams: null,
    gramsOverridden: false,
    role: 'core',
    notes: null,
    match: { query: '', status: 'none', best: null, alternatives: [] },
    ingredientId: null,
    confirmed: false,
    collapsed: false,
  };
}

/** The row standing in for this one, if there is one. */
export function swapChildOf(rows: DraftIngredient[], k: string): DraftIngredient | null {
  return rows.find((r) => r.swapOf === k) ?? null;
}

/** A row and everything standing in for it, in order. */
export function chainFrom(rows: DraftIngredient[], k: string): DraftIngredient[] {
  const out: DraftIngredient[] = [];
  let cursor: string | null = k;
  while (cursor) {
    const row: DraftIngredient | undefined = rows.find((r) => r.key === cursor);
    if (!row) break;
    out.push(row);
    cursor = swapChildOf(rows, row.key)?.key ?? null;
  }
  return out;
}

/**
 * Keep the swap chains honest.
 *
 * A row marked swappable and finished with grows an empty row beneath it, ready for
 * the alternative — mark *that* one swappable too and the chain carries on. Take the
 * mark off, or empty the row, and the untouched tail is cleared away again.
 *
 * Doing it here rather than in an effect means the list is always a pure function of
 * the rows, so nothing can leave a stray row behind on an undo or a re-render.
 */
export function withSwapRows(draft: Draft): Draft {
  const rows = draft.ingredients;
  const out: DraftIngredient[] = [];
  const seen = new Set<string>();

  const walk = (row: DraftIngredient) => {
    if (seen.has(row.key)) return;
    seen.add(row.key);
    out.push(row);

    const child = swapChildOf(rows, row.key);
    const wantsChild = row.role === 'substitutable' && isResolved(row);

    if (child) {
      // an untouched offer that is no longer wanted simply goes away again
      const touched = !!child.name.trim() || !!child.ingredientId;
      if (wantsChild || touched) walk(child);
      else seen.add(child.key);
      return;
    }
    if (wantsChild) out.push(blankIngredient(row.key));
  };

  for (const row of rows) if (row.swapOf === null) walk(row);
  return { ...draft, ingredients: out };
}

/** Remove a row and every alternative hanging off it. */
export function removeRow(draft: Draft, k: string): Draft {
  const doomed = new Set(chainFrom(draft.ingredients, k).map((r) => r.key));
  return withSwapRows({ ...draft, ingredients: draft.ingredients.filter((r) => !doomed.has(r.key)) });
}

/** Ingredients still needing a decision before the recipe is trustworthy. */
export function unresolvedCount(draft: Draft): number {
  return draft.ingredients.filter((d) => d.name.trim() && !isResolved(d)).length;
}

/**
 * Settle every row that is not keeping its own wording onto its ingredient's name.
 *
 * Rows adopt the canonical name as they are matched, but a name typed straight into
 * the field is left alone while it is being typed. This is the last chance to make
 * the collection uniform before it is written.
 */
export function settleNames(draft: Draft, index: Map<string, Ingredient>): Draft {
  return {
    ...draft,
    ingredients: draft.ingredients.map((d) => {
      if (d.customName || !d.ingredientId) return d;
      const ing = index.get(d.ingredientId);
      return ing && ing.name !== d.name ? { ...d, name: ing.name } : d;
    }),
  };
}

export function toNewRecipe(draft: Draft, base?: Recipe, index?: Map<string, Ingredient>): NewRecipe {
  if (index) draft = settleNames(draft, index);

  const total =
    draft.prepMinutes != null || draft.cookMinutes != null
      ? (draft.prepMinutes ?? 0) + (draft.cookMinutes ?? 0)
      : null;

  const named = draft.ingredients.filter((d) => d.name.trim());
  const heads = named.filter((d) => d.swapOf === null);

  return {
    id: base?.id,
    title: draft.title.trim() || 'Untitled recipe',
    description: draft.description.trim() || null,
    servings: Math.max(1, draft.servings),
    prep_minutes: draft.prepMinutes,
    cook_minutes: draft.cookMinutes,
    total_minutes: total,
    cuisine: draft.cuisine,
    course_type: draft.courseType,
    image_url: base?.image_url ?? null,
    image_prompt: base?.image_prompt ?? null,
    source_text: draft.sourceText,
    source_name: base?.source_name ?? null,
    notes: draft.notes.trim() || null,
    favorite: base?.favorite ?? false,
    ingredients: heads.map((d, i) => {
      // the head carries the amount; the chain behind it is only ever alternatives
      const alternatives = chainFrom(draft.ingredients, d.key)
        .slice(1)
        .filter((s) => s.name.trim());
      return {
        id: d.key,
        ingredient_id: d.ingredientId,
        display_name: d.name.trim(),
        amount: d.amount,
        unit: d.unit,
        grams: d.grams,
        role: alternatives.length > 0 ? 'substitutable' : d.role,
        sort_order: i,
        notes: d.notes,
        substitutions: alternatives.map((s) => ({
          id: s.key,
          substitute_ingredient_id: s.ingredientId,
          display_name: s.name.trim(),
          // null all the way down means "however much the line above says"
          amount: s.amount,
          unit: s.unit,
          grams: s.grams,
          amount_multiplier: null,
          notes: s.notes,
        })),
      };
    }),
    instructions: draft.instructions
      .filter((t) => t.trim())
      .map((text, i) => ({ id: `${key()}_${i}`, step_number: i + 1, text: text.trim() })),
    tags: base?.tags ?? [],
  };
}
