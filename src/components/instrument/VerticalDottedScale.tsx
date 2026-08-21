'use client';

import { useCallback, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { useMeasureWidth } from '@/lib/hooks/useMeasure';
import { spring } from '@/lib/motion';

/**
 * The dotted measurement scale, stood on end for tall narrow cards.
 * Same language as the horizontal one: dense minor dots, major ticks with values,
 * one emphasised indicator, and the accepted side of the scale stays lit.
 */

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  direction: 'atLeast' | 'atMost';
  labels: number[];
  active: boolean;
  label: string;
};

const PAD = 12;

export function VerticalDottedScale({ min, max, step, value, onChange, direction, labels, active, label }: Props) {
  const { ref, width } = useMeasureWidth<HTMLDivElement>();
  const box = useRef<HTMLDivElement | null>(null);
  const last = useRef(value);
  const span = max - min;

  const marks = useMemo(() => {
    const raw = Math.round(span / step) + 1;
    const stride = Math.max(1, Math.ceil(raw / 26));
    const out: number[] = [];
    for (let i = 0; i < raw; i += stride) out.push(min + i * step);
    if (out[out.length - 1] !== max) out.push(max);
    return out;
  }, [min, max, step, span]);

  const commit = useCallback(
    (clientY: number) => {
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const usable = Math.max(1, r.height - PAD * 2);
      const t = Math.min(1, Math.max(0, 1 - (clientY - r.top - PAD) / usable));
      const next = Math.min(max, Math.max(min, Math.round((min + t * span) / step) * step));
      const rounded = Number(next.toFixed(4));
      if (rounded !== last.current) {
        last.current = rounded;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(3);
        onChange(rounded);
      }
    },
    [max, min, span, step, onChange],
  );

  const cDim = active ? 'rgba(255,255,255,0.34)' : 'rgba(14,15,17,0.14)';
  const cLit = active ? 'rgba(255,255,255,0.92)' : 'rgba(14,15,17,0.34)';
  const cKey = active ? '#ffffff' : 'rgba(14,15,17,0.55)';
  const cText = active ? 'rgba(255,255,255,0.66)' : 'rgba(14,15,17,0.3)';
  const isLit = (v: number) => (direction === 'atLeast' ? v >= value : v <= value);
  const yFor = (v: number) => `${(1 - (v - min) / span) * 100}%`;

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
        commit(e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0 && e.pointerType === 'mouse') return;
        if ((e.target as Element).hasPointerCapture?.(e.pointerId)) commit(e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(Math.max(min, value - step));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          onChange(Math.min(max, value + step));
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 90,
        touchAction: 'none',
        cursor: 'ns-resize',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: PAD, bottom: PAD }}>
      {width > 0 &&
        marks.map((v) => {
          const lit = isLit(v);
          const major = labels.includes(v);
          return (
            <span key={v} style={{ position: 'absolute', left: 0, top: yFor(v), transform: 'translateY(-50%)' }}>
              {major ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      display: 'block',
                      width: 13,
                      height: 1,
                      background: lit ? cLit : cDim,
                      transition: 'background 220ms linear',
                    }}
                  />
                  <span style={{ fontSize: 9, letterSpacing: '0.06em', color: cText }}>{fmt(v)}</span>
                </span>
              ) : (
                <span
                  style={{
                    display: 'block',
                    marginLeft: 4,
                    width: lit ? 3 : 2.4,
                    height: lit ? 3 : 2.4,
                    borderRadius: 3,
                    background: lit ? cLit : cDim,
                    transition: 'background 220ms linear',
                  }}
                />
              )}
            </span>
          );
        })}

      <motion.span
        initial={false}
        animate={{ top: yFor(value) }}
        transition={spring.dial}
        style={{
          position: 'absolute',
          left: 0,
          width: 16,
          height: 1.6,
          borderRadius: 2,
          background: cKey,
          transform: 'translateY(-50%)',
          boxShadow: active ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
        }}
      />
      </div>
    </div>
  );
}

function fmt(v: number) {
  return Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v);
}
