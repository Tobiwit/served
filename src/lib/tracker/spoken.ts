import type { Ingredient } from '@/lib/db/types';
import { matchIngredient, type MatchCandidate } from '@/lib/match/fuzzy';
import { toGrams } from '@/lib/nutrition/units';

/**
 * Spoken (or typed) food lines, in English or German.
 *
 * Dictation does not arrive as tidy recipe lines. It arrives as "tofu 200 g", "olive
 * oil half a teaspoon", "200 Gramm Skyr und ein halber Teelöffel Honig" — quantity
 * before or after the name, numbers as digits or words, and often several items in
 * one breath with nothing between them. This turns that into amount, unit and name,
 * and resolves the name against the ingredient table.
 */

export type SpeechLang = 'en-US' | 'de-DE';

export interface SpokenItem {
  /** the words this came from, for display */
  spoken: string;
  name: string;
  amount: number | null;
  unit: string | null;
}

export type SpokenCommand = 'undo' | 'done';

/* ------------------------------------------------------------------ vocabulary */

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
  elf: 11, zwölf: 12, zwolf: 12, fünfzehn: 15, zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50,
};

/** "a", "ein" — one, but only if nothing more specific was said */
const ARTICLES = new Set(['a', 'an', 'ein', 'eine', 'einen', 'einem', 'einer']);

const MULTIPLIERS: Record<string, number> = { hundred: 100, hundert: 100, thousand: 1000, tausend: 1000 };

const FRACTIONS: Record<string, number> = {
  half: 0.5, halb: 0.5, halbe: 0.5, halben: 0.5, halber: 0.5, halbes: 0.5,
  quarter: 0.25, quarters: 0.25, viertel: 0.25,
  anderthalb: 1.5, eineinhalb: 1.5,
};

const GLYPHS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** spoken unit → the canonical unit `toGrams` understands */
const UNITS: Record<string, string> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramm: 'g', gramms: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilogramm: 'kg',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml',
  l: 'l', liter: 'l', litre: 'l', liters: 'l',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', esslöffel: 'tbsp', essloffel: 'tbsp', el: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', teelöffel: 'tsp', teeloffel: 'tsp', tl: 'tsp',
  cup: 'cup', cups: 'cup', tasse: 'cup', tassen: 'cup',
  piece: 'piece', pieces: 'piece', stück: 'piece', stuck: 'piece', stk: 'piece',
  slice: 'slice', slices: 'slice', scheibe: 'slice', scheiben: 'slice',
  clove: 'clove', cloves: 'clove', zehe: 'clove', zehen: 'clove',
  can: 'can', cans: 'can', tin: 'can', dose: 'can', dosen: 'can',
  handful: 'handful', handfuls: 'handful', handvoll: 'handful',
  pinch: 'pinch', prise: 'pinch',
  scoop: 'scoop', scoops: 'scoop', messlöffel: 'scoop', messloffel: 'scoop',
};

/** Words that carry no identity — dropped from names. */
const FILLER = new Set([
  'of', 'some', 'about', 'around', 'roughly', 'approximately', 'and', 'with', 'plus',
  'von', 'vom', 'etwas', 'ungefähr', 'ungefahr', 'circa', 'ca', 'zirka', 'und', 'mit', 'noch', 'dazu',
  'the', 'der', 'die', 'das', 'den', 'dem', 'des',
]);

const UNDO = /^(no|nope|nah|wrong|undo|delete|remove|scratch that|nein|falsch|löschen|loschen|zurück|zuruck|weg|streichen)\b/i;
const DONE = /^(done|finished|that's it|thats it|fertig|das wars|das war's|ende)\.?$/i;

/**
 * The ingredient table speaks English. Enough German food words to cover what gets
 * cooked here — anything missing still matches if it was saved under that name, and
 * creating it once adds the spoken word as an alias.
 */
