'use client';

import { memo } from 'react';
import { motion } from 'motion/react';

/**
 * Concentric arcs, drawn as dashed rings. Signals "the instrument is listening" —
 * used on the Explore launch surface and on empty/pending states.
 */
function RippleImpl({
  size = 96,
  rings = 4,
  ink = 'lume',
  animate = true,
}: {
  size?: number;
  rings?: number;
  ink?: 'lume' | 'ink';
  animate?: boolean;
}) {
  const stroke = ink === 'lume' ? 'rgba(255,255,255,0.55)' : 'rgba(14,15,17,0.2)';
  return (
    <svg width={size} height={size} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
      {Array.from({ length: rings }, (_, i) => {
        const r = (size / 2) * ((i + 1) / rings) - 2;
        return (
          <motion.circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray="1.5 5"
            style={{ opacity: 1 - i * 0.14, transformOrigin: 'center' }}
            animate={animate ? { rotate: i % 2 === 0 ? 360 : -360 } : undefined}
            transition={{ duration: 46 + i * 12, repeat: Infinity, ease: 'linear' }}
          />
        );
      })}
    </svg>
  );
}

export const Ripple = memo(RippleImpl);
