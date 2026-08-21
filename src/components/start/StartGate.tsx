'use client';

import { useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { GradientField } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { Mechanism } from '@/components/explore/Mechanism';
import { ease, spring } from '@/lib/motion';

/**
 * The launch screen.
 *
 * A single rose plate almost filling the glass, the wordmark set above it in the
 * same dotted letterforms the instrument uses for its readings. Push it up and it
 * leaves the way a recipe does — tilting back, blurring, passing behind a frosted
 * plate that sweeps down — setting you on the filter dashboard underneath.
 */

const DISMISS_DISTANCE = 70;
const DISMISS_VELOCITY = 420;
/** matches the mechanism sweep, so the plate is gone before the gate unmounts */
const EXIT_MS = 520;

export function StartGate({ total, onDismiss }: { total: number; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);

  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(8);
    window.setTimeout(onDismiss, EXIT_MS);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -DISMISS_DISTANCE || info.velocity.y < -DISMISS_VELOCITY) leave();
  };

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--fog)',
        overflow: 'hidden',
        perspective: 1400,
      }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: leaving ? 0.42 : 0, ease: ease.glass, delay: leaving ? 0.16 : 0 }}
    >
      <div
        style={{
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: 'calc(var(--safe-t) + 26px) var(--shell-pad) calc(var(--safe-b) + 20px)',
        }}
      >
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: leaving ? 0 : 1, y: leaving ? -18 : 0 }}
          transition={{ duration: 0.55, ease: ease.arrive }}
          style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center' }}
        >
          <DottedNumber value="SERVED" size={30} color="var(--ink)" weight={0.55} spacing={1.75} />
        </motion.header>

        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.55, bottom: 0.02 }}
          onDragEnd={onDragEnd}
          onClick={leave}
          animate={
            leaving
              ? { y: '-108%', scale: 0.88, rotateX: 14, filter: 'blur(9px)', opacity: 0 }
              : { y: 0, scale: 1, rotateX: 0, filter: 'blur(0px)', opacity: 1 }
          }
          transition={leaving ? { ...spring.carriage, filter: { duration: 0.34 } } : spring.panel}
          style={{
            flex: 1,
            minHeight: 0,
            transformStyle: 'preserve-3d',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <Squircle
            radius={38}
            stroke="lume"
            className="grain"
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              boxShadow: 'var(--lift-3)',
            }}
          >
            <GradientField tone="hero" blur={40} />

            <svg
              aria-hidden
              viewBox="0 0 200 200"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '86%',
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                opacity: 0.45,
              }}
            >
              {[52, 72, 92].map((r, i) => (
                <motion.circle
                  key={r}
                  cx={100}
                  cy={100}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth={0.6}
                  strokeDasharray={i === 1 ? '1.5 6' : '1 7'}
                  animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
                  transition={{ duration: 64 + i * 18, repeat: Infinity, ease: 'linear' }}
                  style={{ transformOrigin: '100px 100px' }}
                />
              ))}
            </svg>

            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
              <DottedNumber value={total} size={76} color="#fff" weight={0.64} glow />
            </div>

            <p
              className="t-micro"
              style={{ position: 'relative', zIndex: 2, margin: 0, color: 'var(--lume-70)' }}
            >
              {total === 1 ? 'recipe on the shelf' : 'recipes on the shelf'}
            </p>
          </Squircle>
        </motion.div>

        <motion.footer
          animate={{ opacity: leaving ? 0 : 1 }}
          transition={{ duration: 0.3, ease: ease.depart }}
          style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <motion.span
            aria-hidden
            animate={{ y: [0, -5, 0], opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 34, height: 3.5, borderRadius: 4, background: 'var(--ink-30)' }}
          />
          <button type="button" onClick={leave} className="t-micro t-dim" style={{ padding: '2px 8px' }}>
            Swipe up to begin
          </button>
        </motion.footer>
      </div>

      <AnimatePresence>{leaving && <Mechanism token={1} direction={1} onDone={() => {}} />}</AnimatePresence>
    </motion.div>
  );
}
