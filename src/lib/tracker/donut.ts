/**
 * Geometry for the half-donut menu.
 *
 * One segment of a ring between two angles, with a constant-width gap to its
 * neighbours and rounded corners. The inner edge is an arc around the button; the
 * outer edge bows out only part of the way a circle would, so the menu reads as
 * something between a cut polygon and a pie. Angles are in degrees, 0 pointing right and
 * increasing clockwise on screen (y grows downward), so -90..90 is the right half.
 *
 * The gap is taken as a fixed distance, not a fixed angle: an angular gap would be
 * a hairline at the inner edge and a canyon at the outer one.
 */

const rad = (d: number) => (d * Math.PI) / 180;

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const f = (n: number) => Math.round(n * 100) / 100;
const pt = ([x, y]: [number, number]) => `${f(x)} ${f(y)}`;

/** a point `d` px from `from` towards `to` */
function toward(from: [number, number], to: [number, number], d: number): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [from[0] + (dx / len) * d, from[1] + (dy / len) * d];
}

export function sectorPath({
  cx,
  cy,
  inner,
  outer,
  from,
  to,
  gap = 6,
  corner = 10,
  innerCorner = corner,
  bulge = 0.5,
}: {
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  from: number;
  to: number;
  gap?: number;
  /** radius of the two outer corners */
  corner?: number;
  /** radius of the two corners against the button, where segments are narrowest */
  innerCorner?: number;
  /** how far the outer edge bows out: 0 is a straight cut, 1 follows the circle */
  bulge?: number;
}): string {
  const padAt = (r: number) => Math.asin(Math.min(1, gap / 2 / r));
  const a0 = rad(from);
  const a1 = rad(to);

  const ao0 = a0 + padAt(outer);
  const ao1 = a1 - padAt(outer);
  const ai0 = a0 + padAt(inner);
  const ai1 = a1 - padAt(inner);

  // corners can never be rounder than the segment is thick, or wide at that edge
  const thick = (outer - inner) / 2 - 0.5;
  const co = Math.max(0, Math.min(corner, thick, Math.sin((ao1 - ao0) / 2) * outer - 0.5));
  const cin = Math.max(0, Math.min(innerCorner, thick, ((ai1 - ai0) * inner) / 2 - 0.5));
  const ci = cin / inner;

  const O0 = polar(cx, cy, outer, ao0);
  const O1 = polar(cx, cy, outer, ao1);
  const I0 = polar(cx, cy, inner, ai0);
  const I1 = polar(cx, cy, inner, ai1);

  const largeInner = ai1 - ai0 - 2 * ci > Math.PI ? 1 : 0;

  /**
   * The outer edge is an arc through the two corners, flatter than the ring itself:
   * its sagitta is `bulge` of what the true circle's would be over the same chord.
   * A larger radius through the same two points is all "between straight and round"
   * takes, and it keeps the edge one smooth curve.
   */
  const half = (ao1 - ao0) / 2;
  const L = Math.sin(half) * outer;
  const sag = Math.max(0, Math.min(1, bulge)) * (outer - Math.cos(half) * outer);
  const outerEdge =
    sag < 0.01
      ? `L ${pt(toward(O1, O0, co))}`
      : `A ${f((L * L + sag * sag) / (2 * sag))} ${f((L * L + sag * sag) / (2 * sag))} 0 0 1 ${pt(toward(O1, O0, co))}`;

  return [
    `M ${pt(toward(O0, I0, co))}`,
    `Q ${pt(O0)} ${pt(toward(O0, O1, co))}`,
    outerEdge,
    `Q ${pt(O1)} ${pt(toward(O1, I1, co))}`,
    `L ${pt(toward(I1, O1, cin))}`,
    `Q ${pt(I1)} ${pt(polar(cx, cy, inner, ai1 - ci))}`,
    `A ${f(inner)} ${f(inner)} 0 ${largeInner} 0 ${pt(polar(cx, cy, inner, ai0 + ci))}`,
    `Q ${pt(I0)} ${pt(toward(I0, O0, cin))}`,
    'Z',
  ].join(' ');
}

/** The box a segment occupies, for laying a whole colour field over just that segment. */
export function sectorBounds(cx: number, cy: number, inner: number, outer: number, from: number, to: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const a = rad(from + ((to - from) * i) / 8);
    pts.push(polar(cx, cy, inner, a), polar(cx, cy, outer, a));
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Where to put a segment's label: its middle angle, a little outside mid-ring. */
export function sectorCentre(cx: number, cy: number, inner: number, outer: number, from: number, to: number, at = 0.5) {
  const a = rad((from + to) / 2);
  const r = inner + (outer - inner) * at;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