const GERMAN: Record<string, string> = {
  olivenöl: 'olive oil', öl: 'oil', rapsöl: 'rapeseed oil', sonnenblumenöl: 'sunflower oil', sesamöl: 'sesame oil',
  hähnchen: 'chicken', hähnchenbrust: 'chicken breast', huhn: 'chicken', hühnchen: 'chicken', putenbrust: 'turkey breast',
  pute: 'turkey', hackfleisch: 'beef mince', rinderhack: 'beef mince', rind: 'beef', rindfleisch: 'beef',
  lachs: 'salmon', thunfisch: 'tuna', garnelen: 'prawns', ei: 'egg', eier: 'eggs', eiweiß: 'egg white',
  speck: 'bacon', schinken: 'ham', wurst: 'sausage',
  reis: 'rice', nudeln: 'pasta', spaghetti: 'spaghetti', haferflocken: 'oats', hafer: 'oats', brot: 'bread',
  vollkornbrot: 'wholemeal bread', toast: 'toast', brötchen: 'bread roll', kartoffel: 'potato', kartoffeln: 'potatoes',
  süßkartoffel: 'sweet potato', süßkartoffeln: 'sweet potato', mehl: 'flour', couscous: 'couscous', quinoa: 'quinoa',
  milch: 'milk', hafermilch: 'oat milk', sojamilch: 'soy milk', joghurt: 'yogurt', griechischer: 'greek',
  quark: 'quark', magerquark: 'quark', käse: 'cheese', butter: 'butter', sahne: 'cream', frischkäse: 'cream cheese',
  hüttenkäse: 'cottage cheese', mozzarella: 'mozzarella', parmesan: 'parmesan', feta: 'feta',
  zwiebel: 'onion', zwiebeln: 'onion', frühlingszwiebel: 'spring onion', knoblauch: 'garlic', ingwer: 'ginger',
  tomate: 'tomato', tomaten: 'tomatoes', paprika: 'bell pepper', gurke: 'cucumber', spinat: 'spinach',
  brokkoli: 'broccoli', blumenkohl: 'cauliflower', zucchini: 'courgette', karotte: 'carrot', karotten: 'carrots',
  möhre: 'carrot', möhren: 'carrots', pilze: 'mushrooms', champignons: 'mushrooms', salat: 'lettuce',
  kohl: 'cabbage', erbsen: 'peas', mais: 'sweetcorn', aubergine: 'aubergine', kürbis: 'pumpkin', avocado: 'avocado',
  linsen: 'lentils', kichererbsen: 'chickpeas', bohnen: 'beans', kidneybohnen: 'kidney beans',
  banane: 'banana', bananen: 'banana', apfel: 'apple', äpfel: 'apple', beeren: 'berries', heidelbeeren: 'blueberries',
  blaubeeren: 'blueberries', erdbeeren: 'strawberries', himbeeren: 'raspberries', zitrone: 'lemon', orange: 'orange',
  mandeln: 'almonds', walnüsse: 'walnuts', nüsse: 'nuts', erdnüsse: 'peanuts', erdnussbutter: 'peanut butter',
  cashews: 'cashews', chiasamen: 'chia seeds', leinsamen: 'flaxseed', sesam: 'sesame',
  honig: 'honey', zucker: 'sugar', ahornsirup: 'maple syrup', schokolade: 'chocolate', zartbitterschokolade: 'dark chocolate',
  kaffee: 'coffee', espresso: 'espresso', tee: 'tea', saft: 'juice', wasser: 'water',
  sojasoße: 'soy sauce', sojasauce: 'soy sauce', senf: 'mustard', ketchup: 'ketchup', mayonnaise: 'mayonnaise', mayo: 'mayonnaise',
  salz: 'salt', pfeffer: 'pepper', tofu: 'tofu', räuchertofu: 'smoked tofu', tempeh: 'tempeh',
  proteinpulver: 'protein powder', eiweißpulver: 'protein powder', whey: 'whey',
};

