'use client';

import { motion } from 'motion/react';
import { GradientField, type Tone } from '@/components/glass/GradientField';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { spring } from '@/lib/motion';

/**
 * The readout at the top of the instrument.
 *
 * One dot per recipe in the collection, lit when it survives the current filters,
 * plus the live count. The colour field cools as the run gets more constrained,
 * so over-filtering is something you *see* before you press Explore.
 */

type Props = {
  matching: number;
  total: number;
  litMap: boolean[];
};

export function MatchHero({ matching, total, litMap }: Props) {
  const ratio = total > 0 ? matching / total : 0;
  const tone: Tone = matching === 0 ? 'boost' : ratio < 0.25 ? 'calories' : 'protein';
  const caption =
    matching === 0
      ? 'Nothing matches. Loosen something.'
      : matching === total
        ? 'Everything is on the table'
        : `of ${total} recipes`;

  return (
    <motion.section
      layout
      className="surface grain hairline-lume"
      style={{
        borderRadius: 'var(--r-xl)',
        overflow: 'hidden',
        padding: '20px 20px 18px',
        minHeight: 214,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--lift-2)',
      }}
    >
      <GradientField tone={tone} blur={30} />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', textAlign: 'center' }}>
        <p className="t-micro" style={{ margin: 0, color: 'var(--lume-70)', letterSpacing: '0.01em' }}>
          Matching now
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <DottedNumber value={matching} size={72} color="#fff" weight={0.68} glow />
      </div>

      <div style={{ position: 'relative', zIndex: 2, width: '100%', textAlign: 'center' }}>
        <p className="t-micro" style={{ margin: '0 0 14px', color: 'var(--lume-70)' }}>
          {caption}
        </p>
        <RecipeDots litMap={litMap} />
      </div>
    </motion.section>
  );
}

/** Literal readout: every recipe you own, one dot each. */
function RecipeDots({ litMap }: { litMap: boolean[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 8 }} aria-hidden>
      {litMap.map((lit, i) => (
        <motion.span
          key={i}
          initial={false}
          animate={{ width: lit ? 3.5 : 2.5, height: lit ? 3.5 : 2.5, opacity: lit ? 1 : 0.34 }}
          transition={spring.dial}
          style={{ display: 'block', borderRadius: 4, background: '#fff', flex: '0 0 auto' }}
        />
      ))}
    </div>
  );
}
