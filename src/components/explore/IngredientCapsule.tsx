'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { settleDelay, spring } from '@/lib/motion';

/**
 * An ingredient slot.
 *
 * A swappable slot holds several options, but only ever shows the one the recipe is
 * currently made with, marked by a ⇄ to say something else could stand in. Decline
 * it and the pill goes dark in place while the next option grows out from behind
 * it — again and again until the slot runs out, at which point the recipe goes.
 *
 * Declined pills keep their position, so the thing under your finger never changes
 * identity mid-gesture.
 *
 *   tap a live pill        rule it out
 *   hold a live pill       prioritise recipes containing it
 *   hold a darkened pill   put it back
 */

const LONG_PRESS_MS = 420;

export interface CapsuleOption {
  id: string;
  name: string;
  killed: boolean;
  /** the first surviving option — what the recipe is made with right now */
  inUse: boolean;
  boosted: boolean;
}

type Props = {
  /** only the options revealed so far: every declined one, plus the live one */
  revealed: CapsuleOption[];
  /** there are still untried options hiding behind the last pill */
  hasMore: boolean;
  index: number;
  /** the named ingredient is out, so the slot is running on a stand-in */
  swapped: boolean;
  optional: boolean;
  onTap: (option: CapsuleOption) => void;
  onHold: (option: CapsuleOption) => void;
};

export function IngredientCapsule({ revealed, hasMore, index, swapped, optional, onTap, onHold }: Props) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.55, filter: 'blur(6px)' }}
      transition={{ ...spring.settle, delay: settleDelay(index) }}
      className="hairline"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        // a long chain wraps inside its own capsule rather than off the screen; at
        // one line this radius still reads as a pill, at two as a rounded plate
        maxWidth: '100%',
        gap: 1,
        rowGap: 3,
        padding: '4px 5px',
        borderRadius: 21,
        background: swapped ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow: swapped
          ? 'inset 0 0 0 1.2px rgba(233,99,60,0.8), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 3px rgba(233,99,60,0.08), 0 8px 18px -12px rgba(14,15,17,0.3)'
          : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 1px rgba(14,15,17,0.03), 0 8px 16px -12px rgba(14,15,17,0.24)',
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {revealed.map((o, i) => (
          <motion.span
            key={o.id}
            layout
            // the newcomer slides out from underneath the pill that was declined
            initial={{ opacity: 0, x: -20, scale: 0.84 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -14, scale: 0.84 }}
            transition={spring.settle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              // declined pills sit above, so the next appears to emerge from behind
              zIndex: o.killed ? 2 : 1,
            }}
          >
            {i > 0 && <SwapGlyph color={swapped ? '#e9633c' : 'var(--ink-30)'} />}
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {o.boosted && !o.killed && <BoostOrbit />}
              <Pill option={o} onTap={onTap} onHold={onHold} />
            </span>
          </motion.span>
        ))}
      </AnimatePresence>

      {hasMore && (
        <motion.span layout style={{ display: 'inline-flex', paddingRight: 5, paddingLeft: 3 }}>
          <SwapGlyph color={swapped ? '#e9633c' : 'var(--ink-30)'} />
        </motion.span>
      )}

      {optional && (
        <span aria-hidden style={{ width: 3, height: 3, borderRadius: 3, background: 'var(--ink-14)', margin: '0 6px 0 2px' }} />
      )}
    </motion.div>
  );
}