/* --------------------------------------------------------------------- parsing */

type Tok = { raw: string; low: string; kind: 'num' | 'article' | 'mult' | 'frac' | 'unit' | 'filler' | 'word'; value?: number };

function tokenize(text: string): Tok[] {
  const spaced = text
    // "200g", "1,5kg" → "200 g", "1,5 kg"
    .replace(/(\d)([a-zA-ZäöüÄÖÜß]+)/g, '$1 $2')
    .replace(/[.!?;:"“”„()]/g, ' ')
    .replace(/,(?!\d)/g, ' ');

  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const low = raw.toLowerCase();
      if (/^\d+([.,]\d+)?$/.test(low)) return { raw, low, kind: 'num', value: Number(low.replace(',', '.')) };
      if (/^\d+\/\d+$/.test(low)) {
        const [a, b] = low.split('/').map(Number);
        return { raw, low, kind: 'frac', value: b ? a / b : 0 };
      }
      if (GLYPHS[low] != null) return { raw, low, kind: 'frac', value: GLYPHS[low] };
      if (NUMBER_WORDS[low] != null) return { raw, low, kind: 'num', value: NUMBER_WORDS[low] };
      if (ARTICLES.has(low)) return { raw, low, kind: 'article', value: 1 };
      if (MULTIPLIERS[low] != null) return { raw, low, kind: 'mult', value: MULTIPLIERS[low] };
      if (FRACTIONS[low] != null) return { raw, low, kind: 'frac', value: FRACTIONS[low] };
      if (UNITS[low] != null) return { raw, low, kind: 'unit' };
      if (FILLER.has(low)) return { raw, low, kind: 'filler' };
      return { raw, low, kind: 'word' };
    });
}

/** Units of one letter only count right after a number — "l" alone is noise. */
function isQuantity(t: Tok, prev: Tok | undefined): boolean {
  if (t.kind === 'num' || t.kind === 'frac' || t.kind === 'mult') return true;
  if (t.kind === 'unit') return t.low.length > 2 || (prev != null && ['num', 'frac', 'mult', 'article'].includes(prev.kind));
  return false;
}

function readQuantity(tokens: Tok[]): { amount: number | null; unit: string | null } {
  let whole: number | null = null;
  let frac = 0;
  let article = false;
  let unit: string | null = null;

  for (const t of tokens) {
    if (t.kind === 'num') whole = (whole ?? 0) + (t.value ?? 0);
    else if (t.kind === 'mult') whole = (whole ?? 1) * (t.value ?? 1);
    else if (t.kind === 'article') article = true;
    else if (t.kind === 'frac') {
      // "three quarters" is three of them; "one and a half" is one plus one
      if ((t.low === 'quarters' || t.low === 'viertel') && whole != null && whole > 1) {
        whole = whole * (t.value ?? 0);
      } else frac += t.value ?? 0;
    } else if (t.kind === 'unit' && !unit) unit = UNITS[t.low];
  }

  let amount: number | null = whole != null || frac ? (whole ?? 0) + frac : article ? 1 : null;
  if (amount == null && unit) amount = 1;
  if (amount != null) amount = Math.round(amount * 1000) / 1000;
  return { amount, unit };
}

/**
 * One breath can hold several items with nothing between them: "tofu 200 g olive oil
 * half a teaspoon". Split into runs of quantity words and name words, then pair them
 * up in whichever order the first item used — name first means every item is
 * name-then-quantity, and the other way round.
 */
