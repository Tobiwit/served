'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { FoodLogEntry } from '@/lib/db/types';
import { GradientField } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import { MACRO_LABEL, MACRO_TONE, macroShare, type Band, type BarLayout, type MacroFocus } from '@/lib/tracker/model';
import { ease } from '@/lib/motion';

/**
 * The day as a column of 50 kcal cells, with what filled them written alongside.
 *
 *   Chicken      ▕ ◖████◗
 *   bowl         ▕ ◖████◗     a meal of 3+ cells may wrap its name onto two lines;
 *   413 kcal     ▕ ◖████◗     one of 6+ cells also says how much protein it carried
 *   77 g protein ▕ ◖████◗
 *
 * The column is built like the Explore panels: a squircle plate, and colour that is
 * light under glass rather than paint. Each meal is a full gradient field — the same
 * tones the filters light up in — seen only through the pill cells it covers, via a
 * mask cut from the cell layout, so a meal reads as one wash of colour running
 * across the gaps. Meals always light whole cells (see `bandsFor`).
 *
 * Holding a macro panel puts the column into focus: each meal lights only the share
 * of its cells that the macro accounts for, in that macro's colour, and the rest of
 * the meal goes dark. The labels switch to the percentage while it is held.
 *
 * Labels live in their own column to the left, each tied to its meal by a bracket in
 * the meal's colour. When meals are too short to hold their labels, the labels are
 * spread apart and a leader line runs back to the bracket they belong to.
 */

const GAP = 3;
const PAD = 8;
/** the strip between the labels and the bar that holds brackets and leaders */
const RAIL = 14;
const NAME_LINE = 14.5;
const SUB_LINE = 12.5;
/** clear space kept between neighbouring labels */
const LABEL_GAP = 4;
/** cells a meal needs before its name may wrap, and before it shows protein too */
const WRAP_AT = 3;
const DETAIL_AT = 6;
/** a rough width per character at the label size — enough to decide whether a name wraps */
const CHAR_W = 6.7;

