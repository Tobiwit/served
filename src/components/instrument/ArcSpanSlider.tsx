'use client';

import { useCallback, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { useMeasureWidth } from '@/lib/hooks/useMeasure';
import { spring } from '@/lib/motion';

/**
 * Arc span slider.
 *
 * The whole family of arches is the scale: a fixed set of faint arcs springing from
 * the lime anchor at the left, each one a step further out and a step taller, drawn
 * once and never moved. You drag a single lit arch through them. It grows exactly the
 * way the background does, so the reading is a shape measured against a printed
 * scale, not a dot on a line — and how much food you asked for is legible before you
 * read the number.
 *
 * The arches used to be the *value* — three nested curves that stretched as you
 * pulled — which left nothing on the card to measure them against.
 */

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  active: boolean;
  label: string;
  /** captions along the baseline, left to right */
  ticks?: string[];
  height?: number;
};

const PAD_L = 12;
const PAD_R = 14;
const BASE_FROM_BOTTOM = 15;
/** how many arches the scale is printed with */
const RUNGS = 7;

export function ArcSpanSlider({
  min,
  max,
  step,
  value,
  onChange,
  active,
  label,
  ticks = [],
  height = 104,
}: Props) {
  const { ref, width } = useMeasureWidth<HTMLDivElement>();
  const box = useRef<HTMLDivElement | null>(null);
  const last = useRef(value);

  const baseY = height - BASE_FROM_BOTTOM;
  const x0 = PAD_L;
  const x1 = Math.max(x0 + 1, width - PAD_R);
  const t = (value - min) / (max - min || 1);
  const cx = x0 + (x1 - x0) * t;

  const commit = useCallback(
    (clientX: number) => {
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const usable = Math.max(1, r.width - PAD_L - PAD_R);
      const p = Math.min(1, Math.max(0, (clientX - r.left - PAD_L) / usable));
      const next = Math.min(max, Math.max(min, Math.round((min + p * (max - min)) / step) * step));
      const rounded = Number(next.toFixed(4));
      if (rounded !== last.current) {
        last.current = rounded;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(3);
        onChange(rounded);
      }
    },
    [max, min, step, onChange],
  );

  /**
   * One arch, as a fraction of the track. Width and height both grow with the
   * fraction, so the lit arch and the printed ones are the same curve at different
   * settings — that is what makes the scale readable.
   */
  const arch = useCallback(
    (k: number) => {
      const span = Math.max(1.5, (x1 - x0) * k);
      const rx = span / 2;
      const ry = 3 + (baseY - 8) * k;
      return `M ${round(x0)} ${round(baseY)} A ${round(rx)} ${round(ry)} 0 0 1 ${round(x0 + span)} ${round(baseY)}`;
    },
    [x0, x1, baseY],
  );

  const rungs = useMemo(
    () => (width > 0 ? Array.from({ length: RUNGS }, (_, i) => arch((i + 1) / RUNGS)) : []),
    [arch, width],
  );

  /**
   * The baseline, as marks rather than a rule.
   *
   * A solid line said nothing about where the arches land — it was just the floor
   * they stood on. Marking each arch's foot, with a half-step between neighbours,
   * turns the floor into the scale itself: you can see which rung you are on and
   * how far the next one is without reading the number.
   *
   * Index 0 is skipped — the lime anchor already occupies the origin.
   */
  const feet = useMemo(() => {
    if (width <= 0) return [];
    const steps = RUNGS * 2;
    return Array.from({ length: steps }, (_, i) => {
      const k = (i + 1) / steps;
      return { k, x: x0 + (x1 - x0) * k, major: (i + 1) % 2 === 0 };
    });
  }, [width, x0, x1]);

  const lit = arch(Math.max(0.02, t));

  const rungCol = active ? 'rgba(255,255,255,0.3)' : 'rgba(14,15,17,0.12)';
  const litCol = active ? '#ffffff' : 'rgba(14,15,17,0.55)';
  const dotDim = active ? 'rgba(255,255,255,0.32)' : 'rgba(14,15,17,0.14)';
  const dotLit = active ? 'rgba(255,255,255,0.85)' : 'rgba(14,15,17,0.42)';
  const textCol = active ? 'rgba(255,255,255,0.68)' : 'rgba(14,15,17,0.32)';

  return (
    <div
      ref={(n) => {
        ref(n);
        box.current = n;
      }}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        commit(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === 'mouse') return;
        if ((e.target as Element).hasPointerCapture?.(e.pointerId)) commit(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(Math.max(min, value - step));
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          onChange(Math.min(max, value + step));
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        height,
        touchAction: 'none',
        cursor: 'ew-resize',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {width > 0 && (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
          {/* the printed scale */}
          {rungs.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={rungCol} strokeWidth={0.8} strokeLinecap="round" />
          ))}

          {/* the baseline, marked rather than ruled — a foot under every arch and a
              half-step between each pair. Marks inside the span you have pulled out
              come up, so the reading is legible from the floor as well as the curve. */}
          {feet.map(({ k, x, major }) => (
            <circle
              key={k}
              cx={round(x)}
              cy={baseY}
              r={major ? 1.6 : 1}
              fill={k <= t + 0.001 ? dotLit : dotDim}
              style={{ transition: 'fill 220ms linear' }}
            />
          ))}

          {/* the one arch you drag */}
          <motion.path
            initial={false}
            animate={{ d: lit }}
            transition={spring.dial}
            d={lit}
            fill="none"
            stroke={litCol}
            strokeWidth={1.8}
            strokeLinecap="round"
            style={active ? { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' } : undefined}
          />

          {/* the anchor it springs from */}
          <circle cx={x0} cy={baseY} r={4.4} fill={active ? '#d9f265' : 'rgba(14,15,17,0.34)'} />

          {/* the handle rides the far foot of the arch */}
          <motion.circle
            initial={false}
            animate={{ cx }}
            transition={spring.dial}
            cy={baseY}
            r={4.6}
            fill={active ? '#ffffff' : 'rgba(14,15,17,0.6)'}
            style={active ? { filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.65))' } : undefined}
          />

          {ticks.map((caption, i) => {
            const p = ticks.length === 1 ? 0 : i / (ticks.length - 1);
            return (
              <text
                key={caption}
                x={x0 + (x1 - x0) * p}
                y={height - 3}
                textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
                fill={textCol}
                fontSize={8.5}
                letterSpacing="0.04em"
              >
                {caption}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;
