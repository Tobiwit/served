'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { GradientField, type Tone } from '@/components/glass/GradientField';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { sectorBounds, sectorCentre, sectorPath } from '@/lib/tracker/donut';
import { ease, spring } from '@/lib/motion';

/**
 * Everything you can log, as half a donut.
 *
 * The add button sits on the right edge of the bar, half in it, so the menu opens
 * as the right half of a ring around it — its flat side lies exactly along the bar
 * edge. Each option is a segment with an arc on the inside and a softly bowed edge
 * on the outside, separated by an even gap and rounded at all four corners.
 *
 * Every segment is finished exactly like an Explore card: its own complete colour
 * field (laid over the segment's own box, so each one carries the whole range of
 * its tone rather than a sliver of a shared one), the lume hairline, film grain, a
 * lifted shadow, and the cards' type — light white labels, dotted numerals.
 *
 * Picking an option that has its own choices swaps the ring in place; the button in
 * the middle becomes a back arrow. Escape or a tap anywhere else closes it.
 */

export interface RadialOption {
  key: string;
  label: string;
  /** a reading drawn in dotted numerals, e.g. "+100" — the label then sits small underneath */
  big?: string;
  tone: Tone;
  icon?: React.ReactNode;
  /** a quiet second line, e.g. "150 ml oat milk" */
  sub?: string;
}

const BUTTON = 64;
const GAP = 7;
/** generous outer corners; the inner ones are capped by how narrow segments get there */
const CORNER = 24;
const INNER_CORNER = 12;
/** between the straight cut (0) and the full circle (1) */
const BULGE = 0.5;
/** clear space between the button and where the segments begin */
const CLEARANCE = 30;

export function RadialMenu({
  anchor,
  level,
  options,
  canGoBack,
  onPick,
  onBack,
  onClose,
}: {
  /** the add button's box; null closes the menu */
  anchor: DOMRect | null;
  /** changes whenever the ring is swapped, so the new segments sweep in afresh */
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
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const inner = BUTTON / 2 + CLEARANCE;
  // as large as the screen allows to the right, and never off the top or bottom
  const outer = Math.max(inner + 90, Math.min(186, vw - cx - 12, cy - 12, vh - cy - 12));

  const n = options.length;
  const step = 180 / n;

  return createPortal(
    <AnimatePresence>
      {anchor && (
        <motion.div
          key="donut"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: ease.glass }}
          style={{ position: 'fixed', inset: 0, zIndex: 70 }}
        >
          {/* No veil: the page fades its own right column out from under the ring,
              and everything else stays exactly as it was. This only catches the tap
              that closes the menu. */}
          <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />

          <AnimatePresence mode="popLayout">
            {options.map((o, i) => {
              const from = -90 + step * i;
              const to = from + step;
              const d = sectorPath({ cx: outer, cy: outer, inner, outer, from, to, gap: GAP, corner: CORNER, innerCorner: INNER_CORNER, bulge: BULGE });
              const compact = n > 4;
              // Segments are widest towards the outside, and the two at the ends are the
              // narrowest of all where they meet the bar — their content sits furthest out
              const end = i === 0 || i === n - 1;
              const c = sectorCentre(outer, outer, inner, outer, from, to, end ? 0.64 : compact ? 0.6 : 0.52);
              const b = sectorBounds(outer, outer, inner, outer, from, to);
              return (
                // the wrapper carries the shadow — a clip-path would cut it off the
                // segment itself — and never takes a tap: its box overlaps the others
                <motion.div
                  key={`${level}-${o.key}`}
                  initial={{ scale: 0.6, opacity: 0, rotate: -16 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.16, ease: ease.depart } }}
                  transition={{ ...spring.settle, delay: i * 0.035 }}
                  style={{
                    position: 'absolute',
                    left: cx - outer,
                    top: cy - outer,
                    width: outer * 2,
                    height: outer * 2,
                    transformOrigin: `${outer}px ${outer}px`,
                    pointerEvents: 'none',
                    filter: 'drop-shadow(0 1px 1px rgba(14,15,17,0.04)) drop-shadow(0 12px 14px rgba(14,15,17,0.16))',
                  }}
                >
                  <motion.button
                    type="button"
                    onClick={() => onPick(o.key)}
                    aria-label={o.big ? `${o.label} ${o.big}` : o.label}
                    className="grain"
                    whileTap={{ scale: 0.97 }}
                    transition={spring.dial}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      clipPath: `path("${d}")`,
                      transformOrigin: `${c.x}px ${c.y}px`,
                      isolation: 'isolate',
                      pointerEvents: 'auto',
                    }}
                  >
                    <div style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h }}>
                      <GradientField tone={o.tone} blur={26} />
                    </div>
                    <svg
                      aria-hidden
                      width={outer * 2}
                      height={outer * 2}
                      style={{ position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none' }}
                    >
                      <path d={d} fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth={1.4} />
                    </svg>
                    <span
                      style={{
                        position: 'absolute',
                        left: c.x,
                        top: c.y,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      {o.icon}
                      {o.big && <DottedNumber value={o.big} size={compact ? 17 : 24} color="#fff" weight={0.62} glow animate={false} />}
                      <span
                        className={o.big ? 't-micro' : undefined}
                        style={
                          o.big
                            ? { color: 'var(--lume-70)', fontSize: 10.5 }
                            : { fontSize: compact ? 14 : 16, fontWeight: 300, letterSpacing: '-0.022em', lineHeight: 1.2 }
                        }
                      >
                        {o.label}
                      </span>
                      {o.sub && (
                        <span className="t-micro" style={{ color: 'var(--lume-70)', fontSize: 10.5, marginTop: -2 }}>
                          {o.sub}
                        </span>
                      )}
                    </span>
                  </motion.button>
                </motion.div>
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
              left: cx - BUTTON / 2,
              top: cy - BUTTON / 2,
              width: BUTTON,
              height: BUTTON,
              borderRadius: '50%',
              background: 'var(--ink)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              boxShadow: 'var(--lift-3)',
            }}
          >
            {canGoBack ? (
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M11 4 6 9l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
                <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
