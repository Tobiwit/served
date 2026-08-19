'use client';

import { useCallback, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { useMeasureWidth } from '@/lib/hooks/useMeasure';
import { spring } from '@/lib/motion';

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  /** which half of the scale is the accepted region */
  direction: 'atLeast' | 'atMost';
  labels?: number[];
  unit?: string;
  /** 'lume' = white marks on a colour field, 'ink' = dark marks on white */
  ink?: 'lume' | 'ink';
  label?: string;
};

const H = 52;
const PAD = 10;

/**
 * The exact-adjustment mechanism. A dense field of dots, major ticks, and one
 * emphasised indicator you drag across. The accepted side of the scale stays lit
 * so "at least 35g" and "at most 600 kcal" read differently at a glance.
 */
export function DottedScale({
  min,
  max,
  step,
  value,
  onChange,
  direction,
  labels,
  unit,
  ink = 'lume',
  label,
}: Props) {
  const { ref, width } = useMeasureWidth<HTMLDivElement>();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(value);

  const w = Math.max(0, width - PAD * 2);
  const span = max - min;

  const marks = useMemo(() => {
    const raw = Math.round(span / step) + 1;
    const stride = Math.max(1, Math.ceil(raw / 44));
    const out: number[] = [];
    for (let i = 0; i < raw; i += stride) out.push(min + i * step);
    if (out[out.length - 1] !== max) out.push(max);
    return out;
  }, [min, max, step, span]);

  const majors = useMemo(() => labels ?? [min, min + span / 2, max], [labels, min, max, span]);

  const toX = useCallback((v: number) => (w * (v - min)) / span, [w, min, span]);

  const commit = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (clientX - rect.left - PAD) / Math.max(1, rect.width - PAD * 2)));
      const next = Math.min(max, Math.max(min, Math.round((min + t * span) / step) * step));
      const rounded = Number(next.toFixed(4));
      if (rounded !== lastEmitted.current) {
        lastEmitted.current = rounded;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(3);
        onChange(rounded);
      }
    },
    [max, min, span, step, onChange],
  );

  const lume = ink === 'lume';
  const cDim = lume ? 'rgba(255,255,255,0.34)' : 'rgba(14,15,17,0.16)';
  const cLit = lume ? 'rgba(255,255,255,0.9)' : 'rgba(14,15,17,0.5)';
  const cKey = lume ? '#ffffff' : '#0e0f11';
  const cText = lume ? 'rgba(255,255,255,0.62)' : 'rgba(14,15,17,0.38)';

  const isLit = (v: number) => (direction === 'atLeast' ? v >= value : v <= value);

  return (
    <div
      ref={(n) => {
        ref(n);
        trackRef.current = n;
      }}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}${unit ? ` ${unit}` : ''}`}
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
        height: H,
        touchAction: 'none',
        cursor: 'ew-resize',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <g transform={`translate(${PAD} 0)`}>
            {marks.map((v) => {
              const lit = isLit(v);
              return (
                <circle
                  key={v}
                  cx={toX(v)}
                  cy={19}
                  r={lit ? 1.5 : 1.15}
                  fill={lit ? cLit : cDim}
                  style={{ transition: 'fill 220ms linear, r 220ms linear' }}
                />
              );
            })}
            {majors.map((v) => (
              <g key={`m${v}`}>
                <line
                  x1={toX(v)}
                  x2={toX(v)}
                  y1={9}
                  y2={29}
                  stroke={isLit(v) ? cLit : cDim}
                  strokeWidth={1}
                  style={{ transition: 'stroke 220ms linear' }}
                />
                <text
                  x={toX(v)}
                  y={45}
                  textAnchor="middle"
                  fill={cText}
                  fontSize={9}
                  letterSpacing="0.08em"
                  style={{ fontWeight: 400 }}
                >
                  {formatMajor(v)}
                </text>
              </g>
            ))}
            <motion.g animate={{ x: toX(value) }} transition={spring.dial} initial={false}>
              <line x1={0} x2={0} y1={2} y2={36} stroke={cKey} strokeWidth={1.6} strokeLinecap="round" />
              <circle cx={0} cy={-2.5} r={2} fill={cKey} />
            </motion.g>
          </g>
        </svg>
      )}
    </div>
  );
}

function formatMajor(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
