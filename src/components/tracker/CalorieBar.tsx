'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { FoodLogEntry } from '@/lib/db/types';
import { SEGMENT_KCAL, type Band } from '@/lib/tracker/model';
import { ease } from '@/lib/motion';

/**
 * The day as a column of 50 kcal cells.
 *
 * Food fills from the floor in the order it was eaten, each meal in the colour of
 * its part of the day, so the column reads as a record of the day as well as a
 * gauge. Cells above the goal that an activity earned sit dashed and green until
 * food reaches them. Anything past the budget lights with a coral ring.
 *
 * A meal rarely ends on a 50 kcal boundary, so a cell can hold the tail of one meal
 * and the start of the next: each cell paints the slices of whatever bands overlap
 * it, rather than rounding a meal to whole cells and lying about the total.
 */

const GAP = 3;

export function CalorieBar({
  food,
  activity,
  capacity,
  goal,
  budget,
  onSelect,
}: {
  food: Band[];
  activity: Band[];
  capacity: number;
  goal: number;
  budget: number;
  onSelect: (entry: FoodLogEntry) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => setHeight(e.contentRect.height));
    ro.observe(node);
    setHeight(node.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);
  const count = capacity / SEGMENT_KCAL;
  const eaten = food.length ? food[food.length - 1].to : 0;

  const cells = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const lo = i * SEGMENT_KCAL;
      const hi = lo + SEGMENT_KCAL;
      const slices = food
        .filter((b) => b.to > lo && b.from < hi)
        .map((b) => ({
          id: b.entry.id,
          color: b.color,
          from: (Math.max(b.from, lo) - lo) / SEGMENT_KCAL,
          to: (Math.min(b.to, hi) - lo) / SEGMENT_KCAL,
        }));
      return {
        i,
        slices,
        earned: lo >= goal && lo < budget,
        // cells past the budget only exist once the day has gone over it
        over: lo >= budget,
      };
    });
  }, [count, food, goal, budget]);

  // label positions in px, measured against the real column so they sit inside
  // their own cells rather than at a percentage that ignores the gaps
  const cellH = height > 0 ? (height - GAP * (count - 1)) / count : 0;
  const yOf = (kcal: number) => {
    const whole = Math.floor(kcal / SEGMENT_KCAL);
    const part = (kcal % SEGMENT_KCAL) / SEGMENT_KCAL;
    return whole * (cellH + GAP) + part * cellH;
  };

  return (
    <div ref={ref} style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <div
        role="img"
        aria-label={`${Math.round(eaten)} of ${budget} kcal`}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column-reverse', gap: GAP }}
      >
        {cells.map((c) => (
          <div
            key={c.i}
            style={{
              position: 'relative',
              flex: '1 1 0',
              minHeight: 2,
              borderRadius: Math.min(7, Math.max(2, cellH / 2.6)),
              overflow: 'hidden',
              background: c.earned ? 'rgba(77,165,102,0.08)' : 'var(--paper)',
              boxShadow: c.over
                ? 'inset 0 0 0 1.5px var(--coral)'
                : c.earned
                  ? 'inset 0 0 0 1px rgba(77,165,102,0.42)'
                  : 'inset 0 0 0 1px var(--ink-08)',
            }}
          >
            {c.slices.map((s) => (
              <motion.span
                key={`${s.id}-${c.i}`}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.42, ease: ease.arrive, delay: Math.min(c.i * 0.012, 0.5) }}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${s.from * 100}%`,
                  height: `${(s.to - s.from) * 100}%`,
                  transformOrigin: 'bottom',
                  background: s.color,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
                }}
              />
            ))}
            {c.over && c.slices.length > 0 && (
              <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(255,131,96,0.22)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Labels and hit areas, one per meal. Drawn over the cells rather than in them
          so a meal that straddles cells still reads as one thing. */}
      {cellH > 0 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {food.map((b) => {
            const bottom = yOf(b.from);
            const top = yOf(b.to);
            const h = Math.max(top - bottom, 0);
            return (
              <button
                key={b.entry.id}
                type="button"
                onClick={() => onSelect(b.entry)}
                aria-label={`${b.entry.label}, ${Math.round(b.entry.kcal)} kcal`}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom,
                  height: Math.max(h, 10),
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  gap: 6,
                  textAlign: 'left',
                  overflow: 'hidden',
                }}
              >
                {h >= 15 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.3 }}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                      minWidth: 0,
                      width: '100%',
                      fontSize: 11.5,
                      lineHeight: 1.1,
                      color: 'var(--ink)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 400 }}>
                      {b.entry.label}
                    </span>
                    <span style={{ flex: '0 0 auto', color: 'var(--ink-45)', fontSize: 10.5 }}>{Math.round(b.entry.kcal)}</span>
                  </motion.span>
                )}
              </button>
            );
          })}

          {/* earned room, labelled only while nothing has been eaten into it */}
          {activity.map((b) => {
            if (eaten >= b.to - SEGMENT_KCAL / 2) return null;
            const bottom = yOf(Math.max(b.from, eaten));
            const h = yOf(b.to) - bottom;
            return (
              <button
                key={b.entry.id}
                type="button"
                onClick={() => onSelect(b.entry)}
                aria-label={`${b.entry.label}, plus ${Math.round(b.entry.kcal)} kcal`}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom,
                  height: Math.max(h, 10),
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  gap: 6,
                  overflow: 'hidden',
                }}
              >
                {h >= 15 && (
                  <span style={{ display: 'flex', gap: 6, width: '100%', fontSize: 11, color: 'var(--green-deep)' }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.entry.label}
                    </span>
                    <span style={{ flex: '0 0 auto' }}>+{Math.round(b.entry.kcal)}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
