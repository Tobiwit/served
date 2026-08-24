import type { Ingredient, Recipe } from '@/lib/db/types';
import { buildContext, PRODUCE, PROCESSED, ramp, SALTY, SATURATED_NEUTRAL, type ScoreContext } from './context';

/**
 * Health Score. An explicit, tunable heuristic, not a medical claim.
 *
 * Tuned for gym-oriented everyday eating: protein density, fibre, real produce and
 * whole foods carry most of the upside (up to +58 between them) while low calorie
 * density can contribute at most +7. A 90 kcal bowl of nothing will not outrank a
 * 620 kcal plate of chicken, lentils and vegetables, which is the entire point.
 *
 * Protein, fibre and calorie density are read from the summed macros. Produce, whole
 * food, added sugar and salt are read from ingredient categories, because no macro
 * distinguishes a lentil from a lozenge. Fat is the one term that needs both: the
 * category says what kind of fat it is, the grams say how much.
 */

export const HEALTH_CONFIG = {
  base: 40,
  // each ramp crosses zero at a deliberately ordinary value, so a merely fine meal
  // lands near the base and only a genuinely strong one climbs
  proteinDensity: { lo: 2.2, hi: 10.5, min: -7, max: 16 },
  fiber: { lo: 2.5, hi: 15, min: -6, max: 12 },
  produce: { lo: 0.06, hi: 0.55, min: -3, max: 14 },
  wholeFood: { lo: 0.4, hi: 0.99, min: -10, max: 6 },
  lightDensity: { lo: 175, hi: 85, min: 0, max: 5 },
  heavyDensity: { lo: 200, hi: 380, min: 0, max: -16 },
  /**
   * Fat is judged on how much of it is saturated, and only as loudly as there is fat
   * to judge: `quiet` to `loud` grams per serving fades the whole term in, so a dish
   * with a smear of butter is not marked as if it were fried in it.
   */
  fatQuality: { quiet: 2, loud: 10, min: -7, max: 5 },
  addedSugar: { lo: 0.012, hi: 0.1, min: 0, max: -12 },
  // salt is a preference as much as a health signal, and this one is a blunt
  // category proxy rather than a sodium figure — it should not swing a score
  sodium: { lo: 0.035, hi: 0.16, min: 0, max: -3 },
};

export interface ScoreFactor {
  label: string;
  delta: number;
}

export interface ScoreResult {
  score: number;
  verdict: string;
  positives: ScoreFactor[];
  negatives: ScoreFactor[];
  /** confidence in the underlying nutrition data, 0..1 */
  confidence: number;
}

export function healthScore(recipe: Recipe, index: Map<string, Ingredient>): ScoreResult {
  return healthScoreFromContext(buildContext(recipe, index));
}

export function healthScoreFromContext(ctx: ScoreContext): ScoreResult {
  const c = HEALTH_CONFIG;
  const f: ScoreFactor[] = [];

  const pd = ctx.proteinDensity;
  if (pd != null) {
    const d = ramp(pd, c.proteinDensity.lo, c.proteinDensity.hi, c.proteinDensity.min, c.proteinDensity.max);
    f.push({ label: d >= 10 ? 'High protein' : d >= 3 ? 'Good protein' : 'Low protein for the calories', delta: d });
  }

  const fib = ctx.fiberPerServing;
  if (fib != null) {
    const d = ramp(fib, c.fiber.lo, c.fiber.hi, c.fiber.min, c.fiber.max);
    f.push({ label: d >= 8 ? 'High fibre' : d >= 2 ? 'Decent fibre' : 'Little fibre', delta: d });
  }

  const produce = ctx.fraction(PRODUCE);
  f.push({
    label:
      produce >= 0.35 ? 'Lots of vegetables and legumes' : produce >= 0.18 ? 'Some vegetables' : 'Very little produce',
    delta: ramp(produce, c.produce.lo, c.produce.hi, c.produce.min, c.produce.max),
  });

  const whole = 1 - ctx.fraction(PROCESSED);
  f.push({
    label: whole >= 0.9 ? 'Minimally processed' : whole >= 0.75 ? 'Mostly whole foods' : 'Noticeably processed',
    delta: ramp(whole, c.wholeFood.lo, c.wholeFood.hi, c.wholeFood.min, c.wholeFood.max),
  });

  const cd = ctx.calorieDensity;
  if (cd != null) {
    const light = ramp(cd, c.lightDensity.lo, c.lightDensity.hi, c.lightDensity.min, c.lightDensity.max);
    const heavy = ramp(cd, c.heavyDensity.lo, c.heavyDensity.hi, c.heavyDensity.min, c.heavyDensity.max);
    if (light > 0.5) f.push({ label: 'Reasonable calorie density', delta: light });
    if (heavy < -0.5) f.push({ label: 'Very calorie dense', delta: heavy });
  }

  /**
   * Fat quality, weighted by the fat that is actually there.
   *
   * `quality` runs +1 (nothing saturated) through 0 (a third of the fat, about where
   * an ordinary mixed diet sits) to -1 (two thirds), and `presence` fades the whole
   * judgement in with the grams. The two together are what stop a light mozzarella
   * being scored as harshly as a mascarpone, which the old mass-fraction version did.
   */
  if (ctx.saturatedShare != null && ctx.fatPerServing != null) {
    const quality = Math.max(-1, Math.min(1, (SATURATED_NEUTRAL - ctx.saturatedShare) / SATURATED_NEUTRAL));
    const presence = ramp(ctx.fatPerServing, c.fatQuality.quiet, c.fatQuality.loud, 0, 1);
    const fatDelta = quality * presence * (quality > 0 ? c.fatQuality.max : -c.fatQuality.min);
    if (Math.abs(fatDelta) > 1.2) {
      f.push({ label: fatDelta > 0 ? 'Mostly unsaturated fats' : 'High in saturated fat', delta: fatDelta });
    }
  }

  const sugar = ctx.fraction(['sweetener']);
  const sugarDelta = ramp(sugar, c.addedSugar.lo, c.addedSugar.hi, c.addedSugar.min, c.addedSugar.max);
  if (sugarDelta < -1) f.push({ label: 'Added sugar', delta: sugarDelta });

  const salt = ctx.fraction(SALTY);
  const saltDelta = ramp(salt, c.sodium.lo, c.sodium.hi, c.sodium.min, c.sodium.max);
  if (saltDelta < -1) f.push({ label: 'Salty components', delta: saltDelta });

  const raw = c.base + f.reduce((a, x) => a + x.delta, 0);
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  const meaningful = f.filter((x) => Math.abs(x.delta) >= 1.2);
  return {
    score,
    verdict: healthVerdict(score),
    positives: meaningful.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta),
    negatives: meaningful.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta),
    confidence: ctx.nutrition.completeness,
  };
}

export function healthVerdict(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Solid';
  if (score >= 40) return 'Middling';
  return 'Indulgent';
}
