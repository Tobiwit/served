'use client';

import { motion } from 'motion/react';
import { GradientField } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import { Ripple } from '@/components/instrument/Ripple';
import { ease, spring } from '@/lib/motion';

/**
 * The primary action. Not a filled button — a wide glass plate with the count
 * living inside it, so pressing it reads as engaging the instrument rather than
 * submitting a form. The dashboard above is sized to leave exactly this much room.
 */

export function LaunchBar({ count, onStart }: { count: number; onStart: () => void }) {
  const disabled = count === 0;

  return (
    <motion.div
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={spring.dial}
      style={{ flex: '0 0 auto' }}
    >
      <Squircle
        radius={28}
        stroke={disabled ? 'ink' : 'lume'}
        className={disabled ? undefined : 'grain'}
        style={{
          boxShadow: disabled ? 'var(--lift-1)' : 'var(--lift-3)',
          background: disabled ? 'var(--paper)' : undefined,
          opacity: disabled ? 0.72 : 1,
        }}
      >
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          style={{
            position: 'relative',
            width: '100%',
            padding: '15px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {!disabled && <GradientField tone="engage" blur={26} />}

          {!disabled && (
            <span
              aria-hidden
              style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, opacity: 0.45 }}
            >
              <Ripple size={92} rings={4} ink="lume" />
            </span>
          )}

          <motion.span
            key={disabled ? 'off' : 'on'}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.34, ease: ease.arrive }}
            className="t-sub"
            style={{ position: 'relative', zIndex: 2, color: disabled ? 'var(--ink-45)' : '#fff' }}
          >
            {disabled ? 'No recipes match' : 'Explore recipes'}
          </motion.span>

          {!disabled && (
            <span className="t-micro" style={{ position: 'relative', zIndex: 2, color: 'var(--lume-70)' }}>
              {count} match{count === 1 ? '' : 'es'}
            </span>
          )}
        </button>
      </Squircle>
    </motion.div>
  );
}
