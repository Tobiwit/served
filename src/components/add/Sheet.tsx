'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ease, spring } from '@/lib/motion';

/**
 * Bottom sheet. Rises on a spring, dismisses on the scrim or the handle.
 *
 * Two things kept it off the screen on a phone, and both are fixed here.
 *
 * It is rendered into `document.body`. `.screen` sets `position: relative; z-index: 1`,
 * which opens a stacking context — so the sheet's own z-index was only ever competing
 * with its siblings inside the page, and the tab bar sat over the bottom of it. That
 * band is exactly where a sheet keeps its actions, so "create ingredient" was under
 * the navigation.
 *
 * And it sits above the on-screen keyboard rather than behind it. A `position: fixed`
 * element is placed against the *layout* viewport, which on iOS does not shrink when
 * the keyboard opens — so a sheet pinned to the bottom slid straight underneath it,
 * taking the nutrition fields with it. `visualViewport` reports what is actually on
 * screen, and the sheet is held to that instead.
 */

/** how much of the visible viewport the sheet may take */
const MAX_SHARE = 0.88;

function useVisualViewport(open: boolean) {
  const [vv, setVv] = useState<{ inset: number; height: number } | null>(null);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const port = window.visualViewport;
    if (!port) return;

    const read = () => {
      // the strip of layout viewport hidden below what is actually visible — the
      // keyboard, on every platform that has one
      const inset = Math.max(0, Math.round(window.innerHeight - (port.height + port.offsetTop)));
      setVv({ inset, height: Math.round(port.height) });
    };

    read();
    port.addEventListener('resize', read);
    port.addEventListener('scroll', read);
    return () => {
      port.removeEventListener('resize', read);
      port.removeEventListener('scroll', read);
    };
  }, [open]);

  return vv;
}

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
  const vv = useVisualViewport(open);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sheet = (
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
              bottom: vv?.inset ?? 0,
              zIndex: 61,
              maxHeight: vv ? vv.height * MAX_SHARE : '86dvh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '28px 28px 0 0',
              background: 'var(--fog)',
              boxShadow: '0 -20px 60px -20px rgba(14,15,17,0.32)',
            }}
          >
            <header style={{ padding: '14px 20px 10px', display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
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
              style={{
                overflowY: 'auto',
                // with the keyboard up the sheet already clears the bottom of the
                // screen, so the safe-area pad would only add dead space
                padding: `4px 20px ${vv?.inset ? '12px' : 'calc(var(--safe-b) + 20px)'}`,
                flex: 1,
                minHeight: 0,
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // no portal target during the server render; nothing is open then either
  return mounted ? createPortal(sheet, document.body) : null;
}
