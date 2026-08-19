'use client';

import { memo, useMemo } from 'react';
import { motion } from 'motion/react';

type Props = {
  /** 0..100 */
  value: number;
  size?: number;
  ink?: 'lume' | 'ink';
  /** dots along the arc */
  count?: number;
  strokeColor?: string;
  className?: string;
};

/**
 * A fine radial arc sampled into dots. The dots up to the value are lit and the
 * value itself gets a slightly larger key dot — a reading, not a progress bar.
 */
function ArcGaugeImpl({ value, size = 92, ink = 'ink', count = 28, strokeColor, className }: Props) {
  const A0 = 158;
  const A1 = 382;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        const a = ((A0 + (A1 - A0) * t) * Math.PI) / 180;
        const round = (v: number) => Math.round(v * 1000) / 1000;
        return { x: round(cx + r * Math.cos(a)), y: round(cy + r * Math.sin(a)), t };
      }),
    [count, cx, cy, r],
  );

  const key = strokeColor ?? (ink === 'lume' ? '#ffffff' : '#0e0f11');
  const dim = ink === 'lume' ? 'rgba(255,255,255,0.3)' : 'rgba(14,15,17,0.13)';
  const v = Math.min(1, Math.max(0, value / 100));

  return (
    <svg width={size} height={size} className={className} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      {dots.map((d, i) => {
        const lit = d.t <= v + 0.0001;
        const isKey = lit && (i === dots.length - 1 || dots[i + 1].t > v);
        return (
          <motion.circle
            key={i}
            cx={d.x}
            cy={d.y}
            fill={lit ? key : dim}
            initial={{ r: 0 }}
            animate={{ r: isKey ? 2.6 : 1.3, opacity: lit ? (isKey ? 1 : 0.72) : 1 }}
            transition={{ delay: i * 0.012, type: 'spring', stiffness: 420, damping: 30 }}
          />
        );
      })}
    </svg>
  );
}

export const ArcGauge = memo(ArcGaugeImpl);