function splitRuns(tokens: Tok[]): Tok[][] {
  type Run = { q: boolean; toks: Tok[] };
  const runs: Run[] = [];
  tokens.forEach((t, i) => {
    if (t.kind === 'filler') {
      runs[runs.length - 1]?.toks.push(t);
      return;
    }
    // an article belongs with whatever follows it
    const q = t.kind === 'article' ? isQuantity(tokens[i + 1] ?? t, t) || tokens[i + 1]?.kind === 'frac' : isQuantity(t, tokens[i - 1]);
    const last = runs[runs.length - 1];
    if (last && last.q === q) last.toks.push(t);
    else runs.push({ q, toks: [t] });
  });

  const nameFirst = runs[0] && !runs[0].q;
  const items: Tok[][] = [];
  for (let i = 0; i < runs.length; ) {
    const a = runs[i];
    const b = runs[i + 1];
    // pair only a name with a quantity, in the order the first item set
    if (b && a.q !== b.q && a.q === !nameFirst) {
      items.push([...a.toks, ...b.toks]);
      i += 2;
    } else {
      items.push(a.toks);
      i += 1;
    }
  }
  // a quantity left on its own belongs to the item before it ("tofu, 200 g")
  const merged: Tok[][] = [];
  for (const toks of items) {
    const hasName = toks.some((t) => t.kind === 'word');
    if (!hasName && merged.length && !merged[merged.length - 1].some((t, i, a) => isQuantity(t, a[i - 1]))) {
      merged[merged.length - 1].push(...toks);
    } else merged.push(toks);
  }
  return merged;
}

/** Everything one final dictation result asked for, commands included, in order. */
export function parseUtterance(text: string): (SpokenItem | SpokenCommand)[] {
  const out: (SpokenItem | SpokenCommand)[] = [];
  let rest = text.trim();
  if (!rest) return out;

  if (DONE.test(rest)) return ['done'];
  const undo = rest.match(UNDO);
  if (undo) {
    out.push('undo');
    rest = rest.slice(undo[0].length).replace(/^[\s,.]+/, '');
    if (!rest) return out;
  }

  // explicit separators first; "and" only when it is not "one and a half"
  const chunks = rest
    .split(/[,;\n]|\s+(?:then|next|dann|danach|als nächstes)\s+|\s+(?:and|und)\s+(?!(?:a\s+)?(?:half|quarter)\b|halb|ein\s?halb)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    for (const toks of splitRuns(tokenize(chunk))) {
      const words = toks.filter((t) => t.kind === 'word').map((t) => t.raw);
      if (!words.length) continue;
      const { amount, unit } = readQuantity(toks.filter((t, i, a) => t.kind !== 'word' && (t.kind !== 'unit' || isQuantity(t, a[i - 1]))));
      out.push({
        spoken: toks.map((t) => t.raw).join(' '),
        name: words.join(' '),
        amount,
        unit,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------- resolving */

/** German words swapped for the English the ingredient table is written in. */
export function translateGerman(name: string): string {
  const low = name.toLowerCase();
  if (GERMAN[low]) return GERMAN[low];
  return low
    .split(/\s+/)
    .map((w) => GERMAN[w] ?? w)
    .join(' ');
}

/** Best guess at a database ingredient for a spoken name, trying it as said and in English. */
export function findIngredient(name: string, ingredients: Ingredient[]): MatchCandidate | null {
  const asSaid = matchIngredient(name, ingredients);
  const english = translateGerman(name);
  const translated = english !== name.toLowerCase() ? matchIngredient(english, ingredients) : null;

  const best = [asSaid, translated]
    .filter((m): m is NonNullable<typeof m> => m != null && m.status !== 'none' && m.best != null)
    .sort((a, b) => b.best!.score - a.best!.score)[0];
  return best?.best ?? null;
}

/**
 * Grams for a spoken amount. A bare count ("two eggs") is pieces; if the ingredient
 * has no idea what a piece weighs, the grams stay unknown and the row asks for them.
 */
export function gramsFor(amount: number | null, unit: string | null, ingredient: Ingredient | null): number | null {
  if (amount == null) return null;
  const grams = toGrams(amount, unit ?? 'piece', ingredient);
  return grams != null && grams > 0 ? grams : null;
}
