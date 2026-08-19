import type { Ingredient } from '@/lib/db/types';
import { SEED_INGREDIENTS_A } from './ingredients';
import { SEED_INGREDIENTS_B } from './ingredients-b';
import { SEED_INGREDIENTS_C } from './ingredients-c';

export const SEED_INGREDIENTS: Ingredient[] = [
  ...SEED_INGREDIENTS_A,
  ...SEED_INGREDIENTS_B,
  ...SEED_INGREDIENTS_C,
];

export { SEED_RECIPES } from './recipes';
