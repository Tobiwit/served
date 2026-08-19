'use client';

import { motion } from 'motion/react';
import { GradientField } from '@/components/glass/GradientField';
import { Ripple } from '@/components/instrument/Ripple';
import { ease, spring } from '@/lib/motion';

/**
 * The primary action. Not a filled button: a wide glass plate with the count
 * living inside it, so pressing it reads as engaging the instrument rather than
 * submitting a form.
 */

export function LaunchBar({ count, onStart }: { count: number; onStart: () => void }) {
  const disabled = count === 0;

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 8px)',
        zIndex: 20,
        marginTop: 26,
      }}
    >
      {/* full-bleed scrim so content scrolling behind the bar fades into the fog
          instead of colliding with it */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 'calc(-1 * var(--shell-pad))',
          right: 'calc(-1 * var(--shell-pad))',
          top: -34,
          bottom: -22,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(236,236,237,0) 0%, rgba(236,236,237,0.86) 34%, rgba(236,236,237,0.96) 100%)',
        }}
      />
      <motion.button
        type="button"
        onClick={onStart}
        disabled={disabled}
        whileTap={disabled ? undefined : { scale: 0.985 }}
        transition={spring.dial}
        className="surface grain hairline-lume"
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxShadow: 'var(--lift-3)',
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <GradientField tone={disabled ? 'neutral' : 'engage'} blur={26} />

        <span
          style={{
            position: 'absolute',
            right: -14,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1,
            opacity: 0.5,
          }}
        >
          <Ripple size={104} rings={4} ink="lume" animate={!disabled} />
        </span>

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
      </motion.button>
    </div>
  );
}
