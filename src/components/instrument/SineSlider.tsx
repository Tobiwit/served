'use client';

import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useMeasureWidth } from '@/lib/hooks/useMeasure';
import { spring } from '@/lib/motion';

/**
 * Sine scale.
 *
 * A family of waves printed across the track — one period, then one and a half, two
 * and three — all filling together behind the cursor as you drag. Where they cross
 * and separate gives the track a texture a plain rule does not have, and makes small
 * movements legible anywhere along it.
 *
 * They do not share an amplitude; they share a crossing *angle*. See `amps`.
 *
 * The cursor spans the family at the point it stands on: from the highest curve to
 * the lowest curve *at its own x*. So it breathes as you drag — tall where the waves
 * are furthest apart, and closing to a dot at each end, where all four cross the
 * middle together. That is the reading: the bar is a slice through the family, not a
 * marker laid over it.
 *
 * The fill is clipped by x rather than run along the paths with a dash offset: arc
 * length is not linear in x on a sine, so a dash fill would drift away from the
 * cursor around each crest — and drift differently for every period.
 *
 * `DottedScale` still backs protein, calories and time. This is deliberately its own
 * mechanism instead of a mode on that one — a dense dot field with a travelling
 * indicator and a filling wave are not the same instrument.
 */

type Props = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  /** captions along the bottom, at their own values */
  labels?: number[];
  unit?: string;
  /** 'lume' = white on a colour field, 'ink' = dark on white */
  ink?: 'lume' | 'ink';
  label?: string;
  height?: number;
};

const PAD = 10;

/** Cycles across the track. One line each, drawn and filled together. */
const PERIODS = [1, 1.5, 2, 3];

/** Samples per cycle — enough that the polylines read as curves at this weight. */
const SAMPLES_PER_CYCLE = 96;

/** tan(45°) — the slope we want where every wave crosses the middle. */
const TARGET_SLOPE = 1;

/** Room under the waves for the captions. */
const CAPTION_BAND = 13;

const BAR_W = 1.8;

