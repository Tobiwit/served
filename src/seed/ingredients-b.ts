import type { Ingredient } from '@/lib/db/types';
import { buildIngredient, type SeedRow } from './build';

/** Produce, fats, and pantry. Part two of the starter ingredient database. */
const ROWS: SeedRow[] = [
  // ---- vegetables ----
  ['Broccoli', 'vegetable', 35, 2.8, 7, 0.4, 3.3, 89, { aliases: ['tenderstem broccoli'] }],
  ['Spinach', 'vegetable', 23, 2.9, 3.6, 0.4, 2.2, 91, { aliases: ['baby spinach'] }],
  ['Rocket', 'vegetable', 25, 2.6, 3.7, 0.7, 1.6, 92, { aliases: ['arugula', 'rucola'] }],
  ['Romaine lettuce', 'vegetable', 17, 1.2, 3.3, 0.3, 2.1, 95, { aliases: ['lettuce', 'cos lettuce', 'romaine'] }],
  ['Kale', 'vegetable', 35, 2.9, 4.4, 1.5, 4.1, 90, { aliases: ['cavolo nero'] }],
  ['Cherry tomatoes', 'vegetable', 18, 0.9, 3.9, 0.2, 1.2, 94, { aliases: ['tomatoes', 'tomato'] }],
  ['Cucumber', 'vegetable', 15, 0.7, 3.6, 0.1, 0.5, 95, { units: [['piece', 300]] }],
  ['Red pepper', 'vegetable', 31, 1, 6, 0.3, 2.1, 92, { aliases: ['bell pepper', 'red bell pepper', 'capsicum'], units: [['piece', 150]] }],
  ['Courgette', 'vegetable', 17, 1.2, 3.1, 0.3, 1, 95, { aliases: ['zucchini'], units: [['piece', 200]] }],
  ['Aubergine', 'vegetable', 25, 1, 6, 0.2, 3, 92, { aliases: ['eggplant'], units: [['piece', 300]] }],
  ['Mushrooms', 'vegetable', 22, 3.1, 3.3, 0.3, 1, 92, { aliases: ['champignons', 'cremini', 'chestnut mushrooms', 'button mushrooms'] }],
  ['Shiitake mushrooms', 'vegetable', 34, 2.2, 6.8, 0.5, 2.5, 90, { aliases: ['shiitake'] }],
  ['Red onion', 'vegetable', 40, 1.1, 9.3, 0.1, 1.7, 89, { units: [['piece', 110]] }],
  ['Onion', 'vegetable', 40, 1.1, 9.3, 0.1, 1.7, 89, { aliases: ['brown onion', 'yellow onion'], units: [['piece', 110]] }],
  ['Spring onion', 'vegetable', 32, 1.8, 7.3, 0.2, 2.6, 90, { aliases: ['scallion', 'scallions', 'green onion'], units: [['piece', 15]] }],
  ['Carrot', 'vegetable', 41, 0.9, 10, 0.2, 2.8, 88, { units: [['piece', 70]] }],
  ['White cabbage', 'vegetable', 25, 1.3, 5.8, 0.1, 2.5, 92, { aliases: ['cabbage'] }],
  ['Red cabbage', 'vegetable', 31, 1.4, 7.4, 0.2, 2.1, 90, {}],
  ['Cauliflower', 'vegetable', 25, 1.9, 5, 0.3, 2, 92, {}],
  ['Green beans', 'vegetable', 31, 1.8, 7, 0.1, 2.7, 90, {}],
  ['Peas', 'vegetable', 81, 5.4, 14, 0.4, 5.7, 79, { aliases: ['frozen peas', 'garden peas'] }],
  ['Sweetcorn', 'vegetable', 86, 3.2, 19, 1.2, 2.7, 76, { aliases: ['corn'] }],
  ['Asparagus', 'vegetable', 20, 2.2, 3.9, 0.1, 2.1, 93, {}],
  ['Pak choi', 'vegetable', 13, 1.5, 2.2, 0.2, 1, 95, { aliases: ['bok choy', 'chinese cabbage'] }],
  ['Sweet potato', 'vegetable', 90, 2, 21, 0.1, 3.3, 76, { units: [['piece', 200]] }],
  ['Potato', 'vegetable', 87, 2, 20, 0.1, 1.8, 77, { units: [['piece', 170]] }],
  ['Butternut squash', 'vegetable', 45, 1, 12, 0.1, 2, 86, { aliases: ['squash'] }],
  ['Beetroot', 'vegetable', 43, 1.6, 10, 0.2, 2.8, 88, {}],
  ['Kimchi', 'vegetable', 23, 1.7, 4, 0.5, 1.6, 90, {}],
  ['Chopped tomatoes', 'vegetable', 32, 1.6, 5.4, 0.3, 1.4, 92, { aliases: ['canned tomatoes', 'tinned tomatoes', 'crushed tomatoes'], units: [['can', 400]] }],
  ['Passata', 'vegetable', 34, 1.6, 6.5, 0.3, 1.6, 89, { aliases: ['tomato passata', 'tomato sauce'] }],

  // ---- fruit ----
  ['Avocado', 'fruit', 160, 2, 9, 15, 7, 73, { units: [['piece', 140]] }],
  ['Lemon', 'fruit', 29, 1.1, 9, 0.3, 2.8, 89, { units: [['piece', 60]] }],
  ['Lime', 'fruit', 30, 0.7, 11, 0.2, 2.8, 88, { units: [['piece', 55]] }],
  ['Banana', 'fruit', 89, 1.1, 23, 0.3, 2.6, 75, { units: [['piece', 118]] }],
  ['Blueberries', 'fruit', 57, 0.7, 14, 0.3, 2.4, 84, {}],
  ['Strawberries', 'fruit', 32, 0.7, 7.7, 0.3, 2, 91, {}],
  ['Raspberries', 'fruit', 52, 1.2, 12, 0.7, 6.5, 86, {}],
  ['Apple', 'fruit', 52, 0.3, 14, 0.2, 2.4, 86, { units: [['piece', 180]] }],
  ['Mango', 'fruit', 60, 0.8, 15, 0.4, 1.6, 83, {}],
  ['Pomegranate seeds', 'fruit', 83, 1.7, 19, 1.2, 4, 78, {}],

  // ---- fats, nuts, seeds ----
  ['Olive oil', 'oil', 884, 0, 0, 100, 0, 0, { basic: true, aliases: ['extra virgin olive oil'], units: [['tbsp', 13.5], ['tsp', 4.5]] }],
  ['Rapeseed oil', 'oil', 884, 0, 0, 100, 0, 0, { basic: true, aliases: ['canola oil', 'vegetable oil', 'neutral oil', 'sunflower oil'], units: [['tbsp', 13.5], ['tsp', 4.5]] }],
  ['Sesame oil', 'oil', 884, 0, 0, 100, 0, 0, { basic: true, units: [['tbsp', 13.5], ['tsp', 4.5]] }],
  ['Butter', 'fat_solid', 717, 0.9, 0.1, 81, 0, 16, { units: [['tbsp', 14]] }],
  ['Almonds', 'nuts_seeds', 579, 21, 22, 50, 12.5, 4, {}],
  ['Walnuts', 'nuts_seeds', 654, 15, 14, 65, 6.7, 4, {}],
  ['Cashews', 'nuts_seeds', 553, 18, 30, 44, 3.3, 5, {}],
  ['Peanut butter', 'nuts_seeds', 588, 25, 20, 50, 6, 1, { units: [['tbsp', 16]] }],
  ['Tahini', 'nuts_seeds', 595, 17, 21, 54, 9.3, 3, { units: [['tbsp', 15]] }],
  ['Chia seeds', 'nuts_seeds', 486, 17, 42, 31, 34, 6, { units: [['tbsp', 12]] }],
  ['Sesame seeds', 'nuts_seeds', 573, 18, 23, 50, 12, 5, { units: [['tbsp', 9]] }],
  ['Pumpkin seeds', 'nuts_seeds', 559, 30, 11, 49, 6, 5, { units: [['tbsp', 10]] }],
];

export const SEED_INGREDIENTS_B: Ingredient[] = ROWS.map(buildIngredient);
