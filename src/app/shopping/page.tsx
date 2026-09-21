'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useShopping } from '@/lib/store/ShoppingProvider';
import { groupItems, type GroupBy, type ShoppingRow } from '@/lib/shopping/list';
import { useTapHold } from '@/lib/hooks/useTapHold';
import { ease, spring } from '@/lib/motion';

/**
 * The shopping list.
 *
 * Two ways to read the same items, because they answer different questions. By
 * recipe is for packing a week: did I get everything for the caesar. By aisle is for
 * standing in the shop, where the recipe is irrelevant and two recipes both wanting
 * kale is one thing to pick up.
 *
 * Tap crosses off, hold puts back — the same grammar as the Explore pills, so the
 * gesture you learned there transfers.
 */
export default function ShoppingPage() {
  const router = useRouter();
  const { items, hydrated, outstanding, setChecked, clearChecked, clearAll } = useShopping();
  const [by, setBy] = useState<GroupBy>('aisle');
  const [confirming, setConfirming] = useState(false);

  const groups = useMemo(() => groupItems(items, by), [items, by]);
  const done = items.length - outstanding;

  if (!hydrated) return <main className="screen" style={{ paddingTop: 120 }} />;

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 className="t-display" style={{ margin: 0 }}>
          Shopping
        </h1>
        <p className="t-micro t-dim" style={{ margin: '8px 0 0' }}>
          {items.length === 0
            ? 'Nothing on the list yet.'
            : outstanding === 0
              ? `All ${items.length} crossed off.`
              : `${outstanding} to find${done ? ` · ${done} crossed off` : ''}`}
        </p>
      </header>

      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Segmented value={by} onChange={setBy} />
          <span style={{ flex: 1 }} />
          {done > 0 && (
            <button type="button" onClick={clearChecked} className="t-micro t-dim-2" style={{ fontSize: 11.5 }}>
              Clear crossed off
            </button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <Empty onBrowse={() => router.push('/library')} />
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {groups.map((group) => (
            <section key={group.key}>
              <div
                className="t-label t-dim-2"
                style={{ marginBottom: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.15em',
                  }}
                >
                  {group.label}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ flex: '0 0 auto', fontSize: 9 }}>
                  {group.rows.filter((r) => !r.checked).length}/{group.rows.length}
                </span>
              </div>

              <ul className="surface hairline" style={{ listStyle: 'none', margin: 0, padding: '2px 0', borderRadius: 'var(--r-lg)' }}>
                {group.rows.map((row, i) => (
                  <Row
                    key={row.key}
                    row={row}
                    first={i === 0}
                    onToggle={(checked) => setChecked(row.ids, checked)}
                  />
                ))}
              </ul>
            </section>
          ))}

          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
            <AnimatePresence mode="wait" initial={false}>
              {confirming ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: ease.arrive }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span className="t-micro t-dim">Clear the whole list?</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearAll();
                      setConfirming(false);
                    }}
                    className="t-micro"
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--r-pill)',
                      background: 'var(--ink)',
                      color: '#fff',
                      fontSize: 11.5,
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="t-micro t-dim-2"
                    style={{ fontSize: 11.5 }}
                  >
                    Keep
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="clear"
                  type="button"
                  onClick={() => setConfirming(true)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: ease.arrive }}
                  className="t-micro t-dim-2"
                  style={{ fontSize: 11.5, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Clear list
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ row, first, onToggle }: { row: ShoppingRow; first: boolean; onToggle: (checked: boolean) => void }) {
  const { held, handlers } = useTapHold(row, {
    // a crossed-off line only comes back on a hold, so a stray tap cannot undo it
    onTap: (r) => !r.checked && onToggle(true),
    onHold: (r) => r.checked && onToggle(false),
  });

  return (
    <motion.li
      layout
      transition={spring.settle}
      style={{
        borderTop: first ? 'none' : '1px solid var(--ink-04)',
        touchAction: 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <motion.div
        {...handlers}
        role="button"
        tabIndex={0}
        aria-pressed={row.checked}
        aria-label={
          row.checked
            ? `${row.name}, crossed off. Hold to put it back.`
            : `${row.name}. Tap to cross off.`
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(!row.checked);
          }
        }}
        animate={{ scale: held ? 0.985 : 1 }}
        transition={spring.dial}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          padding: '13px 14px',
          cursor: 'pointer',
          opacity: row.checked ? 0.42 : 1,
          transition: 'opacity 220ms ease',
        }}
      >
        <Tick on={row.checked} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            className="t-body"
            style={{
              display: 'block',
              textDecoration: row.checked ? 'line-through' : 'none',
              textDecorationColor: 'var(--ink-30)',
            }}
          >
            {row.name}
          </span>
          {row.note && (
            <span className="t-micro t-dim-2" style={{ display: 'block', marginTop: 1, fontSize: 10.5 }}>
              {row.note}
            </span>
          )}
        </span>
        <span
          className="t-micro t-dim"
          style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}
        >
          {row.measure}
        </span>
      </motion.div>
    </motion.li>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 17,
        height: 17,
        flex: '0 0 auto',
        alignSelf: 'center',
        borderRadius: 17,
        display: 'grid',
        placeItems: 'center',
        background: on ? 'var(--ink)' : 'transparent',
        boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--ink-14)',
        transition: 'background 200ms ease, box-shadow 200ms ease',
      }}
    >
      <motion.span initial={false} animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }} transition={spring.dial}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5.2 4 7.2 8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.span>
    </span>
  );
}

function Segmented({ value, onChange }: { value: GroupBy; onChange: (v: GroupBy) => void }) {
  const options: { id: GroupBy; label: string }[] = [
    { id: 'aisle', label: 'By aisle' },
    { id: 'recipe', label: 'By recipe' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Group the list"
      style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 'var(--r-pill)', background: 'var(--ink-04)' }}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className="t-micro"
          style={{ position: 'relative', padding: '6px 12px', borderRadius: 'var(--r-pill)', fontSize: 11.5 }}
        >
          {value === o.id && (
            <motion.span
              layoutId="shopping-segment"
              transition={spring.dial}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'var(--r-pill)',
                background: 'var(--paper)',
                boxShadow: 'var(--lift-1)',
              }}
            />
          )}
          <span style={{ position: 'relative', color: value === o.id ? 'var(--ink)' : 'var(--ink-45)' }}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function Empty({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="surface hairline" style={{ borderRadius: 'var(--r-lg)', padding: '30px 22px', textAlign: 'center' }}>
      <p className="t-body t-dim" style={{ margin: 0, lineHeight: 1.6 }}>
        Open a recipe and add its ingredients. Anything you keep in the cupboard anyway is left off.
      </p>
      <button
        type="button"
        onClick={onBrowse}
        style={{
          marginTop: 18,
          padding: '12px 22px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--ink)',
          color: '#fff',
          fontSize: 13.5,
          fontWeight: 300,
        }}
      >
        Browse recipes
      </button>
    </div>
  );
}
