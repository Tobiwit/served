'use client';

import { motion } from 'motion/react';
import { GradientField } from '@/components/glass/GradientField';
import { Squircle } from '@/components/glass/Squircle';
import { CUISINES } from '@/lib/db/types';
import { ease, spring } from '@/lib/motion';

/**
 * Cuisine. Engaged like any other filter: idle it is quiet and says what it would
 * do, and only once it is on does the colour come up and the tags become choosable.
 * Categorical, so it gets no scale.
 */

export function CuisinePanel({
  on,
  selected,
  onToggle,
  onToggleCuisine,
}: {
  on: boolean;
  selected: string[];
  onToggle: () => void;
  onToggleCuisine: (c: string) => void;
}) {
  return (
    <Squircle
      radius={30}
      stroke={on ? 'lume' : 'ink'}
      className={on ? 'grain' : undefined}
      style={{
        background: on ? undefined : 'var(--paper)',
        boxShadow: on ? 'var(--lift-2)' : 'var(--lift-1)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        transition: 'box-shadow 320ms ease',
      }}
    >
      {/* always mounted, only faded — see FilterPanel */}
      <motion.div
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: 0.42, ease: ease.glass }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <GradientField tone="course" blur={26} />
      </motion.div>

      {/* idle, a tap anywhere engages it; on, the chips need the surface back */}
      {!on && (
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
          flexDirection: 'column',
          padding: '12px 13px 10px',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={on}
          aria-label="Cuisine filter"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, width: '100%' }}
        >
          <span className="t-micro" style={{ color: on ? 'var(--lume-70)' : 'var(--ink-45)' }}>
            Cuisine
          </span>
          <Pip on={on} />
        </button>

        {on ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: ease.arrive }}
            className="no-scrollbar"
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' }}
          >
            {CUISINES.map((c) => (
              <Chip key={c} label={c} on={selected.includes(c)} onClick={() => onToggleCuisine(c)} />
            ))}
          </motion.div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <div className="t-sub" style={{ color: 'var(--ink)', fontSize: 17 }}>
              Any kitchen
            </div>
            <div className="t-micro t-dim-2" style={{ marginTop: 1, fontSize: 11 }}>
              {selected.length ? `${selected.length} chosen` : 'Tap to narrow'}
            </div>
          </div>
        )}
      </div>
    </Squircle>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      whileTap={{ scale: 0.94 }}
      transition={spring.dial}
      style={{
        padding: '5px 9px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11.5,
        fontWeight: 300,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        height: 'fit-content',
        background: on ? '#fff' : 'rgba(255,255,255,0.2)',
        color: on ? 'var(--ink)' : 'rgba(255,255,255,0.9)',
        boxShadow: on ? 'var(--lift-1)' : 'inset 0 0 0 1px rgba(255,255,255,0.3)',
        transition: 'background 240ms ease, color 240ms ease',
      }}
    >
      {label}
    </motion.button>
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
