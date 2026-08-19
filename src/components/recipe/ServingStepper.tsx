'use client';

import { motion } from 'motion/react';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { spring } from '@/lib/motion';

/**
 * Scaling servings multiplies the ingredient quantities on screen. It never
 * touches per-serving nutrition — that stays the property of one serving, which is
 * the whole reason nutrition is computed per serving in the first place.
 */
export function ServingStepper({
  value,
  base,
  onChange,
}: {
  value: number;
  base: number;
  onChange: (v: number) => void;
}) {
  return (
    <section
      className="surface hairline"
      style={{
        marginTop: 26,
        borderRadius: 'var(--r-lg)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div className="t-micro t-dim">Servings</div>
        {value !== base && (
          <div className="t-micro t-dim-2" style={{ marginTop: 2, fontSize: 11 }}>
            scaled from {base}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Step label="One fewer serving" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}>
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
            <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </Step>

        <span style={{ minWidth: 40, display: 'grid', placeItems: 'center' }}>
          <DottedNumber value={value} size={24} color="var(--ink)" weight={0.6} />
        </span>

        <Step label="One more serving" disabled={value >= 20} onClick={() => onChange(Math.min(20, value + 1))}>
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
            <path d="M3 6.5h7M6.5 3v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </Step>
      </div>
    </section>
  );
}

function Step({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={spring.dial}
      className="hairline"
      style={{
        width: 34,
        height: 34,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 34,
        background: 'var(--paper)',
        color: 'var(--ink-70)',
        opacity: disabled ? 0.35 : 1,
        boxShadow: 'var(--lift-1)',
      }}
    >
      {children}
    </motion.button>
  );
}
