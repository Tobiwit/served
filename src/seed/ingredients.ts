import type { Ingredient } from '@/lib/db/types';
import { buildIngredient, type SeedRow } from './build';

/**
 * Starter ingredient database. Values are per 100 g and reflect the form actually
 * used in recipes (cooked rice is stored cooked). Nulls are genuine unknowns.
 */
const ROWS: SeedRow[] = [
  // ---- protein ----
  ['Chicken breast', 'protein_lean', 165, 31, 0, 3.6, 0, 65, { aliases: ['chicken', 'chicken fillet', 'chicken breast fillet'] }],
  ['Chicken thigh', 'protein_fatty', 209, 26, 0, 11, 0, 60, { aliases: ['chicken thighs'] }],
  ['Firm tofu', 'protein_lean', 144, 15.8, 2.8, 8.7, 2.3, 70, { aliases: ['tofu', 'extra firm tofu', 'smoked tofu'] }],
  ['Tempeh', 'legume', 192, 20, 7.6, 11, 5, 55, {}],
  ['Salmon fillet', 'seafood', 208, 20, 0, 13, 0, 64, { aliases: ['salmon'], units: [['piece', 130]] }],
  ['Smoked salmon', 'seafood', 117, 18, 0, 4.3, 0, 70, {}],
  ['Prawns', 'seafood', 99, 24, 0.2, 0.3, 0, 77, { aliases: ['shrimp', 'king prawns'] }],
  ['Tuna in water', 'seafood', 116, 26, 0, 1, 0, 72, { aliases: ['canned tuna', 'tinned tuna'], units: [['can', 145]] }],
  ['Lean beef mince', 'protein_lean', 176, 26, 0, 7.5, 0, 66, { aliases: ['ground beef', 'lean ground beef', 'beef mince 5%'] }],
  ['Turkey mince', 'protein_lean', 158, 27, 0, 5, 0, 68, { aliases: ['ground turkey'] }],
  ['Egg', 'egg', 143, 12.6, 0.7, 9.5, 0, 76, { aliases: ['eggs', 'large egg'], units: [['piece', 58]] }],
  ['Egg white', 'egg', 52, 10.9, 0.7, 0.2, 0, 88, { aliases: ['egg whites'], units: [['piece', 33]] }],
  ['Bacon', 'processed_meat', 541, 37, 1.4, 42, 0, 25, { units: [['slice', 25]] }],
  ['Chorizo', 'processed_meat', 455, 24, 2, 38, 0, 32, {}],
  ['Whey protein powder', 'other', 380, 80, 8, 5, 2, 5, { aliases: ['protein powder', 'whey'], units: [['scoop', 30]] }],

  // ---- legumes ----
  ['Chickpeas', 'legume', 164, 8.9, 27, 2.6, 7.6, 60, { aliases: ['garbanzo beans', 'canned chickpeas'], units: [['can', 240]] }],
  ['Black beans', 'legume', 132, 8.9, 24, 0.5, 8.7, 66, { units: [['can', 240]] }],
  ['Cannellini beans', 'legume', 142, 9.7, 25, 0.5, 6.3, 63, { aliases: ['white beans', 'butter beans'], units: [['can', 240]] }],
  ['Red lentils', 'legume', 116, 9, 20, 0.4, 7.9, 70, { aliases: ['lentils', 'split red lentils'] }],
  ['Edamame', 'legume', 121, 12, 9, 5, 5, 70, {}],
  ['Hummus', 'legume', 166, 8, 14, 10, 6, 60, { units: [['tbsp', 15]] }],

  // ---- dairy ----
  ['Greek yogurt 0%', 'dairy_low_fat', 59, 10, 3.6, 0.4, 0, 85, { aliases: ['greek yogurt', 'greek yoghurt', 'low fat greek yoghurt', 'fat free greek yogurt'] }],
  ['Skyr', 'dairy_low_fat', 63, 11, 4, 0.2, 0, 84, { aliases: ['icelandic yogurt'] }],
  ['Cottage cheese', 'dairy_low_fat', 98, 11, 3.4, 4.3, 0, 79, { aliases: ['hüttenkäse'] }],
  ['Ricotta', 'dairy_full_fat', 138, 11, 5, 8, 0, 74, { aliases: ['part skim ricotta'] }],
  ['Feta', 'cheese', 264, 14, 4.1, 21, 0, 55, { aliases: ['feta cheese'] }],
  ['Parmesan', 'cheese', 392, 36, 3.2, 25, 0, 30, { aliases: ['parmigiano', 'grana padano'], units: [['tbsp', 5]] }],
  ['Mozzarella', 'cheese', 254, 24, 2.8, 16, 0, 50, { aliases: ['part skim mozzarella'] }],
  ['Halloumi', 'cheese', 321, 22, 2.2, 25, 0, 45, {}],
  ['Milk 1.5%', 'dairy_low_fat', 47, 3.4, 4.8, 1.5, 0, 89, { aliases: ['milk', 'semi skimmed milk'] }],
  ['Soy milk', 'other', 33, 3.3, 1.2, 1.8, 0.5, 92, { aliases: ['unsweetened soy milk', 'soya milk'] }],
  ['Creme fraiche', 'dairy_full_fat', 292, 2.4, 3, 30, 0, 62, { aliases: ['crème fraîche', 'sour cream'], units: [['tbsp', 15]] }],
  ['Light coconut milk', 'other', 73, 0.7, 2, 7, 0, 88, { aliases: ['coconut milk'], units: [['can', 400]] }],

  // ---- grains ----
  ['Rolled oats', 'whole_grain', 379, 13, 67, 6.5, 10, 8, { aliases: ['oats', 'porridge oats'], units: [['cup', 90]] }],
  ['Brown rice, cooked', 'whole_grain', 123, 2.7, 26, 1, 1.6, 68, { aliases: ['brown rice'] }],
  ['White rice, cooked', 'refined_grain', 130, 2.7, 28, 0.3, 0.4, 68, { aliases: ['rice', 'jasmine rice', 'white rice'] }],
  ['Quinoa, cooked', 'whole_grain', 120, 4.4, 21, 1.9, 2.8, 71, { aliases: ['quinoa'] }],
  ['Wholewheat pasta, cooked', 'whole_grain', 124, 5.3, 26, 0.5, 3.9, 65, { aliases: ['wholewheat pasta', 'whole grain pasta'] }],
  ['Pasta, cooked', 'refined_grain', 158, 5.8, 31, 0.9, 1.8, 62, { aliases: ['pasta', 'spaghetti', 'penne', 'linguine'] }],
  ['Udon noodles, cooked', 'refined_grain', 127, 4.2, 25, 0.2, 1.6, 70, { aliases: ['udon', 'udon noodles'] }],
  ['Sourdough bread', 'refined_grain', 260, 9, 50, 1.5, 2.4, 37, { units: [['slice', 45]] }],
  ['Wholegrain bread', 'whole_grain', 247, 11, 41, 3.4, 6.5, 38, { aliases: ['whole wheat bread', 'brown bread'], units: [['slice', 45]] }],
  ['Protein tortilla', 'refined_grain', 214, 21, 30, 5, 12, 30, { aliases: ['high protein wrap', 'protein wrap'], units: [['piece', 45]] }],
  ['Wholewheat tortilla', 'whole_grain', 297, 9, 47, 7, 6, 27, { aliases: ['tortilla', 'wrap'], units: [['piece', 62]] }],
  ['Corn tortilla', 'whole_grain', 218, 5.7, 45, 2.9, 5.2, 45, { units: [['piece', 26]] }],
  ['Couscous, cooked', 'refined_grain', 112, 3.8, 23, 0.2, 1.4, 72, { aliases: ['couscous'] }],
  ['Panko breadcrumbs', 'refined_grain', 375, 12, 72, 3, 4, 8, { aliases: ['breadcrumbs', 'panko'] }],
];

export const SEED_INGREDIENTS_A: Ingredient[] = ROWS.map(buildIngredient);
