'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { BacklogEntry } from '@/lib/db/types';
import { useData } from '@/lib/store/DataProvider';
import { useImageSrc } from '@/lib/hooks/useImageSrc';
import { ImageTooLargeError, storeRecipeImage } from '@/lib/images';
import { ease, spring } from '@/lib/motion';

/**
 * The backlog.
 *
 * The gap this closes is between cooking something good and having the patience to
 * type it in. A title is enough to stop it being forgotten; a photo, taken while it
 * is still on the plate, is enough to remember what it actually was. The recipe gets
 * written whenever there is a quiet ten minutes, and picking an entry up hands its
 * title and photo straight to the editor.
 *
 * Nothing here is a recipe until it is one. These entries never reach the library,
 * never score, and never turn up in Explore as something to cook tonight.
 */
export function Backlog({ onWriteUp }: { onWriteUp: (entry: BacklogEntry) => void }) {
  const { backlog, saveBacklog, deleteBacklog } = useData();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await saveBacklog({ title: trimmed });
      setTitle('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <h2 className="t-sub" style={{ margin: 0 }}>
          Backlog
        </h2>
        <span style={{ flex: 1 }} />
        {backlog.length > 0 && (
          <span className="t-micro t-dim-2" style={{ fontSize: 11 }}>
            {backlog.length} to write up
          </span>
        )}
      </div>
      <p className="t-micro t-dim" style={{ margin: '0 0 12px' }}>
        Just cooked something? Note the name now and write the recipe when you have a minute.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void add();
            }
          }}
          placeholder="Miso aubergine…"
          aria-label="Meal to write up later"
          className="surface hairline"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '13px 16px',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            outline: 'none',
            // 16px, or iOS zooms the whole page the moment the field is focused
            fontSize: 16,
            fontWeight: 300,
          }}
        />
        <motion.button
          type="button"
          onClick={() => void add()}
          disabled={!title.trim() || busy}
          whileTap={{ scale: 0.95 }}
          transition={spring.dial}
          style={{
            flex: '0 0 auto',
            padding: '13px 20px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 300,
            opacity: title.trim() ? 1 : 0.4,
          }}
        >
          Note it
        </motion.button>
      </div>

      {backlog.length > 0 && (
        <motion.ul layout style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
          <AnimatePresence initial={false}>
            {backlog.map((entry) => (
              <Entry
                key={entry.id}
                entry={entry}
                onWriteUp={() => onWriteUp(entry)}
                onPhoto={(image_url) => void saveBacklog({ ...entry, image_url })}
                onRemove={() => void deleteBacklog(entry.id)}
              />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}

function Entry({
  entry,
  onWriteUp,
  onPhoto,
  onRemove,
}: {
  entry: BacklogEntry;
  onWriteUp: () => void;
  onPhoto: (url: string) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = useImageSrc(entry.image_url);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPhoto(await storeRecipeImage(entry.id, file));
    } catch (e) {
      setError(
        e instanceof ImageTooLargeError
          ? 'That photo is too large to store.'
          : e instanceof Error
            ? e.message
            : 'Could not add that photo.',
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={spring.settle}
      className="surface hairline"
      style={{ borderRadius: 'var(--r-lg)', padding: 8, display: 'flex', alignItems: 'center', gap: 10 }}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        onChange={(e) => void pick(e.target.files?.[0])}
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={entry.image_url ? `Replace the photo of ${entry.title}` : `Add a photo of ${entry.title}`}
        style={{
          position: 'relative',
          width: 48,
          height: 48,
          flex: '0 0 auto',
          borderRadius: 'var(--r-sm)',
          overflow: 'hidden',
          background: 'var(--ink-04)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ink-30)',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="16" height="16" viewBox="0 0 15 15" fill="none" aria-hidden>
            <path
              d="M2.4 11.2V4.6a1 1 0 0 1 1-1h1.5l.9-1.3h3.4l.9 1.3h1.5a1 1 0 0 1 1 1v6.6a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <circle cx="7.5" cy="7.6" r="2.2" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        )}
        {busy && <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)' }} />}
      </button>

      <button
        type="button"
        onClick={onWriteUp}
        style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
        aria-label={`Write up ${entry.title}`}
      >
        <span
          className="t-body"
          style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {entry.title}
        </span>
        <span className="t-micro t-dim-2" style={{ display: 'block', marginTop: 1, fontSize: 10.5 }}>
          {error ?? (entry.image_url ? 'Tap to write it up' : 'Tap to write it up · or add a photo')}
        </span>
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${entry.title} from the backlog`}
        className="t-dim-2"
        style={{ flex: '0 0 auto', padding: 8 }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
          <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </motion.li>
  );
}

/** Shown on the editor while a backlog entry is being turned into a real recipe. */
export function FromBacklogNote({ title }: { title: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: ease.arrive }}
      className="t-micro t-dim-2"
      style={{ margin: '0 0 14px', fontSize: 11 }}
    >
      From your backlog · “{title}” leaves it once this saves
    </motion.p>
  );
}