export function CalorieBar({
  layout,
  focus = null,
  onSelect,
}: {
  layout: BarLayout;
  /** the macro being held, if any */
  focus?: MacroFocus | null;
  onSelect: (entry: FoodLogEntry) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [labelW, setLabelW] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    const col = labelRef.current;
    if (!node || !col) return;
    const read = () => {
      const r = node.getBoundingClientRect();
      setBox((p) => (Math.abs(p.w - r.width) < 0.5 && Math.abs(p.h - r.height) < 0.5 ? p : { w: r.width, h: r.height }));
      setLabelW(col.getBoundingClientRect().width);
    };
    const ro = new ResizeObserver(read);
    ro.observe(node);
    ro.observe(col);
    read();
    return () => ro.disconnect();
  }, []);

  // keep drawing the last macro while the focus layer fades back out
  const [shown, setShown] = useState<MacroFocus>('protein');
  if (focus && focus !== shown) setShown(focus);

  const { food, activity, cells: count, goalCells, budgetCells, litCells } = layout;
  const { w, h } = box;
  const cellH = h > 0 ? (h - GAP * (count - 1)) / count : 0;
  const rx = Math.min(cellH / 2, 10);
  const pitch = cellH + GAP;

  /** px from the top of the inner column for the top edge of cell `i` */
  const cellTop = (i: number) => h - (i + 1) * cellH - i * GAP;
  /** a run of cells, px from the top of the inner column */
  const spanOf = (start: number, end: number) => ({ top: h - (end * pitch - GAP), bottom: h - start * pitch });
  const span = (b: Band) => spanOf(b.start, b.end);

  const cells = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        i,
        y: h - (i + 1) * cellH - i * GAP,
        earned: i >= goalCells && i < budgetCells,
        over: i >= budgetCells,
      })),
    [count, h, cellH, goalCells, budgetCells],
  );

  // the cell layout as a mask, so the colour underneath shows only through cells
  const mask = useMemo(() => {
    if (!w || !h) return undefined;
    const rects = cells
      .map((c) => `<rect x="0" y="${c.y.toFixed(2)}" width="${w.toFixed(2)}" height="${cellH.toFixed(2)}" rx="${rx.toFixed(2)}"/>`)
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g fill="#fff">${rects}</g></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [cells, w, h, cellH, rx]);

  const maskStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: `${w}px ${h}px`,
    WebkitMaskSize: `${w}px ${h}px`,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  };

  /* ---- labels: one per meal, plus earned room nobody has eaten into yet ---- */

  const visibleActivity = activity.filter((b) => litCells < b.end);
  const textW = Math.max(40, labelW - RAIL - 2);

  const labels = (() => {
    if (!h) return [];
    const H = h + PAD * 2;
    const items = [...food, ...visibleActivity].map((b) => {
      const s = span(b);
      const isActivity = b.entry.kind === 'activity';
      const size = b.end - b.start;
      // earned room that food has started eating into is labelled on what is left
      const bottom = isActivity && litCells > b.start ? h - litCells * pitch : s.bottom;
      const wraps = !isActivity && size >= WRAP_AT && b.entry.label.length * CHAR_W > textW;
      const detail = !isActivity && size >= DETAIL_AT;
      const height = (wraps ? 2 : 1) * NAME_LINE + (detail ? 2 : 1) * SUB_LINE;
      const mid = (s.top + bottom) / 2 + PAD;
      return { band: b, isActivity, wraps, detail, height, top: s.top + PAD, bottom: bottom + PAD, mid, y: mid };
    });

    // spread overlapping labels apart: top to bottom, then back up from the floor
    items.sort((a, b) => a.mid - b.mid);
    for (let i = 0; i < items.length; i++) {
      const min = i === 0 ? items[i].height / 2 : items[i - 1].y + (items[i - 1].height + items[i].height) / 2 + LABEL_GAP;
      items[i].y = Math.max(items[i].y, min);
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const max = i === items.length - 1 ? H - items[i].height / 2 : items[i + 1].y - (items[i].height + items[i + 1].height) / 2 - LABEL_GAP;
      items[i].y = Math.min(items[i].y, max);
    }
    return items;
  })();

  const subLines = (entry: FoodLogEntry, isActivity: boolean, detail: boolean): string[] => {
    if (isActivity) return [`+${Math.round(entry.kcal)} kcal`];
    if (focus) {
      const share = macroShare(entry, focus);
      const g = entry[focus];
      const first = share == null ? `no ${MACRO_LABEL[focus]} data` : `${Math.round(share * 100)}% ${MACRO_LABEL[focus]}`;
      return detail ? [first, g == null ? '—' : `${Math.round(g)} g`] : [first];
    }
    const first = `${Math.round(entry.kcal)} kcal`;
    return detail ? [first, entry.protein == null ? 'protein unknown' : `${Math.round(entry.protein)} g protein`] : [first];
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* ------------------------------------------------------------ labels */}
      <div ref={labelRef} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
        {h > 0 && (
          <svg aria-hidden width={RAIL} height={h + PAD * 2} style={{ position: 'absolute', right: 0, top: 0, overflow: 'visible' }}>
            {labels.map((l) => (
              <g key={l.band.entry.id}>
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{ opacity: l.isActivity ? (focus ? 0.2 : 0.55) : 1 }}
                  transition={{ duration: 0.3 }}
                  x={RAIL - 5}
                  y={l.top + 1}
                  width={3}
                  height={Math.max(2, l.bottom - l.top - 2)}
                  rx={1.5}
                  fill={l.band.color}
                />
                <path
                  d={`M 0 ${l.y.toFixed(1)} L 3 ${l.y.toFixed(1)} L ${RAIL - 7} ${l.mid.toFixed(1)}`}
                  fill="none"
                  stroke="var(--ink-14)"
                  strokeWidth={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}
          </svg>
        )}

        {labels.map((l) => {
          const subs = subLines(l.band.entry, l.isActivity, l.detail);
          return (
            <motion.button
              key={l.band.entry.id}
              type="button"
              onClick={() => onSelect(l.band.entry)}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: l.isActivity && focus ? 0.3 : 1, x: 0 }}
              transition={{ duration: 0.3, ease: ease.arrive }}
              style={{
                position: 'absolute',
                right: RAIL + 2,
                left: 0,
                top: l.y - l.height / 2,
                height: l.height,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-end',
                textAlign: 'right',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  maxWidth: '100%',
                  overflow: 'hidden',
                  fontSize: 12.5,
                  fontWeight: 400,
                  lineHeight: `${NAME_LINE}px`,
                  letterSpacing: '-0.015em',
                  color: l.isActivity ? 'var(--green-deep)' : 'var(--ink)',
                  ...(l.wraps
                    ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }
                    : { textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                }}
              >
                {l.band.entry.label}
              </span>
              {subs.map((line, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 10.5,
                    lineHeight: `${SUB_LINE}px`,
                    whiteSpace: 'nowrap',
                    color: l.isActivity ? 'var(--green)' : focus && i === 0 ? 'var(--ink-70)' : 'var(--ink-45)',
                    fontWeight: focus && i === 0 && !l.isActivity ? 400 : 300,
                  }}
                >
                  {line}
                </span>
              ))}
            </motion.button>
          );
        })}
      </div>

      {/* -------------------------------------------------------------- bar */}
      <Squircle
        radius={30}
        stroke="ink"
        style={{ flex: '0 0 47%', height: '100%', background: 'var(--paper)', boxShadow: 'var(--lift-2)', padding: PAD }}
      >
        <div ref={ref} style={{ position: 'relative', height: '100%' }} role="img" aria-label={`${litCells * 50} of ${budgetCells * 50} kcal`}>
          {/* the unlit cells */}
          {w > 0 && (
            <svg width={w} height={h} style={{ position: 'absolute', inset: 0, display: 'block' }} aria-hidden>
              {cells.map((c) => (
                <rect
                  key={c.i}
                  x={0.5}
                  y={c.y + 0.5}
                  width={w - 1}
                  height={Math.max(0, cellH - 1)}
                  rx={rx}
                  fill={c.earned ? 'rgba(31,107,82,0.08)' : 'rgba(14,15,17,0.045)'}
                  stroke={c.earned ? 'rgba(31,107,82,0.4)' : 'none'}
                  strokeWidth={1}
                  strokeDasharray={c.earned ? '2 3' : undefined}
                />
              ))}
            </svg>
          )}

          {/* the meals, as colour fields seen through the cells */}
          {mask && (
            <div aria-hidden style={maskStyle}>
              {food.map((b, i) => {
                const s = span(b);
                return (
                  <motion.div
                    key={b.entry.id}
                    initial={{ clipPath: 'inset(100% 0% 0% 0%)' }}
                    animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                    transition={{ duration: 0.7, ease: ease.arrive, delay: Math.min(i * 0.06, 0.4) }}
                    style={{ position: 'absolute', left: 0, right: 0, top: s.top, height: s.bottom - s.top }}
                  >
                    <GradientField tone={b.tone} blur={22} rotate={i * 37} />
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Focus: while a macro is held, each meal lights only its share of that
              macro — whole cells, from the floor of the meal up — and goes dark above. */}
          {mask && (
            <motion.div
              aria-hidden
              initial={false}
              animate={{ opacity: focus ? 1 : 0 }}
              transition={{ duration: 0.24, ease: ease.glass }}
              style={{ ...maskStyle, pointerEvents: 'none' }}
            >
              {food.map((b, i) => {
                const size = b.end - b.start;
                const share = macroShare(b.entry, shown) ?? 0;
                const lit = Math.round(size * share);
                const dark = spanOf(b.start + lit, b.end);
                const bright = spanOf(b.start, b.start + lit);
                return (
                  <div key={b.entry.id}>
                    {size - lit > 0 && (
                      // the rest of the meal is switched off, not blacked out: its own
                      // colour drained almost to grey and only faintly dimmed, so the lit
                      // share stands out by colour rather than by darkness
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: dark.top,
                          height: dark.bottom - dark.top,
                          filter: 'saturate(0.1)',
                        }}
                      >
                        <GradientField tone={b.tone} blur={22} rotate={i * 37} veil={false} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,15,17,0.15)' }} />
                      </div>
                    )}
                    {lit > 0 && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: bright.top, height: bright.bottom - bright.top }}>
                        <GradientField tone={MACRO_TONE[shown]} blur={22} rotate={i * 53} />
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* past the budget */}
          {w > 0 && (
            <svg width={w} height={h} style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none' }} aria-hidden>
              {cells
                .filter((c) => c.over)
                .map((c) => (
                  <rect key={c.i} x={1} y={cellTop(c.i) + 1} width={w - 2} height={Math.max(0, cellH - 2)} rx={rx} fill="none" stroke="var(--coral)" strokeWidth={1.5} />
                ))}
            </svg>
          )}

          {/* the meals are tappable on the bar as well as by their labels */}
          {h > 0 &&
            [...food, ...visibleActivity].map((b) => {
              const s = span(b);
              return (
                <button
                  key={b.entry.id}
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => onSelect(b.entry)}
                  style={{ position: 'absolute', left: 0, right: 0, top: s.top, height: Math.max(10, s.bottom - s.top) }}
                />
              );
            })}
        </div>
      </Squircle>
    </div>
  );
}