export function SineSlider({
  min,
  max,
  step,
  value,
  onChange,
  labels,
  unit,
  ink = 'lume',
  label,
  height: H = 42,
}: Props) {
  const { ref, width } = useMeasureWidth<HTMLDivElement>();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(value);
  const clipId = useId();

  const w = Math.max(0, width - PAD * 2);
  const span = max - min || 1;

  const headroom = Math.max(1, (H - CAPTION_BAND) / 2);
  const mid = headroom + 1;
  const labelY = H - 2;

  /**
   * Amplitude per period, derived from the angle each wave should cut the middle at.
   *
   * For `y = A·sin(2πp·x/w)` the slope at a crossing is `A·2πp/w`. Setting that to 1
   * — a 45° crossing — gives `A = w / (2πp)`: amplitude falls off as 1/period, so the
   * single-cycle wave stands three times as tall as the three-cycle one. Equal
   * amplitudes made the fast waves knife through the middle while the slow one
   * ambled, which is why the family never looked like one instrument.
   *
   * A true 45° needs the tallest wave to be `w/2π` — around a third of the track's
   * width — either side of the middle, which a short track cannot give it. So the
   * family is scaled down as a unit: every crossing keeps the *same* angle as every
   * other, a little shallower than 45° on a wide track and near enough exact on a
   * narrow one, and the 1 : 1/1.5 : 1/2 : 1/3 proportions between them stay exact.
   */
  const amps = useMemo(() => {
    if (w <= 0) return PERIODS.map(() => 0);
    const ideal = PERIODS.map((p) => (TARGET_SLOPE * w) / (2 * Math.PI * p));
    const fit = Math.min(1, headroom / Math.max(...ideal));
    return ideal.map((a) => a * fit);
  }, [w, headroom]);

  const waveY = useCallback(
    (x: number, period: number, amp: number) =>
      mid - amp * Math.sin((x / Math.max(1, w)) * Math.PI * 2 * period),
    [mid, w],
  );

  const paths = useMemo(() => {
    if (w <= 0) return [];
    return PERIODS.map((period, i) => {
      // a three-cycle wave needs three times the samples to stay as smooth as one
      const segments = Math.ceil(SAMPLES_PER_CYCLE * period);
      let out = '';
      for (let j = 0; j <= segments; j++) {
        const x = (w * j) / segments;
        out += `${j === 0 ? 'M' : 'L'}${round(x)} ${round(waveY(x, period, amps[i]))}`;
      }
      return { period, d: out };
    });
  }, [w, waveY, amps]);

  /**
   * Top and bottom of the family at one x, with a floor so the ends stay visible.
   *
   * Where every wave crosses the middle at once the slice has no depth at all, and a
   * zero-height rect draws nothing. Opening it to `BAR_W` around the crossing leaves
   * a dot there instead of a gap.
   */
  const slice = useCallback(
    (x: number) => {
      const ys = PERIODS.map((period, i) => waveY(x, period, amps[i]));
      const top = Math.min(...ys);
      const depth = Math.max(...ys) - top;
      if (depth >= BAR_W) return { y: top, height: depth };
      const centre = top + depth / 2;
      return { y: centre - BAR_W / 2, height: BAR_W };
    },
    [waveY, amps],
  );

  const t = Math.min(1, Math.max(0, (value - min) / span));
  const cx = w * t;

  /**
   * One animated scalar — the cursor's x — with the fill edge and both ends of the
   * bar read off it every frame.
   *
   * This is why it cannot be three independent springs: the bar's height is a
   * non-monotonic function of its position, so a spring on the height would cut
   * across the envelope instead of following it, and the bar would be the wrong
   * depth for wherever it happened to be mid-flight.
   */
  const mx = useMotionValue(0);
  const primed = useRef(false);

  useEffect(() => {
    if (w <= 0) return;
    // the first real measurement is a correction, not a movement worth animating
    if (!primed.current) {
      primed.current = true;
      mx.set(cx);
      return;
    }
    const controls = animate(mx, cx, spring.dial);
    return () => controls.stop();
  }, [cx, w, mx]);

  const fillW = useTransform(mx, (x) => Math.max(0, x));
  const barX = useTransform(mx, (x) => x - BAR_W / 2);
  const barY = useTransform(mx, (x) => slice(x).y);
  const barH = useTransform(mx, (x) => slice(x).height);

  const commit = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (clientX - rect.left - PAD) / Math.max(1, rect.width - PAD * 2)));
      const next = Math.min(max, Math.max(min, Math.round((min + p * span) / step) * step));
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
  const cDim = lume ? 'rgba(255,255,255,0.22)' : 'rgba(14,15,17,0.11)';
  const cKey = lume ? '#ffffff' : '#0e0f11';
  const cText = lume ? 'rgba(255,255,255,0.62)' : 'rgba(14,15,17,0.38)';

  const majors = labels ?? [min, min + span / 2, max];
  const toX = (v: number) => (w * (v - min)) / span;

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
          <defs>
            <clipPath id={clipId}>
              <motion.rect x={0} y={0} width={fillW} height={H} />
            </clipPath>
          </defs>

          <g transform={`translate(${PAD} 0)`}>
            {/* the printed family */}
            {paths.map(({ period, d }) => (
              <path key={`d${period}`} d={d} fill="none" stroke={cDim} strokeWidth={1} strokeLinecap="round" />
            ))}

            {/* The part you have filled — every period, on the one clip.
                No glow on these: four strokes crossing inside a few pixels stack
                their haloes and bloom into a solid mass near the left, where all
                four converge. The cursor keeps the glow, so it stays the brightest
                thing on the track. */}
            <g clipPath={`url(#${clipId})`}>
              {paths.map(({ period, d }) => (
                <path
                  key={`l${period}`}
                  d={d}
                  fill="none"
                  stroke={cKey}
                  strokeWidth={1.3}
                  strokeLinecap="round"
                />
              ))}
            </g>

            {/* the cursor: a slice through the family at its own x */}
            <motion.rect
              x={barX}
              y={barY}
              width={BAR_W}
              height={barH}
              rx={BAR_W / 2}
              fill={cKey}
              style={lume ? { filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.6))' } : undefined}
            />

            {majors.map((v, i) => (
              <text
                key={`t${v}`}
                x={round(toX(v))}
                y={labelY}
                textAnchor={i === 0 ? 'start' : i === majors.length - 1 ? 'end' : 'middle'}
                fill={cText}
                fontSize={H < 46 ? 8 : 9}
                letterSpacing="0.08em"
              >
                {formatMajor(v)}
              </text>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;

function formatMajor(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
