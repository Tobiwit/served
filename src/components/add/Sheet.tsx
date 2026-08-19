'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ease, spring } from '@/lib/motion';

/** Bottom sheet. Rises on a spring, dismisses on the scrim or the handle. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: ease.glass }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(14,15,17,0.28)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.panel}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 61,
              maxHeight: '86dvh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '28px 28px 0 0',
              background: 'var(--fog)',
              boxShadow: '0 -20px 60px -20px rgba(14,15,17,0.32)',
            }}
          >
            <header style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 8,
                  transform: 'translateX(-50%)',
                  width: 34,
                  height: 4,
                  borderRadius: 4,
                  background: 'var(--ink-14)',
                }}
              />
              <h2 className="t-sub" style={{ margin: '6px 0 0' }}>
                {title}
              </h2>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={onClose} className="t-micro t-dim" style={{ marginTop: 6 }}>
                Close
              </button>
            </header>

            <div
              className="no-scrollbar"
              style={{ overflowY: 'auto', padding: '4px 20px calc(var(--safe-b) + 24px)', flex: 1 }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
