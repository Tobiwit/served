'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Recipe } from '@/lib/db/types';
import { ImageTooLargeError, removeRecipeImage, storeRecipeImage } from '@/lib/images';
import { ease, spring } from '@/lib/motion';

/**
 * The other half of the image loop: copy the prompt, generate the photo elsewhere,
 * bring it back here. Sits on the hero so it reads as acting on the picture rather
 * than as a form field further down the page.
 */
export function PhotoControl({
  recipe,
  onSave,
}: {
  recipe: Recipe;
  onSave: (imageUrl: string | null) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await storeRecipeImage(recipe.id, file);
      await onSave(url);
    } catch (e) {
      setError(
        e instanceof ImageTooLargeError
          ? 'That image is too large to store on this device.'
          : e instanceof Error
            ? e.message
            : 'Could not add that photo.',
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await removeRecipeImage(recipe.image_url);
      await onSave(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={(e) => void pick(e.target.files?.[0])}
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {recipe.image_url && (
          <motion.button
            type="button"
            onClick={() => void clear()}
            disabled={busy}
            aria-label="Remove photo"
            whileTap={{ scale: 0.93 }}
            transition={spring.dial}
            className="hairline"
            style={roundStyle}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={recipe.image_url ? 'Replace photo' : 'Add photo'}
          whileTap={{ scale: 0.93 }}
          transition={spring.dial}
          className="hairline"
          style={roundStyle}
        >
          <AnimatePresence mode="wait" initial={false}>
            {busy ? (
              <motion.span
                key="busy"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 1.1, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.15 } }}
                style={{ display: 'grid', placeItems: 'center' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 5" />
                </svg>
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.16, ease: ease.arrive }}
                style={{ display: 'grid', placeItems: 'center' }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                  <path
                    d="M2.4 11.2V4.6a1 1 0 0 1 1-1h1.5l.9-1.3h3.4l.9 1.3h1.5a1 1 0 0 1 1 1v6.6a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1z"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                  />
                  <circle cx="7.5" cy="7.6" r="2.2" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: ease.arrive }}
            role="alert"
            className="t-micro"
            style={{
              position: 'absolute',
              top: 46,
              right: 0,
              margin: 0,
              padding: '8px 12px',
              borderRadius: 'var(--r-sm)',
              background: 'rgba(14,15,17,0.86)',
              color: '#fff',
              maxWidth: 240,
              textAlign: 'right',
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}

const roundStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 38,
  background: 'rgba(255,255,255,0.74)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  color: 'var(--ink-70)',
  boxShadow: 'var(--lift-1)',
  flex: '0 0 auto',
};
