'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Glass dial.
 *
 * A drum seen edge-on through glass, lying on its side and running the full width
 * of the card. Ticks are laid out by rotation angle rather than by linear position,
 * so they spread at the centre and compress towards the rims exactly as a turning
 * cylinder would, fading as they roll out of sight. The reading is whatever sits
 * under the fixed centre line — the drum moves, the indicator does not.
 *
 * It used to stand upright in a 58px-wide slot, which made it both a tiny target
 * and a vertical gesture on a page that scrolls vertically. Worse, the whole range
 * crossed in about sixty pixels: a step was four pixels wide and the value skittered
 * under your thumb. Laid down it gets the entire card to travel across, the numbers
 * on the drum can be read while you turn it, and the drag never fights the page.
 */

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  active: boolean;
  label: string;
  unit?: string;
  height?: number | string;
  /** degrees of drum rotation per step — sets how many ticks are in view */
  anglePerStep?: number;
};

/** how far round the drum stays visible before a tick has rolled out of sight */
const VISIBLE_ANGLE = 76;
/** the drum's radius as a share of the track width — sets where the ticks land */
const REACH = 0.47;

export function GlassDial({
  min,
  max,
  step,
  value,
  onChange,
  active,
  label,
  unit,
  height = '100%',
  anglePerStep = 5,
}: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const last = useRef(value);
  const [turning, setTurning] = useState(false);

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

  /**
   * Majors carry a number, so the interval has to be one a person would choose:
   * 200 kcal, not 125. Take the smallest 1/2/2½/5 × 10ⁿ that both covers roughly an
   * eighth of the range and lands on the step grid.
   */
  const majorEvery = useMemo(() => {
    const target = (max - min) / 8;
    const pow = 10 ** Math.floor(Math.log10(target));
    for (const m of [1, 2, 2.5, 5, 10]) {
      const c = m * pow;
      if (c >= target && Math.abs(c / step - Math.round(c / step)) < 1e-9) return c;
    }
    return Math.ceil(target / step) * step;
  }, [max, min, step]);

  const ticks = useMemo(() => {
    const span = Math.ceil(VISIBLE_ANGLE / anglePerStep);
    const out: { v: number; angle: number; major: boolean }[] = [];
    // snap the drum to the step grid so ticks never jitter between positions
    const base = Math.round(value / step) * step;
    for (let i = -span; i <= span; i++) {
      const v = Number((base + i * step).toFixed(4));
      if (v < min || v > max) continue;
      const angle = (v - value) * (anglePerStep / step);
      if (Math.abs(angle) > VISIBLE_ANGLE) continue;
      out.push({ v, angle, major: Math.abs(v % majorEvery) < 0.001 });
    }
    return out;
  }, [value, step, min, max, anglePerStep, majorEvery]);

  const release = () => {
    drag.current = null;
    setTurning(false);
  };

  return (
    <div
      ref={box}
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}${unit ? ` ${unit}` : ''}`}
      tabIndex={0}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, from: value };
        setTurning(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const w = box.current?.getBoundingClientRect().width ?? 200;
        /**
         * The drum turns at exactly the rate its own ticks travel, so the mark you
         * grabbed stays under your finger instead of running ahead of it. Near the
         * centre a step advances `reach × width × anglePerStep` pixels; invert that
         * and the gesture is the mechanism rather than an arbitrary sensitivity.
         */
        const pxPerStep = Math.max(1, w * REACH * ((anglePerStep * Math.PI) / 180));
        emit(drag.current.from - ((e.clientX - drag.current.x) * step) / pxPerStep);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          emit(value - step);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          emit(value + step);
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        height,
        minHeight: 34,
        minWidth: 0,
        borderRadius: 13,
        touchAction: 'none',
        cursor: 'ew-resize',
        userSelect: 'none',
        outline: 'none',
        overflow: 'hidden',
        // the cylinder: dark at the rims, lit through the middle
        background: active
          ? 'linear-gradient(90deg, rgba(14,15,17,0.3) 0%, rgba(255,255,255,0.14) 26%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.14) 74%, rgba(14,15,17,0.3) 100%)'
          : 'linear-gradient(90deg, rgba(14,15,17,0.09) 0%, rgba(14,15,17,0.02) 34%, rgba(14,15,17,0.02) 66%, rgba(14,15,17,0.09) 100%)',
        boxShadow: active
          ? 'inset 0 0 0 1px rgba(255,255,255,0.34), inset 6px 0 10px -6px rgba(14,15,17,0.5), inset -6px 0 10px -6px rgba(14,15,17,0.5)'
          : 'inset 0 0 0 1px var(--ink-08)',
      }}
    >
      {ticks.map((t) => {
        const rad = (t.angle * Math.PI) / 180;
        // cos is the foreshortening as the tick rolls away from the viewer
        const depth = Math.cos(rad);
        return (
          <span key={t.v} style={{ position: 'absolute', left: `${50 + Math.sin(rad) * REACH * 100}%`, top: 0, bottom: 0 }}>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: t.major ? '14%' : '26%',
                height: t.major ? `${42 * depth}%` : `${26 * depth}%`,
                width: t.major ? 1.5 : 1,
                borderRadius: 2,
                transform: 'translateX(-50%)',
                background: active ? '#fff' : 'rgba(14,15,17,0.6)',
                opacity: Math.max(0, depth * depth) * (t.major ? 0.95 : 0.42),
              }}
            />
            {t.major && (
              <span
                className="t-micro"
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 2,
                  transform: `translateX(-50%) scaleX(${Math.max(0.2, depth)})`,
                  fontSize: 8.5,
                  letterSpacing: '0.06em',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  color: active ? 'rgba(255,255,255,0.8)' : 'rgba(14,15,17,0.4)',
                  opacity: Math.max(0, depth * depth * depth),
                }}
              >
                {format(t.v)}
              </span>
            )}
          </span>
        );
      })}

      {/* The reading line — fixed, while the drum turns behind it. It stops above the
          caption band so the number under the needle is never struck through. */}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: 3,
          height: '58%',
          width: 2,
          marginLeft: -1,
          borderRadius: 2,
          background: active ? '#fff' : 'rgba(14,15,17,0.72)',
          boxShadow: active ? '0 0 9px rgba(255,255,255,0.8)' : 'none',
          transition: 'box-shadow 200ms ease',
        }}
      />

      {/* glass highlight across the crown of the drum */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 5,
          right: 5,
          top: '17%',
          height: 1.5,
          borderRadius: 2,
          background: active
            ? 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45) 30%, rgba(255,255,255,0.45) 70%, rgba(255,255,255,0))'
            : 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.8) 50%, rgba(255,255,255,0))',
          pointerEvents: 'none',
        }}
      />

      {/* the drum brightens under the thumb, so a turn is felt as well as read */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: turning ? 1 : 0,
          transition: 'opacity 220ms ease',
          background: 'radial-gradient(60% 120% at 50% 50%, rgba(255,255,255,0.22), rgba(255,255,255,0) 70%)',
        }}
      />
    </div>
  );
}

function format(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}
