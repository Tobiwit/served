import type { Ingredient } from '@/lib/db/types';

/**
 * Fuzzy ingredient matching.
 *
 * Matches pasted text against canonical names and aliases. The important property
 * is not the hit rate — it is that an uncertain match is never silently accepted.
 * Anything below `CONFIRM` comes back as `needs-confirmation` and the UI must ask.
 */

export const THRESHOLD = {
  /** at or above this, the match is safe to pre-accept (still shown) */
  ACCEPT: 0.86,
  /** at or above this, offer it but require confirmation */
  CONFIRM: 0.5,
};

/** Words that describe preparation, not identity. */
const DESCRIPTORS = new Set([
  'fresh',
  'freshly',
  'chopped',
  'finely',
  'roughly',
  'thinly',
  'diced',
  'sliced',
  'grated',
  'minced',
  'crushed',
  'peeled',
  'drained',
  'rinsed',
  'cooked',
  'raw',
  'ground',
  'whole',
  'large',
  'small',
  'medium',
  'ripe',
  'organic',
  'boneless',
  'skinless',
  'optional',
  'good',
  'quality',
  'plus',
  'extra',
  'about',
  'approx',
  'torn',
  'halved',
  'quartered',
  'cubed',
  'shredded',
  'toasted',
  'de',
  'of',
  'the',
  'a',
  'an',
  'to',
  'taste',
  'serve',
  'serving',
  'garnish',
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalised, with preparation words removed. Falls back to the full string. */
export function coreTerms(s: string): string {
  const tokens = normalize(s)
    .split(' ')
    .filter((t) => t.length > 1 && !DESCRIPTORS.has(t));
  return tokens.length ? tokens.join(' ') : normalize(s);
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Dice coefficient over character trigrams. */
function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = trigrams(a);
  const B = trigrams(b);
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return (2 * shared) / (A.size + B.size);
}

/** Token containment — "low fat greek yoghurt" vs "greek yogurt 0%". */
function tokenScore(a: string, b: string): number {
  const A = a.split(' ').filter(Boolean);
  const B = b.split(' ').filter(Boolean);
  if (!A.length || !B.length) return 0;
  const setB = new Set(B);
  const hits = A.filter((t) => setB.has(t)).length;
  return hits / Math.max(A.length, B.length);
}

function similarity(query: string, target: string): number {
  const d = dice(query, target);
  const t = tokenScore(query, target);
  let score = Math.max(d, t * 0.94, (d + t) / 2);
  // whole-word containment is a strong signal in food names
  if (target.includes(query) || query.includes(target)) score = Math.max(score, 0.82);
  if (query === target) score = 1;
  return score;
}

export interface MatchCandidate {
  ingredient: Ingredient;
  score: number;
  /** which string actually matched */
  via: string;
}

export interface MatchResult {
  query: string;
  status: 'accepted' | 'needs-confirmation' | 'none';
  best: MatchCandidate | null;
  alternatives: MatchCandidate[];
}

export function matchIngredient(raw: string, ingredients: Ingredient[], limit = 4): MatchResult {
  const query = coreTerms(raw);
  const scored: MatchCandidate[] = [];

  for (const ingredient of ingredients) {
    let best = 0;
    let via = ingredient.name;
    for (const target of [ingredient.search_name, ...ingredient.aliases.map(normalize)]) {
      const s = similarity(query, coreTerms(target));
      if (s > best) {
        best = s;
        via = target;
      }
    }
    if (best > 0.25) scored.push({ ingredient, score: best, via });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] ?? null;

  const status: MatchResult['status'] = !best
    ? 'none'
    : best.score >= THRESHOLD.ACCEPT
      ? 'accepted'
      : best.score >= THRESHOLD.CONFIRM
        ? 'needs-confirmation'
        : 'none';

  return {
    query: raw,
    status,
    best: status === 'none' ? null : best,
    alternatives: scored.slice(0, limit),
  };
}

/** Plain substring search for the manual "search ingredient" path. */
export function searchIngredients(query: string, ingredients: Ingredient[], limit = 20): Ingredient[] {
  const q = normalize(query);
  if (!q) return ingredients.slice(0, limit);
  return ingredients
    .map((i) => ({ i, s: similarity(q, i.search_name) }))
    .filter((x) => x.s > 0.3 || x.i.search_name.includes(q))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.i);
}
