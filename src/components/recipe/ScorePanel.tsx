'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GradientField, type Tone } from '@/components/glass/GradientField';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { ArcGauge } from '@/components/instrument/ArcGauge';
import type { ScoreResult } from '@/lib/scoring';
import { ease, spring } from '@/lib/motion';

/**
 * A score with its reasoning attached. The number is never shown without a way to
 * see what produced it — these are the app's own heuristics, not medical fact, and
 * the interface should say so by being auditable.
 */

export function ScorePanel({
  title,
  result,
  tone,
  note,
}: {
  title: string;
  result: ScoreResult;
  tone: Tone;
  note: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.section
      layout
      transition={spring.panel}
      className="surface grain hairline-lume"
      style={{ borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--lift-2)' }}
    >
      <GradientField tone={tone} blur={30} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          textAlign: 'left',
        }}
      >
        <span style={{ position: 'relative', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
          <ArcGauge value={result.score} size={72} ink="lume" count={24} />
          <span style={{ position: 'absolute' }}>
            <DottedNumber value={result.score} size={26} color="#fff" weight={0.6} glow />
          </span>
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="t-micro" style={{ display: 'block', color: 'var(--lume-70)' }}>
            {title}
          </span>
          <span className="t-sub" style={{ display: 'block', color: '#fff', marginTop: 2 }}>
            {result.verdict}
          </span>
          <span className="t-micro" style={{ display: 'block', color: 'var(--lume-70)', marginTop: 3, opacity: 0.85 }}>
            {open ? 'Hide reasoning' : 'Why this score'}
          </span>
        </span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={spring.dial}
          style={{ color: '#fff', opacity: 0.8, flex: '0 0 auto' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3.5 5.5 7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: ease.glass }}
            style={{ position: 'relative', zIndex: 2, overflow: 'hidden' }}
          >
            <div style={{ padding: '0 18px 18px' }}>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.28)', marginBottom: 14 }} />
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
                {result.positives.map((f) => (
                  <Factor key={f.label} sign="+" label={f.label} />
                ))}
                {result.negatives.map((f) => (
                  <Factor key={f.label} sign="−" label={f.label} />
                ))}
              </ul>
              <p className="t-micro" style={{ margin: '14px 0 0', color: 'var(--lume-70)', lineHeight: 1.5 }}>
                {note}
                {result.confidence < 0.95 && ` Nutrition data covers ${Math.round(result.confidence * 100)}% of this recipe by weight.`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function Factor({ sign, label }: { sign: '+' | '−'; label: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span
        style={{
          width: 11,
          flex: '0 0 auto',
          color: '#fff',
          opacity: sign === '+' ? 0.95 : 0.6,
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        {sign}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 300, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.012em' }}>
        {label}
      </span>
    </li>
  );
}
