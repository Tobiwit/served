import type { Ingredient, Recipe } from '@/lib/db/types';
import { buildContext } from './context';
import { healthScoreFromContext, type ScoreResult } from './health';
import { volumeScoreFromContext } from './volume';
import { computeNutrition, type NutritionResult } from '@/lib/nutrition/calc';

export type { ScoreResult, ScoreFactor } from './health';
export { HEALTH_CONFIG, healthVerdict } from './health';
export { VOLUME_CONFIG } from './volume';
export { volumeVerdict } from './verdicts';

export interface RecipeAnalysis {
  nutrition: NutritionResult;
  health: ScoreResult;
  volume: ScoreResult;
  gramsPerServing: number;
}

/** One pass over the recipe yields nutrition and both scores. */
export function analyzeRecipe(recipe: Recipe, index: Map<string, Ingredient>): RecipeAnalysis {
  const ctx = buildContext(recipe, index);
  return {
    nutrition: ctx.nutrition,
    health: healthScoreFromContext(ctx),
    volume: volumeScoreFromContext(ctx),
    gramsPerServing: ctx.gramsPerServing,
  };
}

export { computeNutrition };
