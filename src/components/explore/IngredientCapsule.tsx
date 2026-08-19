'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { RecipeIngredient } from '@/lib/db/types';
import { settleDelay, spring } from '@/lib/motion';

/**
 * One ingredient.
 *
 *   tap        exclude it for this run
 *   long press prioritise recipes containing it
 *
 * Boosted capsules get a thin dotted orbit and a brighter edge. Excluding
 * contracts the capsule out of existence rather than fading it, so removal feels
 * mechanical instead of like a disappearing tooltip.
 */

const LONG_PRESS_MS = 420;

type Props = {
  ri: RecipeIngredient;
  index: number;
  boosted: boolean;
  swapped: boolean;
  onExclude: () => void;
  onBoost: () => void;
};

export function IngredientCapsule({ ri, index, boosted, swapped, onExclude, onBoost }: Props) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const [held, setHeld] = useState(false);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHeld(false);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    setHeld(true);
    timer.current = window.setTimeout(() => {
      fired.current = true;
      setHeld(false);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
      onBoost();
    }, LONG_PRESS_MS);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!timer.current) return;
    if (Math.abs(e.clientX - start.current.x) > 10 || Math.abs(e.clientY - start.current.y) > 10) clear();
  };

  const onUp = () => {
    const wasPending = timer.current !== null;
    clear();
    if (wasPending && !fired.current) onExclude();
  };

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 14, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: held ? 0.955 : 1 }}
      exit={{ opacity: 0, scale: 0.55, filter: 'blur(6px)' }}
      transition={{ ...spring.settle, delay: settleDelay(index) }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${ri.display_name}. Tap to exclude, long press to prioritise.`}
      className="hairline"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '10px 14px',
        borderRadius: 'var(--r-pill)',
        background: boosted ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.66)',
        backdropFilter: 'blur(18px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
        boxShadow: boosted ? 'var(--lift-2)' : 'var(--lift-1)',
        color: 'var(--ink)',
        fontSize: 13.5,
        fontWeight: 300,
        letterSpacing: '-0.012em',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {boosted && <Orbit />}
      <span style={{ position: 'relative', zIndex: 1 }}>{ri.display_name}</span>
      {swapped && (
        <span
          className="t-label"
          style={{ position: 'relative', zIndex: 1, fontSize: 8.5, color: 'var(--ink-30)', letterSpacing: '0.12em' }}
        >
          swap
        </span>
      )}
      {ri.role === 'optional' && (
        <span style={{ position: 'relative', zIndex: 1, width: 3, height: 3, borderRadius: 3, background: 'var(--ink-14)' }} />
      )}
    </motion.button>
  );
}

/** Thin dotted ring that keeps turning while an ingredient is prioritised. */
function Orbit() {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1, rotate: 360 }}
      transition={{
        opacity: { duration: 0.3 },
        scale: spring.dial,
        rotate: { duration: 14, repeat: Infinity, ease: 'linear' },
      }}
      style={{
        position: 'absolute',
        inset: -4,
        borderRadius: 'var(--r-pill)',
        border: '1px dashed rgba(14,15,17,0.32)',
        pointerEvents: 'none',
      }}
    />
  );
}
