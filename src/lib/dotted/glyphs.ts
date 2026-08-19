/**
 * Dotted numerals.
 *
 * Digits are defined as thin geometric strokes (lines + elliptical arcs) inside a
 * 10 x 16 box, then resampled at even arc-length intervals into dots. This traces
 * the *outline of a numeral* rather than lighting up a blocky 5x7 matrix, which is
 * what gives the references their instrument-panel feel.
 *
 * Pure math — no DOM measurement — so it renders identically on server and client.
 */

export const GLYPH_W = 10;
export const GLYPH_H = 16;

type Stroke =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { k: 'arc'; cx: number; cy: number; rx: number; ry: number; a0: number; a1: number }
  | { k: 'dot'; x: number; y: number };

const L = (x1: number, y1: number, x2: number, y2: number): Stroke => ({ k: 'line', x1, y1, x2, y2 });
const A = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Stroke => ({
  k: 'arc',
  cx,
  cy,
  rx,
  ry,
  a0,
  a1,
});

const GLYPHS: Record<string, Stroke[]> = {
  '0': [A(5, 8, 3.9, 7, 0, 360)],
  '1': [L(5.7, 1, 5.7, 15), L(3.1, 3.4, 5.7, 1)],
  '2': [A(5, 5, 3.8, 4, 180, 380), L(8.5, 6.4, 1.3, 15), L(1.3, 15, 9.1, 15)],
  '3': [A(5.1, 4.6, 3.6, 3.6, 200, 450), A(5.1, 11.2, 3.9, 3.9, 270, 520)],
  '4': [L(7.3, 1, 0.9, 11.5), L(0.9, 11.5, 9.4, 11.5), L(7.3, 1, 7.3, 15)],
  '5': [L(8.6, 1.2, 3.2, 1.2), L(3.2, 1.2, 3.0, 6.5), A(5.2, 10.5, 4, 4.3, 250, 510)],
  '6': [A(5.6, 8.6, 4.4, 7.4, 290, 180), A(5.2, 10.9, 3.9, 4.1, 0, 360)],
  '7': [L(1.1, 1.3, 9, 1.3), L(9, 1.3, 3.5, 15)],
  '8': [A(5, 4.5, 3.5, 3.5, 0, 360), A(5, 11.3, 4.1, 4, 0, 360)],
  '9': [A(5, 5.4, 3.9, 4.1, 0, 360), A(4.6, 7.6, 4.3, 7.4, 110, 0)],
  '.': [{ k: 'dot', x: 5, y: 14.4 }],
  ',': [{ k: 'dot', x: 5, y: 14.4 }],
  '-': [L(1.4, 8, 8.6, 8)],
  '−': [L(1.4, 8, 8.6, 8)],
  '+': [L(1.4, 8, 8.6, 8), L(5, 4.4, 5, 11.6)],
  '/': [L(8.2, 1, 1.8, 15)],
  ':': [
    { k: 'dot', x: 5, y: 5.4 },
    { k: 'dot', x: 5, y: 12 },
  ],
  '?': [A(5, 5, 3.2, 3.4, 180, 380), L(7.6, 6.4, 5, 10.4), { k: 'dot', x: 5, y: 14.4 }],
};

export type Dot = { x: number; y: number };

/**
 * Quantise to 3dp. Math.sin/cos are not required to be correctly rounded, so Node
 * and the browser can disagree in the last ULP — which shows up as a React
 * hydration mismatch on every dot. Rounding makes the geometry reproducible.
 */
const q = (x: number, y: number): Dot => ({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });

const rad = (deg: number) => (deg * Math.PI) / 180;

function sampleLine(s: Extract<Stroke, { k: 'line' }>, spacing: number): Dot[] {
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
  const n = Math.max(1, Math.round(len / spacing));
  const out: Dot[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(q(s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t));
  }
  return out;
}

function sampleArc(s: Extract<Stroke, { k: 'arc' }>, spacing: number): Dot[] {
  const STEPS = 480;
  const closed = Math.abs(s.a1 - s.a0) >= 359.5;
  const pts: Dot[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= STEPS; i++) {
    const a = rad(s.a0 + ((s.a1 - s.a0) * i) / STEPS);
    const p = { x: s.cx + s.rx * Math.cos(a), y: s.cy + s.ry * Math.sin(a) };
    pts.push(p);
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];
  const n = Math.max(2, Math.round(total / spacing));
  const out: Dot[] = [];
  const last = closed ? n - 1 : n;
  let cursor = 0;
  for (let i = 0; i <= last; i++) {
    const target = (total * i) / n;
    while (cursor < STEPS && cum[cursor + 1] < target) cursor++;
    const span = cum[cursor + 1] - cum[cursor] || 1;
    const t = (target - cum[cursor]) / span;
    const a = pts[cursor];
    const b = pts[Math.min(cursor + 1, STEPS)];
    out.push(q(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
  }
  return out;
}

/** Dots for a single character, in the 10x16 glyph box. */
export function glyphDots(ch: string, spacing = 1.2): Dot[] {
  const strokes = GLYPHS[ch];
  if (!strokes) return [];
  const out: Dot[] = [];
  for (const s of strokes) {
    if (s.k === 'dot') out.push({ x: s.x, y: s.y });
    else if (s.k === 'line') out.push(...sampleLine(s, spacing));
    else out.push(...sampleArc(s, spacing));
  }
  return out;
}

const NARROW: Record<string, number> = { '.': 0.42, ',': 0.42, ':': 0.42, '1': 0.72, '-': 0.7, '−': 0.7 };

/** Advance width of a character, as a multiple of GLYPH_W. */
export function glyphAdvance(ch: string): number {
  return NARROW[ch] ?? 1;
}

export type PlacedDot = Dot & { i: number };

/** Lay out a whole string. Returns dots in glyph-space plus the total width. */
export function textDots(text: string, spacing = 1.2, tracking = 1.6): { dots: PlacedDot[]; width: number } {
  let x = 0;
  const dots: PlacedDot[] = [];
  let i = 0;
  for (const ch of text) {
    if (ch === ' ') {
      x += GLYPH_W * 0.45 + tracking;
      continue;
    }
    const adv = glyphAdvance(ch);
    const local = glyphDots(ch, spacing);
    // narrow glyphs are drawn inside the full box, so centre their actual ink
    // inside the narrower advance instead of leaving them floating right
    let shift = 0;
    if (adv < 1 && local.length) {
      const lo = Math.min(...local.map((d) => d.x));
      const hi = Math.max(...local.map((d) => d.x));
      shift = (GLYPH_W * adv) / 2 - (lo + hi) / 2;
    }
    for (const d of local) {
      const p = q(x + d.x + shift, d.y);
      dots.push({ x: p.x, y: p.y, i: i++ });
    }
    x += GLYPH_W * adv + tracking;
  }
  return { dots, width: Math.max(0, x - tracking) };
}
