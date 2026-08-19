import type { Ingredient } from '@/lib/db/types';
import { buildIngredient, type SeedRow } from './build';

/**
 * Pantry, sauces, herbs and spices. Most of these are flagged `default_basic`,
 * which keeps them out of the Explore ingredient capsules and out of ingredient
 * exclusion entirely. Anything with real character (gochujang, miso, pesto) is
 * deliberately not basic.
 */
const ROWS: SeedRow[] = [
  ['Salt', 'spice', 0, 0, 0, 0, 0, 0, { basic: true, aliases: ['sea salt', 'flaky salt', 'kosher salt'], units: [['tsp', 6], ['pinch', 0.4]] }],
  ['Black pepper', 'spice', 251, 10, 64, 3.3, 25, 10, { basic: true, aliases: ['pepper'], units: [['tsp', 2.3]] }],
  ['Garlic', 'spice', 149, 6.4, 33, 0.5, 2.1, 59, { basic: true, aliases: ['garlic clove', 'garlic cloves'], units: [['clove', 4]] }],
  ['Ginger', 'spice', 80, 1.8, 18, 0.8, 2, 79, { basic: true, aliases: ['fresh ginger'], units: [['tbsp', 6]] }],
  ['Chilli flakes', 'spice', 282, 12, 50, 14, 27, 8, { basic: true, aliases: ['red pepper flakes', 'chili flakes'], units: [['tsp', 2]] }],
  ['Smoked paprika', 'spice', 282, 14, 54, 13, 35, 12, { basic: true, aliases: ['paprika'], units: [['tsp', 2.3]] }],
  ['Ground cumin', 'spice', 375, 18, 44, 22, 11, 8, { basic: true, aliases: ['cumin'], units: [['tsp', 2.1]] }],
  ['Curry powder', 'spice', 325, 14, 56, 14, 33, 10, { basic: true, units: [['tsp', 2]] }],
  ['Ground coriander', 'spice', 298, 12, 55, 18, 42, 9, { basic: true, units: [['tsp', 1.8]] }],
  ['Ground turmeric', 'spice', 312, 9.7, 67, 3.3, 22, 11, { basic: true, aliases: ['turmeric'], units: [['tsp', 3]] }],
  ['Dried oregano', 'spice', 265, 9, 69, 4.3, 43, 9, { basic: true, aliases: ['oregano'], units: [['tsp', 1]] }],
  ['Basil', 'spice', 23, 3.2, 2.6, 0.6, 1.6, 92, { aliases: ['fresh basil'], units: [['bunch', 25]] }],
  ['Coriander', 'spice', 23, 2.1, 3.7, 0.5, 2.8, 92, { aliases: ['cilantro', 'fresh coriander'], units: [['bunch', 25]] }],
  ['Parsley', 'spice', 36, 3, 6, 0.8, 3.3, 88, { aliases: ['flat leaf parsley'], units: [['bunch', 25]] }],
  ['Mint', 'spice', 44, 3.3, 8, 0.7, 8, 86, { aliases: ['fresh mint'], units: [['bunch', 20]] }],
  ['Dill', 'spice', 43, 3.5, 7, 1.1, 2.1, 86, { units: [['bunch', 20]] }],

  ['Soy sauce', 'sauce_condiment', 53, 8, 4.9, 0.1, 0.8, 71, { basic: true, aliases: ['light soy sauce', 'tamari'], units: [['tbsp', 16]] }],
  ['Rice vinegar', 'sauce_condiment', 18, 0, 0.5, 0, 0, 94, { basic: true, units: [['tbsp', 15]] }],
  ['Balsamic vinegar', 'sauce_condiment', 88, 0.5, 17, 0, 0, 77, { basic: true, units: [['tbsp', 16]] }],
  ['Dijon mustard', 'sauce_condiment', 66, 4, 6, 3.6, 4, 83, { basic: true, aliases: ['mustard'], units: [['tbsp', 15], ['tsp', 5]] }],
  ['Lemon juice', 'other', 22, 0.4, 6.9, 0.2, 0.3, 92, { basic: true, units: [['tbsp', 15]] }],
  ['Tomato paste', 'vegetable', 82, 4.3, 19, 0.5, 4.1, 74, { basic: true, aliases: ['tomato puree'], units: [['tbsp', 16]] }],
  ['Vegetable stock', 'beverage', 4, 0.3, 0.6, 0, 0, 98, { basic: true, aliases: ['stock', 'broth', 'vegetable broth'] }],
  ['Cornflour', 'refined_grain', 381, 0.3, 91, 0.1, 0.9, 8, { basic: true, aliases: ['cornstarch'], units: [['tbsp', 8]] }],

  ['Gochujang', 'sauce_condiment', 214, 5, 46, 1.6, 3, 45, { aliases: ['korean chilli paste'], units: [['tbsp', 18]] }],
  ['Miso paste', 'sauce_condiment', 199, 12, 26, 6, 5.4, 43, { aliases: ['white miso', 'miso'], units: [['tbsp', 17]] }],
  ['Harissa', 'sauce_condiment', 108, 3, 12, 5, 5, 70, { units: [['tbsp', 16]] }],
  ['Pesto', 'sauce_condiment', 450, 5, 6, 45, 2, 38, { units: [['tbsp', 15]] }],
  ['Sriracha', 'sauce_condiment', 93, 1.9, 19, 0.9, 2.2, 70, { basic: true, aliases: ['hot sauce', 'chilli sauce'], units: [['tbsp', 15]] }],
  ['Light mayonnaise', 'sauce_condiment', 238, 1, 9, 22, 0, 65, { aliases: ['mayo', 'mayonnaise'], units: [['tbsp', 14]] }],
  ['Nutritional yeast', 'other', 385, 45, 36, 5, 27, 5, { units: [['tbsp', 5]] }],

  ['Honey', 'sweetener', 304, 0.3, 82, 0, 0.2, 17, { units: [['tbsp', 21], ['tsp', 7]] }],
  ['Maple syrup', 'sweetener', 260, 0, 67, 0, 0, 32, { units: [['tbsp', 20]] }],
  ['Sugar', 'sweetener', 387, 0, 100, 0, 0, 0, { basic: true, aliases: ['caster sugar', 'granulated sugar'], units: [['tbsp', 12.5], ['tsp', 4]] }],
  ['Dark chocolate 85%', 'other', 598, 10, 46, 43, 11, 1, { aliases: ['dark chocolate'] }],
  ['Cocoa powder', 'other', 228, 20, 58, 14, 33, 3, { units: [['tbsp', 5]] }],
  ['Vanilla extract', 'other', 288, 0.1, 13, 0.1, 0, 52, { basic: true, units: [['tsp', 4.2]] }],
];

export const SEED_INGREDIENTS_C: Ingredient[] = ROWS.map(buildIngredient);
