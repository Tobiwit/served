'use client';

import { motion } from 'motion/react';
import { GradientField, type Tone } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import { DottedNumber } from '@/components/instrument/DottedNumber';
import { ease, spring } from '@/lib/motion';

/**
 * A filter panel. Always at full size — the dashboard is a fixed instrument face,
 * not a list that grows. Engaging one does not move anything: the colour field
 * comes up under the glass and the scale goes live. Nothing reflows, ever.
 *
 *   full     label, then the reading, then the scale filling what is left
 *   compact  label and reading share one line, scale below — for short cards
 *   row      reading on the left, an upright scale down the right edge
 */

type Variant = 'full' | 'compact' | 'row';

type Props = {
  label: string;
  /** the quick-preset word shown while the filter is idle */
  preset: string;
  /** the threshold in words, e.g. "≥ 35 g" */
  threshold: string;
  value: number;
  unit: string;
  tone: Tone;
  active: boolean;
  onToggle: () => void;
  variant?: Variant;
  /** give the scale the full remaining height instead of sitting it on the floor */
  fill?: boolean;
  radius?: number;
  numberSize?: number;
  children: React.ReactNode;
};

export function FilterPanel({
  label,
  preset,
  threshold,
  value,
  unit,
  tone,
  active,
  onToggle,
  variant = 'full',
  fill = false,
  radius = 30,
  numberSize = 44,
  children,
}: Props) {
  const reading = active ? (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5 }}>
      <DottedNumber value={value} size={numberSize} color="#fff" weight={0.58} glow animate={false} />
      {unit && (
        <span className="t-micro" style={{ color: 'var(--lume-70)', paddingBottom: 3, fontSize: 11 }}>
          {unit}
        </span>
      )}
    </div>
  ) : (
    <div style={{ minWidth: 0 }}>
      <div className="t-sub" style={{ color: 'var(--ink)', fontSize: variant === 'full' ? 17 : 15 }}>
        {preset}
      </div>
      <div className="t-micro t-dim-2" style={{ marginTop: 1, fontSize: 11 }}>
        {threshold}
      </div>
    </div>
  );

  const pip = <Pip on={active} />;

  return (
    <Squircle
      radius={radius}
      stroke={active ? 'lume' : 'ink'}
      className={active ? 'grain' : undefined}
      style={{
        background: active ? undefined : 'var(--paper)',
        boxShadow: active ? 'var(--lift-2)' : 'var(--lift-1)',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'box-shadow 320ms ease',
      }}
    >
      {/* The colour field is always mounted and only fades. Creating a heavily
          blurred layer on activation made the browser re-rasterise the clipped
          card, which read as the corners tightening for a frame. */}
      <motion.div
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.42, ease: ease.glass }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <GradientField tone={tone} blur={26} />
      </motion.div>

      {/* Idle, the whole face is the switch — there is no scale to compete with, so
          any tap should engage it. Engaged, only the header turns it off, or every
          drag along the scale would switch it back off. */}
      {!active && (
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-hidden
          style={{ position: 'absolute', inset: 0, zIndex: 5, borderRadius: 'inherit', cursor: 'pointer' }}
        />
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: variant === 'row' ? 'row' : 'column',
          gap: variant === 'row' ? 10 : 4,
          padding: variant === 'full' ? '12px 15px 10px' : '10px 13px 9px',
        }}
      >
        {variant === 'compact' ? (
          <>
            {/* engaged, the reading tucks up beside the label to leave room for the
                scale; idle, it stacks so the preset wording never has to wrap */}
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={active}
              aria-label={`${label} filter`}
              style={{
                display: 'flex',
                alignItems: active ? 'center' : 'flex-start',
                gap: 8,
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span className="t-micro" style={{ color: active ? 'var(--lume-70)' : 'var(--ink-45)' }}>
                {label}
              </span>
              <span style={{ flex: 1 }} />
              {active && reading}
              {pip}
            </button>
            {!active && <div style={{ marginTop: 2 }}>{reading}</div>}
            <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%' }}>{active ? children : null}</div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                flex: variant === 'row' ? '1 1 auto' : '0 0 auto',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: variant === 'row' ? 'space-between' : 'flex-start',
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={onToggle}
                aria-pressed={active}
                aria-label={`${label} filter`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                }}
              >
                <span className="t-micro" style={{ color: active ? 'var(--lume-70)' : 'var(--ink-45)' }}>
                  {label}
                </span>
                {pip}
              </button>
              {reading}
            </div>

            <div
              style={{
                flex: variant === 'row' ? '0 0 auto' : '1 1 auto',
                minHeight: 0,
                width: variant === 'row' ? undefined : '100%',
                display: 'flex',
                alignItems: variant === 'row' || fill ? 'stretch' : 'flex-end',
                justifyContent: 'center',
                paddingBottom: variant === 'row' ? 0 : 2,
              }}
            >
              {!active ? null : variant === 'row' ? (
                children
              ) : (
                <div style={{ width: '100%', height: fill ? '100%' : undefined }}>{children}</div>
              )}
            </div>
          </>
        )}
      </div>
    </Squircle>
  );
}

function Pip({ on }: { on: boolean }) {
  return (
    <span
      style={{
        position: 'relative',
        width: 16,
        height: 16,
        borderRadius: 16,
        flex: '0 0 auto',
        boxShadow: on ? 'inset 0 0 0 1px rgba(255,255,255,0.8)' : 'inset 0 0 0 1px var(--ink-14)',
        transition: 'box-shadow 300ms ease',
      }}
    >
      <motion.span
        initial={false}
        animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={spring.dial}
        style={{ position: 'absolute', inset: 4, borderRadius: 8, background: '#fff', display: 'block' }}
      />
    </span>
  );
}
