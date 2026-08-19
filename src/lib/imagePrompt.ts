import type { Ingredient, Recipe } from '@/lib/db/types';

/**
 * Image prompt generator.
 *
 * V1 does not generate images. It generates a *consistent* prompt, so that every
 * recipe shot from this app belongs to the same library: same camera, same light,
 * same restraint. The global direction below is fixed; only the subject changes.
 */

const DIRECTION = [
  'Editorial food photography, straight top-down camera, exactly perpendicular to the surface',
  'soft diffused natural daylight from one side, gentle shadows, no hard specular highlights',
  'realistic food textures, natural imperfections, subtle film grain',
  'abundant, generous portion, healthy and appetising rather than a small fine-dining plate',
  'restrained premium composition, generous negative space, muted neutral surface',
  'consistent crop and lighting with a coherent recipe photo library',
].join(', ');

const NEGATIVE = [
  'no hands',
  'no text or labels',
  'no cutlery clutter',
  'no napkins',
  'no decorative props',
  'no dramatic lifestyle background',
  'no unrelated ingredients',
  'no restaurant plating flourishes',
].join(', ');

/**
 * The vessel rule: use the least container the food actually needs. A wrap sits on
 * the surface; soup cannot. Never invent a plate, never invent an absurd
 * composition to avoid one.
 */
function vessel(recipe: Recipe): string {
  const t = `${recipe.title} ${recipe.description ?? ''}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has('soup', 'broth', 'stew', 'ramen', 'udon', 'noodle soup')) {
    return 'served in a single minimal ceramic bowl, filled generously to just below the rim';
  }
  if (has('smoothie', 'shake', 'juice', 'latte')) return 'in a plain clear glass';
  if (has('curry', 'bowl', 'porridge', 'oats', 'pudding', 'chia', 'risotto', 'stir fry', 'fried rice')) {
    return 'in a shallow, plain, wide bowl';
  }
  if (has('bake', 'baked', 'traybake', 'sheet-pan', 'sheet pan', 'gratin', 'lasagne', 'shakshuka')) {
    return 'in the baking dish or pan it was cooked in, straight from the oven';
  }
  if (has('salad')) return 'piled directly onto a clean surface or in one very shallow wide bowl';
  if (has('pancake', 'wrap', 'taco', 'sandwich', 'toast', 'burger', 'cups')) {
    return 'arranged directly on a clean matte surface, no plate';
  }
  return 'arranged directly on a clean matte surface where possible, otherwise one minimal bowl';
}

/** The ingredients that should actually be visible in frame. */
function subjects(recipe: Recipe, index: Map<string, Ingredient>): string[] {
  return recipe.ingredients
    .filter((ri) => {
      if (ri.role === 'basic') return false;
      const ing = ri.ingredient_id ? index.get(ri.ingredient_id) : null;
      if (ing?.default_basic) return false;
      return !(ing && (ing.category === 'spice' || ing.category === 'oil'));
    })
    .slice()
    .sort((a, b) => (b.grams ?? 0) - (a.grams ?? 0))
    .slice(0, 6)
    .map((ri) => ri.display_name.toLowerCase());
}

export function buildImagePrompt(recipe: Recipe, index: Map<string, Ingredient>): string {
  const key = subjects(recipe, index);
  const course = recipe.course_type ? `${recipe.course_type} dish` : 'dish';
  const cuisine = recipe.cuisine && recipe.cuisine !== 'Other' ? `${recipe.cuisine} ` : '';

  return [
    `${recipe.title} — a ${cuisine}${course}.`,
    key.length ? `Visible ingredients: ${key.join(', ')}.` : '',
    `Composition: ${vessel(recipe)}.`,
    DIRECTION + '.',
    `Avoid: ${NEGATIVE}.`,
    'Square 1:1 crop.',
  ]
    .filter(Boolean)
    .join(' ');
}
