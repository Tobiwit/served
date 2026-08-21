'use client';

import { useCallback, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { useMeasureWidth } from '@/lib/hooks/useMeasure';
import { spring } from '@/lib/motion';

/**
 * Arc span slider.
 *
 * A lime anchor sits at the left of a dotted baseline. Dragging the white travelling
 * dot along the baseline stretches a family of nested arcs that spring from the
 * anchor — the further you pull, the taller and wider the arch. The value is the
 * span, so the setting is legible as a *shape* before you read the number.
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
const BASE_FROM_BOTTOM = 22;
const DOTS = 11;

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

  // three nested arcs: the outer one spans to the dot, the inner two fall short,
  // which is what gives the reference its layered "spring" look
  const arcs = useMemo(() => {
    const span = Math.max(2, cx - x0);
    return [1, 0.72, 0.46].map((k) => {
      const end = x0 + span * k;
      const rx = span * k * 0.5;
      // flattened, and capped by the headroom above the baseline so the family
      // never rides out of the card
      const ry = Math.min(baseY - 6, Math.max(3, span * k * 0.3));
      return { d: `M ${x0} ${baseY} A ${rx} ${ry} 0 0 1 ${end} ${baseY}`, k };
    });
  }, [cx, x0, baseY]);

  const dots = useMemo(
    () =>
      Array.from({ length: DOTS }, (_, i) => {
        const p = i / (DOTS - 1);
        return { x: x0 + (x1 - x0) * p, p };
      }),
    [x0, x1],
  );

  const stroke = active ? 'rgba(255,255,255,0.9)' : 'rgba(14,15,17,0.28)';
  const dotDim = active ? 'rgba(255,255,255,0.42)' : 'rgba(14,15,17,0.16)';
  const dotLit = active ? '#ffffff' : 'rgba(14,15,17,0.5)';
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
          {arcs.map((a, i) => (
            <motion.path
              key={i}
              d={a.d}
              fill="none"
              stroke={stroke}
              strokeWidth={i === 0 ? 1 : 0.8}
              strokeLinecap="round"
              style={{ opacity: 1 - i * 0.22 }}
              initial={false}
              animate={{ d: a.d }}
              transition={spring.dial}
            />
          ))}

          {dots.map((d, i) => {
            const lit = d.p <= t + 0.001;
            return (
              <circle
                key={i}
                cx={d.x}
                cy={baseY}
                r={lit ? 2.6 : 1.6}
                fill={lit ? dotLit : dotDim}
                style={{ transition: 'fill 200ms linear, r 200ms linear' }}
              />
            );
          })}

          {/* the anchor the arcs spring from */}
          <circle cx={x0} cy={baseY} r={5.2} fill={active ? '#d9f265' : 'rgba(14,15,17,0.34)'} />

          <motion.circle
            initial={false}
            animate={{ cx }}
            transition={spring.dial}
            cy={baseY}
            r={4.6}
            fill={active ? '#ffffff' : 'rgba(14,15,17,0.6)'}
            style={active ? { filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.65))' } : undefined}
          />

          {ticks.map((label, i) => {
            const p = ticks.length === 1 ? 0 : i / (ticks.length - 1);
            return (
              <text
                key={label}
                x={x0 + (x1 - x0) * p}
                y={height - 5}
                textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}
                fill={textCol}
                fontSize={9}
                letterSpacing="0.04em"
              >
                {label}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
