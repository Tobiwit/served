'use client';

import { memo, useMemo } from 'react';
import { motion } from 'motion/react';

type Props = {
  /** each 0..1 */
  values: number[];
  height?: number;
  gap?: number;
  dot?: number;
  rows?: number;
  ink?: 'lume' | 'ink';
  className?: string;
};

/**
 * Dot-matrix column chart. Reads as texture from across the room and as data up
 * close — used for macro balance and for the quiet rhythm strip on gradient cards.
 */
function DotBarsImpl({ values, height = 34, gap = 6, dot = 1.5, rows = 7, ink = 'lume', className }: Props) {
  const cell = height / rows;
  const cols = values.length;
  const width = cols * gap;
  const grid = useMemo(
    () =>
      values.map((v, c) => {
        const on = Math.max(1, Math.round(v * rows));
        return Array.from({ length: rows }, (_, r) => ({
          x: c * gap + gap / 2,
          y: height - (r + 0.5) * cell,
          on: r < on,
          i: c * rows + r,
        }));
      }),
    [values, rows, gap, height, cell],
  );

  const lit = ink === 'lume' ? 'rgba(255,255,255,0.92)' : 'rgba(14,15,17,0.72)';
  const off = ink === 'lume' ? 'rgba(255,255,255,0.2)' : 'rgba(14,15,17,0.09)';

  return (
    <svg width={width} height={height} className={className} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      {grid.flat().map((d) => (
        <motion.circle
          key={d.i}
          cx={d.x}
          cy={d.y}
          r={dot}
          fill={d.on ? lit : off}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: Math.min(d.i * 0.004, 0.3), duration: 0.28 }}
          style={{ transformOrigin: `${d.x}px ${d.y}px` }}
        />
      ))}
    </svg>
  );
}

export const DotBars = memo(DotBarsImpl);
