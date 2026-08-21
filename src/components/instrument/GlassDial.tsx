'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useMeasureWidth } from '@/lib/hooks/useMeasure';

/**
 * Glass dial.
 *
 * A vertical drum seen edge-on through glass. Ticks are laid out by rotation angle
 * rather than by linear position, so they spread at the centre and compress towards
 * the rim exactly as a turning cylinder would, fading as they roll out of sight.
 * The reading is the tick sitting under the fixed centre line — the dial moves, the
 * indicator does not.
 *
 * Dragging is relative, not absolute: you spin it from wherever you grabbed it.
 */

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  active: boolean;
  label: string;
  width?: number;
  /** degrees of drum rotation per step — sets how many ticks are in view */
  anglePerStep?: number;
};

const VISIBLE_ANGLE = 78;

export function GlassDial({
  min,
  max,
  step,
  value,
  onChange,
  active,
  label,
  width = 54,
  anglePerStep = 15,
}: Props) {
  const { ref, width: measuredW } = useMeasureWidth<HTMLDivElement>();
  const box = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y: number; from: number } | null>(null);
  const last = useRef(value);

  const emit = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, Math.round(next / step) * step));
      const rounded = Number(clamped.toFixed(4));
      if (rounded !== last.current) {
        last.current = rounded;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(2);
        onChange(rounded);
      }
    },
    [max, min, step, onChange],
  );

  const ticks = useMemo(() => {
    const span = Math.ceil(VISIBLE_ANGLE / anglePerStep);
    const out: { v: number; angle: number }[] = [];
    // snap the drum to the step grid so ticks never jitter between positions
    const base = Math.round(value / step) * step;
    for (let i = -span; i <= span; i++) {
      const v = base + i * step;
      if (v < min - step || v > max + step) continue;
      out.push({ v, angle: (v - value) * (anglePerStep / step) });
    }
    return out.filter((t) => Math.abs(t.angle) <= VISIBLE_ANGLE);
  }, [value, step, min, max, anglePerStep]);

  const w = measuredW || width;
  const majorEvery = step * 4;

  return (
    <div
      ref={(n) => {
        ref(n);
        box.current = n;
      }}
      role="slider"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { y: e.clientY, from: value };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const h = box.current?.getBoundingClientRect().height ?? 100;
        // one full track height spins roughly two thirds of the range
        const perPx = ((max - min) * 0.66) / h;
        emit(drag.current.from - (e.clientY - drag.current.y) * perPx);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          emit(value - step);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          emit(value + step);
        }
      }}
      style={{
        position: 'relative',
        width,
        height: '100%',
        minHeight: 58,
        borderRadius: 15,
        touchAction: 'none',
        cursor: 'ns-resize',
        userSelect: 'none',
        outline: 'none',
        overflow: 'hidden',
        // the cylinder: dark at the rims, lit through the middle
        background: active
          ? 'linear-gradient(90deg, rgba(14,15,17,0.3) 0%, rgba(255,255,255,0.16) 34%, rgba(255,255,255,0.24) 52%, rgba(14,15,17,0.12) 76%, rgba(14,15,17,0.32) 100%)'
          : 'linear-gradient(90deg, rgba(14,15,17,0.09) 0%, rgba(14,15,17,0.02) 40%, rgba(14,15,17,0.03) 60%, rgba(14,15,17,0.1) 100%)',
        boxShadow: active
          ? 'inset 0 0 0 1px rgba(255,255,255,0.34), inset 0 6px 10px -6px rgba(14,15,17,0.45), inset 0 -6px 10px -6px rgba(14,15,17,0.45)'
          : 'inset 0 0 0 1px var(--ink-08)',
      }}
    >
      {ticks.map((t) => {
        const rad = (t.angle * Math.PI) / 180;
        const depth = Math.cos(rad);
        const major = Math.abs(t.v % majorEvery) < 0.001;
        return (
          <span
            key={t.v}
            style={{
              position: 'absolute',
              left: '50%',
              top: `${50 - Math.sin(rad) * 46}%`,
              width: `${(major ? 62 : 40) * depth}%`,
              height: major ? 1.6 : 1,
              borderRadius: 2,
              transform: 'translate(-50%, -50%)',
              background: active ? '#fff' : 'rgba(14,15,17,0.55)',
              opacity: Math.max(0, depth * depth) * (major ? 0.9 : 0.5),
            }}
          />
        );
      })}

      {/* the reading line — fixed, while the drum turns behind it */}
      <span
        style={{
          position: 'absolute',
          left: 4,
          right: 4,
          top: '50%',
          height: 2,
          marginTop: -1,
          borderRadius: 2,
          background: active ? '#fff' : 'rgba(14,15,17,0.7)',
          boxShadow: active ? '0 0 9px rgba(255,255,255,0.75)' : 'none',
        }}
      />

      {/* glass highlight down the left shoulder */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: w * 0.16,
          top: 5,
          bottom: 5,
          width: 1.5,
          borderRadius: 2,
          background: active
            ? 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.5) 30%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0))'
            : 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.85) 50%, rgba(255,255,255,0))',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
