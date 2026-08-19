'use client';

import { motion } from 'motion/react';
import { Ripple } from '@/components/instrument/Ripple';
import { ease, spring } from '@/lib/motion';

/** The controls around the Explore stage. Deliberately few and deliberately quiet. */

export function ExploreTopBar({
  onClose,
  onReset,
  remaining,
}: {
  onClose: () => void;
  onReset: () => void;
  remaining: number;
}) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <RoundControl label="Back to filters" onClick={onClose}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
          <path d="M9.5 2.5 4.5 7.5l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </RoundControl>

      <span className="t-micro t-dim">{remaining} left in this run</span>

      <RoundControl label="Reset this run" onClick={onReset}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
          <path
            d="M12.2 7.5a4.7 4.7 0 1 1-1.5-3.4M12.4 2.1v2.8H9.6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </RoundControl>
    </header>
  );
}

function RoundControl({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileTap={{ scale: 0.93 }}
      transition={spring.dial}
      className="hairline"
      style={{
        width: 38,
        height: 38,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 38,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: 'var(--ink-70)',
        boxShadow: 'var(--lift-1)',
        flex: '0 0 auto',
      }}
    >
      {children}
    </motion.button>
  );
}

export function SkipBar({ onSkip, onCook }: { onSkip: () => void; onCook: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
      <motion.button
        type="button"
        onClick={onSkip}
        whileTap={{ scale: 0.975 }}
        transition={spring.dial}
        className="hairline"
        style={{
          flex: '0 0 auto',
          padding: '14px 22px',
          borderRadius: 'var(--r-pill)',
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: 'var(--ink-70)',
          fontSize: 14,
          fontWeight: 300,
          boxShadow: 'var(--lift-1)',
        }}
      >
        Not this
      </motion.button>

      <motion.button
        type="button"
        onClick={onCook}
        whileTap={{ scale: 0.975 }}
        transition={spring.dial}
        style={{
          flex: 1,
          padding: '14px 22px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--ink)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 300,
          letterSpacing: '-0.01em',
          boxShadow: 'var(--lift-2)',
        }}
      >
        Cook this
      </motion.button>
    </div>
  );
}

export function Exhausted({
  hasExclusions,
  onReset,
  onEdit,
}: {
  hasExclusions: boolean;
  onReset: () => void;
  onEdit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: ease.arrive }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        textAlign: 'center',
      }}
    >
      <Ripple size={132} rings={5} ink="ink" />
      <div>
        <h2 className="t-title" style={{ margin: 0 }}>
          That is the whole shelf
        </h2>
        <p className="t-micro t-dim" style={{ margin: '10px auto 0', maxWidth: 270 }}>
          {hasExclusions
            ? 'Everything matching is either seen already or ruled out by what you removed.'
            : 'You have been through every recipe that matches these filters.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onReset}
          className="hairline"
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--paper)',
            fontSize: 14,
            fontWeight: 300,
            boxShadow: 'var(--lift-1)',
          }}
        >
          Start over
        </button>
        <button
          type="button"
          onClick={onEdit}
          style={{
            padding: '12px 20px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 300,
            boxShadow: 'var(--lift-2)',
          }}
        >
          Change filters
        </button>
      </div>
    </motion.div>
  );
}
