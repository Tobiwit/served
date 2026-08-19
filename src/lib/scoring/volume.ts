import type { Ingredient, Recipe } from '@/lib/db/types';
import { buildContext, ramp, type ScoreContext } from './context';
import type { ScoreFactor, ScoreResult } from './health';
import { volumeVerdict } from './verdicts';

/**
 * Volume Score. How much actual food arrives, relative to its calories.
 *
 * Two blended halves, kept separate so they can be retuned independently:
 *   physical bulk    65%  total grams, calorie density, water-rich composition
 *   satiety support  35%  protein, fibre, and again sheer mass
 *
 * A large soup and a small brownie can share a calorie count. Only one of them
 * should score here.
 */

export const VOLUME_CONFIG = {
  bulkWeight: 0.65,
  satietyWeight: 0.35,
  bulk: {
    mass: { w: 0.38, lo: 180, hi: 620 },
    density: { w: 0.4, lo: 240, hi: 60 },
    water: { w: 0.22, lo: 0.4, hi: 0.86 },
  },
  satiety: {
    protein: { w: 0.45, lo: 2, hi: 10 },
    fiber: { w: 0.37, lo: 2, hi: 14 },
    mass: { w: 0.18, lo: 200, hi: 550 },
  },
};

export function volumeScore(recipe: Recipe, index: Map<string, Ingredient>): ScoreResult {
  return volumeScoreFromContext(buildContext(recipe, index));
}

export function volumeScoreFromContext(ctx: ScoreContext): ScoreResult {
  const c = VOLUME_CONFIG;
  const g = ctx.gramsPerServing;
  const cd = ctx.calorieDensity ?? 180;
  const pd = ctx.proteinDensity ?? 3;
  const fib = ctx.fiberPerServing ?? 3;

  const bulk =
    ramp(g, c.bulk.mass.lo, c.bulk.mass.hi, 0, 100) * c.bulk.mass.w +
    ramp(cd, c.bulk.density.lo, c.bulk.density.hi, 0, 100) * c.bulk.density.w +
    ramp(ctx.waterFraction, c.bulk.water.lo, c.bulk.water.hi, 0, 100) * c.bulk.water.w;

  const satiety =
    ramp(pd, c.satiety.protein.lo, c.satiety.protein.hi, 0, 100) * c.satiety.protein.w +
    ramp(fib, c.satiety.fiber.lo, c.satiety.fiber.hi, 0, 100) * c.satiety.fiber.w +
    ramp(g, c.satiety.mass.lo, c.satiety.mass.hi, 0, 100) * c.satiety.mass.w;

  const score = Math.round(Math.min(100, Math.max(0, bulk * c.bulkWeight + satiety * c.satietyWeight)));

  const positives: ScoreFactor[] = [];
  const negatives: ScoreFactor[] = [];

  if (g >= 420) positives.push({ label: `Large portion, ${Math.round(g)} g`, delta: 1 });
  else negatives.push({ label: `Modest portion, ${Math.round(g)} g`, delta: -1 });

  if (cd <= 140) positives.push({ label: `Low calorie density, ${Math.round(cd)} kcal/100g`, delta: 1 });
  else if (cd >= 220) negatives.push({ label: `Calorie dense, ${Math.round(cd)} kcal/100g`, delta: -1 });

  if (ctx.waterFraction >= 0.7) positives.push({ label: 'Water-rich ingredients', delta: 1 });
  if (pd >= 6) positives.push({ label: 'Protein supports fullness', delta: 1 });
  if (fib >= 8) positives.push({ label: 'High fibre', delta: 1 });
  else if (fib < 3) negatives.push({ label: 'Low fibre', delta: -1 });

  return { score, verdict: volumeVerdict(score), positives, negatives, confidence: ctx.nutrition.completeness };
}

export { volumeVerdict };
