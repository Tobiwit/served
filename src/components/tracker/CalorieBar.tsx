'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { FoodLogEntry } from '@/lib/db/types';
import { GradientField } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import type { Band, BarLayout } from '@/lib/tracker/model';
import { ease } from '@/lib/motion';

/**
 * The day as a column of 50 kcal cells, with what filled them written alongside.
 *
 *   Oats        ▕ ◖████◗
 *   379 kcal    ▕ ◖████◗
 *               ▕ ◖████◗
 *
 * The column is built like the Explore panels: a squircle plate, and colour that is
 * light under glass rather than paint. Each meal is a full gradient field — the same
 * tones the filters light up in — seen only through the pill cells it covers, via a
 * mask cut from the cell layout, so a meal reads as one wash of colour running
 * across the gaps. Meals always light whole cells (see `bandsFor`).
 *
 * Labels live in their own column to the left, each tied to its meal by a bracket in
 * the meal's colour. When meals are too short to hold a label each, the labels are
 * spread apart and a leader line runs back to the bracket they belong to.
 */

const GAP = 3;
const PAD = 8;
/** vertical room one label needs: a name and a kcal line */
const LABEL_H = 30;
/** the strip between the labels and the bar that holds brackets and leaders */
const RAIL = 14;

export function CalorieBar({ layout, onSelect }: { layout: BarLayout; onSelect: (entry: FoodLogEntry) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const read = () => {
      const r = node.getBoundingClientRect();
      setBox((p) => (Math.abs(p.w - r.width) < 0.5 && Math.abs(p.h - r.height) < 0.5 ? p : { w: r.width, h: r.height }));
    };
    const ro = new ResizeObserver(read);
    ro.observe(node);
    read();
    return () => ro.disconnect();
  }, []);

  const { food, activity, cells: count, goalCells, budgetCells, litCells } = layout;
  const { w, h } = box;
  const cellH = h > 0 ? (h - GAP * (count - 1)) / count : 0;
  const rx = Math.min(cellH / 2, 10);
  const pitch = cellH + GAP;

  /** px from the top of the inner column for the top edge of cell `i` */
  const cellTop = (i: number) => h - (i + 1) * cellH - i * GAP;
  /** a band's extent, px from the top of the inner column */
  const span = (b: Band) => ({ top: h - (b.end * pitch - GAP), bottom: h - b.start * pitch });

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

  /* ---- labels: one per meal, plus earned room nobody has eaten into yet ---- */

  const visibleActivity = activity.filter((b) => litCells < b.end);
  const labels = (() => {
    if (!h) return [];
    const H = h + PAD * 2;
    const items = [...food, ...visibleActivity].map((b) => {
      const s = span(b);
      const isActivity = b.entry.kind === 'activity';
      // earned room that food has started eating into is labelled on what is left
      const top = s.top;
      const bottom = isActivity && litCells > b.start ? h - litCells * pitch : s.bottom;
      return { band: b, isActivity, top: top + PAD, bottom: bottom + PAD, mid: (top + bottom) / 2 + PAD, y: (top + bottom) / 2 + PAD };
    });

    // spread overlapping labels apart: top to bottom, then back up from the floor
    items.sort((a, b) => a.mid - b.mid);
    for (let i = 0; i < items.length; i++) {
      const min = i === 0 ? LABEL_H / 2 : items[i - 1].y + LABEL_H;
      items[i].y = Math.max(items[i].y, min);
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const max = i === items.length - 1 ? H - LABEL_H / 2 : items[i + 1].y - LABEL_H;
      items[i].y = Math.min(items[i].y, max);
    }
    return items;
  })();

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* ------------------------------------------------------------ labels */}
      <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
        {h > 0 && (
          <svg
            aria-hidden
            width={RAIL}
            height={h + PAD * 2}
            style={{ position: 'absolute', right: 0, top: 0, overflow: 'visible' }}
          >
            {labels.map((l) => (
              <g key={l.band.entry.id}>
                <motion.rect
                  initial={{ opacity: 0 }}
                  animate={{ opacity: l.isActivity ? 0.55 : 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
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

        {labels.map((l) => (
          <motion.button
            key={l.band.entry.id}
            type="button"
            onClick={() => onSelect(l.band.entry)}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: ease.arrive, delay: 0.25 }}
            style={{
              position: 'absolute',
              right: RAIL + 2,
              left: 0,
              top: l.y - LABEL_H / 2,
              height: LABEL_H,
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
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 12.5,
                fontWeight: 400,
                lineHeight: 1.15,
                letterSpacing: '-0.015em',
                color: l.isActivity ? 'var(--green-deep)' : 'var(--ink)',
              }}
            >
              {l.band.entry.label}
            </span>
            <span style={{ fontSize: 10.5, lineHeight: 1.2, color: l.isActivity ? 'var(--green)' : 'var(--ink-45)' }}>
              {l.isActivity ? '+' : ''}
              {Math.round(l.band.entry.kcal)} kcal
            </span>
          </motion.button>
        ))}
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
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                maskImage: mask,
                WebkitMaskImage: mask,
                maskSize: `${w}px ${h}px`,
                WebkitMaskSize: `${w}px ${h}px`,
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
              }}
            >
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
