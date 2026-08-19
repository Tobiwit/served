'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ease, spring } from '@/lib/motion';

/** Transient confirmation with a single reversal. Never more than one at a time. */
export function Toast({
  message,
  actionLabel,
  onAction,
}: {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.24, ease: ease.depart } }}
          transition={spring.settle}
          role="status"
          className="hairline"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(var(--safe-b) + 84px)',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 8px 10px 16px',
            borderRadius: 'var(--r-pill)',
            background: 'rgba(14,15,17,0.86)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            boxShadow: 'var(--lift-3)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - 40px)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.9)' }}>{message}</span>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 'var(--r-pill)',
                background: 'rgba(255,255,255,0.16)',
              }}
            >
              {actionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
