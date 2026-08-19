import type { Recipe } from '@/lib/db/types';
import { buildRecipe } from './build';
import { SEEDS_A } from './recipes-a';
import { SEEDS_B } from './recipes-b';
import { SEEDS_C } from './recipes-c';

const ALL = [...SEEDS_A, ...SEEDS_B, ...SEEDS_C];

export const SEED_RECIPES: Recipe[] = ALL.map((s, i) => buildRecipe(s, ALL.length - i));
