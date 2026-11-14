'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ease, spring } from '@/lib/motion';

/**
 * A ring of choices fanning out from the add button.
 *
 * The button sits against the right edge of the bar, so the ring opens to the right
 * as a half circle — every option is a thumb's reach from where the press started,
 * and none of them lands on the bar it is about to change. Picking an option that
 * has its own choices swaps the ring in place rather than stacking a second one;
 * the centre becomes a back button.
 */

export interface RadialOption {
  key: string;
  label: string;
  /** a large first line, e.g. "+100" — the label then sits small underneath */
  big?: string;
  color?: string;
  icon?: React.ReactNode;
}

const ITEM = 66;

export function RadialMenu({
  anchor,
  level,
  options,
  canGoBack,
  onPick,
  onBack,
  onClose,
}: {
  /** the add button's box; null closes the ring */
  anchor: DOMRect | null;
  /** changes whenever the ring is swapped, so the new options fan out afresh */
  level: string;
  options: RadialOption[];
  canGoBack: boolean;
  onPick: (key: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (canGoBack ? onBack : onClose)();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anchor, canGoBack, onBack, onClose]);

  if (!mounted) return null;

  const cx = anchor ? anchor.left + anchor.width / 2 : 0;
  const cy = anchor ? anchor.top + anchor.height / 2 : 0;

  // a half circle to the right; more options spread wider and reach further, but
  // never past the edge of the screen
  const n = options.length;
  const span = n <= 4 ? 140 : 180;
  const want = n <= 4 ? 112 : 128;
  const room = typeof window !== 'undefined' ? window.innerWidth - cx - ITEM / 2 - 10 : want;
  const radius = Math.max(92, Math.min(want, room));

  const place = (i: number) => {
    const deg = n === 1 ? 0 : -span / 2 + (span / (n - 1)) * i;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
  };

  return createPortal(
    <AnimatePresence>
      {anchor && (
        <motion.div
          key="radial"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: ease.glass }}
          style={{ position: 'fixed', inset: 0, zIndex: 70 }}
        >
          <div
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(236,236,237,0.66)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />

          <AnimatePresence mode="popLayout">
            {options.map((o, i) => {
              const p = place(i);
              return (
                <motion.button
                  key={`${level}-${o.key}`}
                  type="button"
                  onClick={() => onPick(o.key)}
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
                  animate={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
                  exit={{ x: 0, y: 0, scale: 0.3, opacity: 0, transition: { duration: 0.16, ease: ease.depart } }}
                  transition={{ ...spring.settle, delay: i * 0.03 }}
                  whileTap={{ scale: 0.92 }}
                  style={{
                    position: 'absolute',
                    left: cx - ITEM / 2,
                    top: cy - ITEM / 2,
                    width: ITEM,
                    height: ITEM,
                    borderRadius: '50%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    background: o.color ?? 'var(--paper)',
                    boxShadow: 'var(--lift-2), inset 0 0 0 1px var(--ink-08), inset 0 1px 0 rgba(255,255,255,0.7)',
                    color: 'var(--ink)',
                  }}
                >
                  {o.icon}
                  {o.big && (
                    <span style={{ fontSize: 17, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1 }}>{o.big}</span>
                  )}
                  <span
                    style={{
                      fontSize: o.big || o.icon ? 9.5 : 11,
                      fontWeight: o.big || o.icon ? 300 : 400,
                      lineHeight: 1.1,
                      color: o.big || o.icon ? 'var(--ink-70)' : 'var(--ink)',
                      maxWidth: ITEM - 8,
                      textAlign: 'center',
                    }}
                  >
                    {o.label}
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>

          {/* the centre: close at the first level, back from a nested one */}
          <motion.button
            type="button"
            onClick={canGoBack ? onBack : onClose}
            aria-label={canGoBack ? 'Back' : 'Close'}
            initial={{ rotate: 0 }}
            animate={{ rotate: canGoBack ? 0 : 45 }}
            transition={spring.dial}
            style={{
              position: 'absolute',
              left: anchor.left,
              top: anchor.top,
              width: anchor.width,
              height: anchor.height,
              borderRadius: '50%',
              background: 'var(--ink)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--lift-3)',
            }}
          >
            {canGoBack ? (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M11 4 6 9l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                <path d="M10 3.5v13M3.5 10h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