function Pill({
  option,
  onTap,
  onHold,
}: {
  option: CapsuleOption;
  onTap: (o: CapsuleOption) => void;
  onHold: (o: CapsuleOption) => void;
}) {
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
    // capture the state at press time: a hold that restores must never also boost,
    // even though the pill goes live the instant the restore lands
    const pressed = option;
    timer.current = window.setTimeout(() => {
      fired.current = true;
      setHeld(false);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
      onHold(pressed);
    }, LONG_PRESS_MS);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!timer.current) return;
    if (Math.abs(e.clientX - start.current.x) > 10 || Math.abs(e.clientY - start.current.y) > 10) clear();
  };

  const onUp = () => {
    const pending = timer.current !== null;
    const alreadyFired = fired.current;
    clear();
    // a darkened pill only comes back on a hold, so a tap on it does nothing
    if (pending && !alreadyFired && !option.killed) onTap(option);
  };

  return (
    <motion.button
      type="button"
      layout
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={clear}
      onPointerLeave={clear}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={
        option.killed
          ? `${option.name}, ruled out. Hold to put it back.`
          : `${option.name}. Tap to rule out, hold to prioritise.`
      }
      animate={{ scale: held ? 0.94 : 1 }}
      transition={spring.dial}
      style={{
        position: 'relative',
        zIndex: 1,
        padding: '6px 10px',
        borderRadius: 'var(--r-pill)',
        fontSize: 13.5,
        fontWeight: 300,
        letterSpacing: '-0.012em',
        whiteSpace: 'nowrap',
        // Ruled out is pressed *into* the glass, not painted black: a faint tinted
        // recess with a soft inner shadow and a lit bottom lip. Live pills sit
        // proud of the same surface. Same material, opposite relief.
        color: option.killed ? 'var(--ink-30)' : 'var(--ink)',
        textDecoration: option.killed ? 'line-through' : 'none',
        textDecorationColor: option.killed ? 'var(--ink-14)' : undefined,
        background: option.killed
          ? 'linear-gradient(180deg, rgba(14,15,17,0.075) 0%, rgba(14,15,17,0.03) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.72) 100%)',
        boxShadow: option.killed
          ? 'inset 0 1.5px 3px rgba(14,15,17,0.16), inset 0 -1px 0 rgba(255,255,255,0.8)'
          : option.boosted
            ? '0 2px 5px rgba(14,15,17,0.13), 0 0 0 1px rgba(14,15,17,0.07), inset 0 1px 0 rgba(255,255,255,1)'
            : '0 1px 2px rgba(14,15,17,0.09), inset 0 1px 0 rgba(255,255,255,1)',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {option.name}
    </motion.button>
  );
}

/** Two arrows passing — the mark for "something else could stand in here". */
function SwapGlyph({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flex: '0 0 auto' }} aria-hidden>
      <path d="M1.5 4h8M7.5 2 9.5 4 7.5 6" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 8h-8M4.5 6 2.5 8l2 2" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Prioritised marker.
 *
 * A pulse radiating out from the pill, drawn in the same fine dotted linework as the
 * launch ripple and the plate aperture. One ring holds steady so the pill stays
 * marked at rest; three more light and fade outward in sequence, which reads as
 * radiance without drawing a single heavy stroke.
 *
 * The rings are fixed geometry and only their opacity animates — no path is
 * regenerated, nothing is scaled, so the corners never distort.
 */
function BoostOrbit() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const host = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const read = () => {
      const { width, height } = node.getBoundingClientRect();
      setBox((p) => (Math.abs(p.w - width) < 0.5 && Math.abs(p.h - height) < 0.5 ? p : { w: width, h: height }));
    };
    const ro = new ResizeObserver(read);
    ro.observe(node);
    read();
    return () => ro.disconnect();
  }, []);

  const rings = useMemo(() => {
    if (box.w <= 0 || box.h <= 0) return [];
    return RINGS.map((r) => ({
      ...r,
      d: stadiumPath(box.w + r.out * 2, box.h + r.out * 2),
    }));
  }, [box]);

  return (
    <span ref={host} aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {rings.length > 0 && (
        <svg width={box.w} height={box.h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {rings.map((r, i) => (
            <motion.path
              key={i}
              d={r.d}
              transform={`translate(${-r.out} ${-r.out})`}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.7}
              // a zero-length dash with a round cap draws a true dot rather than a
              // short line; the shadow gives it definition against pale glass
              strokeDasharray="0.01 5.4"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0.5px 0.9px rgba(14,15,17,0.42))' }}
              initial={false}
              animate={r.hold ? { opacity: 0.95 } : { opacity: [0, 0.8, 0] }}
              transition={
                r.hold
                  ? { duration: 0.4 }
                  : { duration: 2.6, times: [0, 0.35, 1], repeat: Infinity, ease: 'easeOut', delay: r.delay }
              }
            />
          ))}
        </svg>
      )}
    </span>
  );
}

/**
 * A true stadium — circular end caps, matching `border-radius: 999px` on the pill.
 * The squircle used elsewhere is deliberately fuller at the corners, which read as
 * a mismatch when laid directly over a pill outline.
 */
function stadiumPath(w: number, h: number): string {
  const r = Math.min(h / 2, w / 2);
  if (r <= 0) return '';
  const right = Math.max(r, w - r);
  return `M ${r} 0 H ${right} A ${r} ${r} 0 0 1 ${right} ${h} H ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

/** the steady marker, then three pulses leaving in sequence */
const RINGS = [
  { out: 2.5, hold: true, delay: 0 },
  { out: 6, hold: false, delay: 0 },
  { out: 10, hold: false, delay: 0.32 },
  { out: 14.5, hold: false, delay: 0.64 },
];
