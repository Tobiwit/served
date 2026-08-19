'use client';

import { motion } from 'motion/react';
import { spring } from '@/lib/motion';

/**
 * Cuisine and course. Deliberately the quietest controls on the screen — they are
 * categorical, not measured, so they get no gradient and no scale.
 */

type Props<T extends string> = {
  title: string;
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
  labelFor?: (value: T) => string;
};

export function ChipRow<T extends string>({ title, options, selected, onToggle, labelFor }: Props<T>) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 className="t-micro t-dim" style={{ margin: '0 0 10px', fontWeight: 300 }}>
        {title}
      </h2>
      <div className="hstrip no-scrollbar">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              aria-pressed={on}
              style={{ flex: '0 0 auto', scrollSnapAlign: 'start' }}
            >
              <motion.span
                initial={false}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.95 }}
                transition={spring.dial}
                className="hairline"
                style={{
                  position: 'relative',
                  display: 'block',
                  padding: '9px 15px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 13.5,
                  fontWeight: 300,
                  letterSpacing: '-0.012em',
                  whiteSpace: 'nowrap',
                  background: on ? 'var(--ink)' : 'var(--paper)',
                  color: on ? '#fff' : 'var(--ink-70)',
                  boxShadow: on ? 'var(--lift-2)' : 'var(--lift-1)',
                  transition: 'background 280ms ease, color 280ms ease',
                }}
              >
                {labelFor ? labelFor(opt) : opt}
              </motion.span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
