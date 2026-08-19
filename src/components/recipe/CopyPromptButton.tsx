'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Ingredient, Recipe } from '@/lib/db/types';
import { buildImagePrompt } from '@/lib/imagePrompt';
import { ease, spring } from '@/lib/motion';

/**
 * Copies a photography prompt built from the shared global direction plus this
 * recipe. Paste it into an image model; every shot then belongs to the same set.
 */
export function CopyPromptButton({ recipe, index }: { recipe: Recipe; index: Map<string, Ingredient> }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const prompt = recipe.image_prompt || buildImagePrompt(recipe, index);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // clipboard can be blocked; the prompt is still readable below
      setShown(true);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <section style={{ marginTop: 30 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button
          type="button"
          onClick={copy}
          whileTap={{ scale: 0.98 }}
          transition={spring.dial}
          className="surface hairline"
          style={{
            flex: 1,
            padding: '14px 18px',
            borderRadius: 'var(--r-pill)',
            fontSize: 14,
            fontWeight: 300,
            color: 'var(--ink-70)',
            textAlign: 'left',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'done' : 'idle'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: ease.arrive }}
              style={{ display: 'block' }}
            >
              {copied ? 'Prompt copied' : 'Copy image prompt'}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-expanded={shown}
          className="surface hairline"
          style={{ padding: '14px 18px', borderRadius: 'var(--r-pill)', fontSize: 14, fontWeight: 300, color: 'var(--ink-45)' }}
        >
          {shown ? 'Hide' : 'View'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: ease.glass }}
            style={{ overflow: 'hidden' }}
          >
            <p
              className="t-micro t-dim"
              style={{
                margin: '12px 0 0',
                padding: '14px 16px',
                borderRadius: 'var(--r-md)',
                background: 'var(--ink-04)',
                lineHeight: 1.6,
                userSelect: 'text',
              }}
            >
              {prompt}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
