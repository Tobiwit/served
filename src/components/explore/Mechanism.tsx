'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ease } from '@/lib/motion';

/**
 * The glass mechanism.
 *
 * Fires once per recipe change: a frosted plate makes a single pass across the
 * stage while two dotted arcs counter-rotate behind it. The outgoing recipe sinks
 * behind this layer and the incoming one arrives in front of it. Nothing here is
 * interactive — it exists to make a change of state feel like a device moving.
 */

const SWEEP_MS = 620;

export function Mechanism({
  token,
  direction,
  onDone,
}: {
  token: number;
  direction: 1 | -1;
  onDone: () => void;
}) {
  const from = direction > 0 ? '-108%' : '108%';
  const to = direction > 0 ? '108%' : '-108%';

  return (
    <AnimatePresence>
      {token > 0 && (
        <motion.div
          key={token}
          aria-hidden
          onAnimationComplete={onDone}
          initial={{ y: from, rotate: direction > 0 ? -3 : 3 }}
          animate={{ y: to, rotate: direction > 0 ? 3 : -3 }}
          transition={{ duration: SWEEP_MS / 1000, ease: ease.glass }}
          style={{
            position: 'absolute',
            left: '-10%',
            right: '-10%',
            top: 0,
            bottom: 0,
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 40%, rgba(255,255,255,0.5) 60%, rgba(255,255,255,0) 100%)',
              backdropFilter: 'blur(16px) saturate(1.35)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.35)',
            }}
          />
          {/* the leading and trailing edges of the plate catch the light */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, transparent 38%, rgba(255,255,255,0.85) 40%, transparent 42%, transparent 58%, rgba(255,255,255,0.6) 60%, transparent 62%)',
            }}
          />

          <motion.svg
            viewBox="0 0 200 200"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: [0, 0.9, 0.9, 0], scale: 1 }}
            transition={{ duration: SWEEP_MS / 1000, ease: ease.glass, times: [0, 0.22, 0.7, 1] }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '140%',
              height: '140%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <circle cx={100} cy={100} r={72} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={0.5} strokeDasharray="1 5" />
            <motion.circle
              cx={100}
              cy={100}
              r={54}
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={0.7}
              strokeDasharray="26 160"
              strokeLinecap="round"
              initial={{ rotate: direction > 0 ? -64 : 64 }}
              animate={{ rotate: direction > 0 ? 64 : -64 }}
              transition={{ duration: SWEEP_MS / 1000, ease: ease.glass }}
              style={{ transformOrigin: '100px 100px' }}
            />
            <motion.circle
              cx={100}
              cy={100}
              r={88}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={0.5}
              strokeDasharray="14 200"
              strokeLinecap="round"
              initial={{ rotate: direction > 0 ? 48 : -48 }}
              animate={{ rotate: direction > 0 ? -48 : 48 }}
              transition={{ duration: SWEEP_MS / 1000, ease: ease.glass }}
              style={{ transformOrigin: '100px 100px' }}
            />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const MECHANISM_MS = SWEEP_MS;
