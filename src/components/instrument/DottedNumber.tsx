'use client';

import { memo, useMemo } from 'react';
import { motion } from 'motion/react';
import { GLYPH_H, textDots } from '@/lib/dotted/glyphs';

type Props = {
  value: string | number;
  /** rendered height of the numerals in px */
  size?: number;
  color?: string;
  /** dot radius as a fraction of glyph units (10x16 box) */
  weight?: number;
  spacing?: number;
  className?: string;
  /** dots fade in one after another when the value first appears */
  animate?: boolean;
  glow?: boolean;
  style?: React.CSSProperties;
};

/**
 * A number drawn as dots along the strokes of a thin numeral.
 * The whole value is one <svg> so it scales as a unit and stays crisp.
 */
function DottedNumberImpl({
  value,
  size = 64,
  color = 'currentColor',
  weight = 0.66,
  spacing = 1.2,
  className,
  animate = true,
  glow = false,
  style,
}: Props) {
  const text = String(value);
  const { dots, width } = useMemo(() => textDots(text, spacing), [text, spacing]);
  const unit = size / GLYPH_H;
  const pad = weight * 2;

  return (
    <svg
      className={className}
      width={(width + pad) * unit}
      height={(GLYPH_H + pad) * unit}
      viewBox={`${-pad / 2} ${-pad / 2} ${width + pad} ${GLYPH_H + pad}`}
      style={{ display: 'block', overflow: 'visible', ...style }}
      aria-label={text}
      role="img"
    >
      <g fill={color} style={glow ? { filter: 'drop-shadow(0 0 2.4px rgba(255,255,255,0.55))' } : undefined}>
        {dots.map((d, i) =>
          animate ? (
            <motion.circle
              key={`${text}-${i}`}
              cx={d.x}
              cy={d.y}
              r={weight}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.006, 0.34), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${d.x}px ${d.y}px` }}
            />
          ) : (
            <circle key={i} cx={d.x} cy={d.y} r={weight} />
          ),
        )}
      </g>
    </svg>
  );
}

export const DottedNumber = memo(DottedNumberImpl);
