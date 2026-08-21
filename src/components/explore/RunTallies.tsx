'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Ingredient } from '@/lib/db/types';
import { ease, spring } from '@/lib/motion';

/**
 * What the run has accumulated, as two counters on the hint line.
 *
 * This replaces the confirmation toast: ruling something out is already visible on
 * the capsule, so interrupting the screen to say so was noise. The counters are the
 * durable record instead — tap one to see the list and take anything back out of it.
 */

type Props = {
  excluded: string[];
  boosted: string[];
  index: Map<string, Ingredient>;
  onRestore: (id: string) => void;
  onUnboost: (id: string) => void;
};

export function RunTallies({ excluded, boosted, index, onRestore, onUnboost }: Props) {
  const [open, setOpen] = useState<'excluded' | 'boosted' | null>(null);

  const name = (id: string) => index.get(id)?.name ?? id;
  const list = open === 'excluded' ? excluded : open === 'boosted' ? boosted : [];

  if (!excluded.length && !boosted.length) return null;

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
        {excluded.length > 0 && (
          <Tally
            label="ruled out"
            count={excluded.length}
            open={open === 'excluded'}
            tint="#e9633c"
            onClick={() => setOpen(open === 'excluded' ? null : 'excluded')}
          />
        )}
        {boosted.length > 0 && (
          <Tally
            label="wanted"
            count={boosted.length}
            open={open === 'boosted'}
            tint="var(--ink-70)"
            onClick={() => setOpen(open === 'boosted' ? null : 'boosted')}
          />
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key={open}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: ease.glass }}
            style={{ overflow: 'hidden', width: '100%' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '10px 0 2px' }}>
              {list.map((id) => {
                const ruled = open === 'excluded';
                return (
                  <motion.button
                    key={id}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={spring.settle}
                    onClick={() => (ruled ? onRestore(id) : onUnboost(id))}
                    aria-label={`Remove ${name(id)} from ${ruled ? 'ruled out' : 'wanted'}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 8px 5px 9px',
                      borderRadius: 'var(--r-pill)',
                      fontSize: 12,
                      fontWeight: 300,
                      // these are a record of decisions, not ingredients you can act
                      // on, so they carry their own treatment: ruled-out entries sit
                      // pressed into the surface in coral, wanted ones sit proud
                      // under a lime bead
                      color: ruled ? '#a8452a' : 'var(--ink-70)',
                      background: ruled ? 'rgba(233,99,60,0.09)' : 'rgba(168,214,63,0.22)',
                      boxShadow: ruled
                        ? 'inset 0 1.5px 3px rgba(233,99,60,0.2), inset 0 -1px 0 rgba(255,255,255,0.7)'
                        : '0 1px 2px rgba(14,15,17,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 5,
                        flex: '0 0 auto',
                        background: ruled ? 'rgba(168,69,42,0.45)' : '#a8d63f',
                      }}
                    />
                    <span style={{ textDecoration: ruled ? 'line-through' : 'none', textDecorationColor: 'rgba(168,69,42,0.35)' }}>
                      {name(id)}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ opacity: 0.5 }}>
                      <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Tally({
  label,
  count,
  open,
  tint,
  onClick,
}: {
  label: string;
  count: number;
  open: boolean;
  tint: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      whileTap={{ scale: 0.94 }}
      transition={spring.dial}
      className="t-micro"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 'var(--r-pill)',
        color: open ? '#fff' : tint,
        background: open ? 'var(--ink)' : 'rgba(14,15,17,0.045)',
        transition: 'background 220ms ease, color 220ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{count}</span>
    </motion.button>
  );
}
