'use client';

import { AnimatePresence, motion } from 'motion/react';
import { GradientField } from '@/components/glass/GradientField';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { DottedScale } from '@/components/instrument/DottedScale';
import { QUANT_SPECS, describeQuant, type Quant, type QuantKey } from '@/lib/explore/filters';
import { ease, spring } from '@/lib/motion';

/**
 * A quantitative filter module.
 *
 * Off, it is a quiet near-white tile holding half a column. Tapping it engages the
 * filter: the tile takes the full width, the colour field comes up underneath the
 * glass, and the dotted scale extends out of the bottom edge for exact adjustment.
 * The size change *is* the state change.
 */

type Props = {
  spec: (typeof QUANT_SPECS)[QuantKey];
  state: Quant;
  onToggle: () => void;
  onValue: (v: number) => void;
};

export function QuantModule({ spec, state, onToggle, onValue }: Props) {
  const on = state.on;

  return (
    <motion.div
      layout
      transition={spring.panel}
      style={{ gridColumn: on ? 'span 2' : 'span 1', minWidth: 0 }}
    >
      <motion.div
        layout
        className={on ? 'surface grain hairline-lume' : 'surface hairline'}
        style={{
          position: 'relative',
          borderRadius: on ? 'var(--r-xl)' : 'var(--r-lg)',
          overflow: 'hidden',
          padding: on ? '16px 18px 12px' : '14px 15px 15px',
          minHeight: on ? 186 : 118,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: on ? 'var(--lift-2)' : 'var(--lift-1)',
        }}
      >
        <AnimatePresence>
          {on && (
            <motion.div
              key="field"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.42, ease: ease.glass }}
              style={{ position: 'absolute', inset: 0, borderRadius: 'inherit' }}
            >
              <GradientField tone={spec.tone} blur={28} rotate={spec.key === 'health' ? 18 : 0} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* the whole face is the switch; the scale below is not */}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={on}
          aria-label={`${spec.label} filter`}
          style={{
            position: 'relative',
            zIndex: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <motion.span
              layout="position"
              className="t-micro"
              style={{ color: on ? 'var(--lume-70)' : 'var(--ink-45)' }}
            >
              {spec.label}
            </motion.span>
            <Pip on={on} />
          </div>

          <div style={{ width: '100%' }}>
            {on ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.34, ease: ease.arrive }}
                style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}
              >
                <DottedNumber value={state.value} size={46} color="#fff" weight={0.62} glow />
                {spec.unit && (
                  <span className="t-micro" style={{ color: 'var(--lume-70)', paddingBottom: 5 }}>
                    {spec.unit}
                  </span>
                )}
              </motion.div>
            ) : (
              <div>
                <div className="t-sub" style={{ color: 'var(--ink)' }}>
                  {spec.preset}
                </div>
                <div className="t-micro t-dim-2" style={{ marginTop: 2 }}>
                  {describeQuant(spec.key, state.value)}
                </div>
              </div>
            )}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {on && (
            <motion.div
              key="scale"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: ease.glass }}
              style={{ position: 'relative', zIndex: 2, overflow: 'hidden' }}
            >
              <div style={{ paddingTop: 10 }}>
                <DottedScale
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={state.value}
                  onChange={onValue}
                  direction={spec.direction}
                  labels={spec.labels}
                  unit={spec.unit}
                  label={spec.label}
                  ink="lume"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/** The engaged indicator: a ring that fills. */
function Pip({ on }: { on: boolean }) {
  return (
    <span
      style={{
        position: 'relative',
        width: 18,
        height: 18,
        borderRadius: 18,
        flex: '0 0 auto',
        boxShadow: on ? 'inset 0 0 0 1px rgba(255,255,255,0.75)' : 'inset 0 0 0 1px var(--ink-14)',
        transition: 'box-shadow 300ms ease',
      }}
    >
      <motion.span
        initial={false}
        animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={spring.dial}
        style={{
          position: 'absolute',
          inset: 4.5,
          borderRadius: 9,
          background: '#fff',
          display: 'block',
        }}
      />
    </span>
  );
}
