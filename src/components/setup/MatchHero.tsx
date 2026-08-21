'use client';

import { motion } from 'motion/react';
import { GradientField, type Tone } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { spring } from '@/lib/motion';

/**
 * The readout at the top of the instrument.
 *
 * One dot per recipe in the collection, lit when it survives the current filters,
 * plus the live count — so over-filtering is something you see before you commit
 * to it. Rose throughout; only the depth shifts when nothing is left.
 */

type Props = {
  matching: number;
  total: number;
  litMap: boolean[];
};

export function MatchHero({ matching, total, litMap }: Props) {
  const tone: Tone = matching === 0 ? 'heroThin' : 'hero';
  const caption =
    matching === 0
      ? 'Nothing matches. Loosen something.'
      : matching === total
        ? 'Everything is on the table'
        : `of ${total} recipes`;

  return (
    <Squircle
      as="section"
      radius={34}
      stroke="lume"
      className="grain"
      style={{
        flex: '0 0 auto',
        minHeight: 152,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px 11px',
        boxShadow: 'var(--lift-2)',
      }}
    >
      <GradientField tone={tone} blur={30} />

      {/* concentric rings behind the count, as on the reference tile */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        style={{
          position: 'absolute',
          left: '50%',
          top: '52%',
          width: 158,
          height: 158,
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
          opacity: 0.5,
        }}
      >
        {[42, 62, 82].map((r, i) => (
          <motion.circle
            key={r}
            // the same slow counter-rotation as the launch ripple, so the two
            // instrument surfaces feel driven by one mechanism
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 58 + i * 16, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '100px 100px' }}
            cx={100}
            cy={100}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={0.7}
            strokeDasharray={i === 1 ? '1.5 6' : '1 7'}
          />
        ))}
      </svg>

      <p className="t-micro" style={{ position: 'relative', zIndex: 2, margin: 0, color: 'var(--lume-70)' }}>
        Matching now
      </p>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <DottedNumber value={matching} size={54} color="#fff" weight={0.6} glow />
      </div>

      <div style={{ position: 'relative', zIndex: 2, width: '100%', textAlign: 'center' }}>
        <p className="t-micro" style={{ margin: '0 0 7px', color: 'var(--lume-70)' }}>
          {caption}
        </p>
        <RecipeDots litMap={litMap} />
      </div>
    </Squircle>
  );
}

/** Literal readout: every recipe you own, one dot each. */
function RecipeDots({ litMap }: { litMap: boolean[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 6 }} aria-hidden>
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
