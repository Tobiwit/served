'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useData } from '@/lib/store/DataProvider';
import { useExplore } from '@/lib/store/ExploreProvider';
import { useAuth } from '@/lib/auth/AuthProvider';
import { HEALTH_CONFIG, VOLUME_CONFIG } from '@/lib/scoring';
import { isSeededRecipe } from '@/seed/seeded-ids';
import { spring } from '@/lib/motion';

export default function SettingsPage() {
  const { recipes, allRecipes, ingredients, sync, syncNow, refreshFromCloud, hideSeeded, setHideSeeded } =
    useData();
  const { reset } = useExplore();
  const { email, signOut } = useAuth();
  const [standalone, setStandalone] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true);
  }, []);

  const starters = allRecipes.filter((r) => isSeededRecipe(r.id)).length;

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
      <header style={{ marginBottom: 22 }}>
        <h1 className="t-display" style={{ margin: 0 }}>
          Settings
        </h1>
      </header>

      <Group title="Collection">
        <RowLink href="/ingredients" label="Ingredient database" value={`${ingredients.length} entries`} />
        <RowLink
          href="/library"
          label="Recipes"
          value={hideSeeded ? `${recipes.length} of ${allRecipes.length} shown` : `${recipes.length} saved`}
        />

        {/* A view, not a deletion. The starter rows stay in the database exactly as
            they are — this only decides whether the app looks at them. */}
        <Toggle
          label="Only my recipes"
          detail={
            hideSeeded
              ? `${starters} starter recipe${starters === 1 ? '' : 's'} hidden — nothing was deleted`
              : `Hides the ${starters} recipe${starters === 1 ? '' : 's'} the app came with`
          }
          on={hideSeeded}
          onToggle={() => setHideSeeded(!hideSeeded)}
        />
      </Group>

      <Group title="Sync">
        <button
          type="button"
          onClick={() => void syncNow()}
          className="surface hairline"
          style={{ ...rowStyle, width: '100%', textAlign: 'left' }}
        >
          <span className="t-body">{syncLabel(sync)}</span>
          <span className="t-micro t-dim-2">{syncDetail(sync)}</span>
        </button>

        <div className="surface hairline" style={{ ...rowStyle, display: 'block' }}>
          <p className="t-micro t-dim" style={{ margin: 0, lineHeight: 1.6 }}>
            Recipes, ingredients and photos are kept in the database and mirrored onto this
            device. Everything is readable and editable with no connection — changes queue here
            and go up the next time there is one.
          </p>
        </div>
      </Group>

      <Group title="Explore">
        <button
          type="button"
          onClick={reset}
          className="surface hairline"
          style={{ ...rowStyle, width: '100%', textAlign: 'left' }}
        >
          <span className="t-body">Reset Explore run</span>
          <span className="t-micro t-dim-2">clears filters, exclusions and history</span>
        </button>
      </Group>

      <Group title="How the scores work">
        <div className="surface hairline" style={{ ...rowStyle, display: 'block' }}>
          <p className="t-micro t-dim" style={{ margin: 0, lineHeight: 1.6 }}>
            Both scores are in-app heuristics, not medical assessments. Health starts at{' '}
            {HEALTH_CONFIG.base} and moves on protein density, fibre, produce share, whole-food share, calorie density,
            fat quality, added sugar and salty components. Low calories alone can add at most{' '}
            {HEALTH_CONFIG.lightDensity.max} points, so a small plate never outranks a substantial one on that basis.
          </p>
          <p className="t-micro t-dim" style={{ margin: '12px 0 0', lineHeight: 1.6 }}>
            Volume blends {Math.round(VOLUME_CONFIG.bulkWeight * 100)}% physical bulk — grams per serving, calorie
            density, water content — with {Math.round(VOLUME_CONFIG.satietyWeight * 100)}% satiety support from protein
            and fibre. Both formulas live in <code style={{ fontSize: 11 }}>src/lib/scoring</code> and are meant to be
            tuned.
          </p>
        </div>
      </Group>

      <Group title="Install">
        <div className="surface hairline" style={{ ...rowStyle, display: 'block' }}>
          <p className="t-micro t-dim" style={{ margin: 0, lineHeight: 1.6 }}>
            {standalone
              ? 'Running as an installed app.'
              : 'On iPhone: open in Safari, tap Share, then Add to Home Screen. It opens full screen with no browser chrome.'}
          </p>
        </div>
      </Group>

      <Group title="Account">
        <Row label="Signed in" value={email ?? '—'} />
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={sync.pending > 0}
          className="surface hairline"
          style={{ ...rowStyle, width: '100%', textAlign: 'left', opacity: sync.pending > 0 ? 0.45 : 1 }}
        >
          <span className="t-body">Sign out</span>
          <span className="t-micro t-dim-2">
            {sync.pending > 0
              ? `${sync.pending} change${sync.pending === 1 ? '' : 's'} still to send — sync first`
              : 'You will need the password again to get back in'}
          </span>
        </button>
      </Group>

      <Group title="Data">
        <button
          type="button"
          onClick={async () => {
            if (!confirmRefresh) {
              setConfirmRefresh(true);
              return;
            }
            setRefreshing(true);
            await refreshFromCloud();
            setRefreshing(false);
            setConfirmRefresh(false);
          }}
          disabled={refreshing || sync.pending > 0}
          className="surface hairline"
          style={{ ...rowStyle, width: '100%', textAlign: 'left', opacity: refreshing || sync.pending > 0 ? 0.45 : 1 }}
        >
          <span className="t-body">
            {refreshing ? 'Refreshing…' : confirmRefresh ? 'Tap again to confirm' : 'Refresh from cloud'}
          </span>
          <span className="t-micro t-dim-2">
            {sync.pending > 0
              ? 'Not while there are unsent changes'
              : 'Discards the copy on this device and downloads the collection again'}
          </span>
        </button>
      </Group>
    </main>
  );
}

function syncLabel(sync: { phase: string; pending: number; failed: number }): string {
  if (sync.failed > 0) return `${sync.failed} change${sync.failed === 1 ? '' : 's'} could not be saved`;
  if (sync.phase === 'syncing') return 'Syncing…';
  if (sync.pending > 0) return `${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to send`;
  if (sync.phase === 'offline') return 'Offline';
  if (sync.phase === 'error') return 'Sync failed';
  return 'Everything is synced';
}

function syncDetail(sync: { phase: string; lastSyncedAt: string | null; error: string | null }): string {
  if (sync.phase === 'error' && sync.error) return sync.error;
  if (sync.phase === 'offline') return 'Working from the copy on this device — tap to retry';
  if (!sync.lastSyncedAt) return 'Not synced yet — tap to sync now';
  return `Last synced ${relative(sync.lastSyncedAt)} — tap to sync now`;
}

function relative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const rowStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 'var(--r-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 className="t-micro t-dim" style={{ margin: '0 0 10px', fontWeight: 300 }}>
        {title}
      </h2>
      <div style={{ display: 'grid', gap: 6 }}>{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface hairline" style={rowStyle}>
      <span className="t-body">{label}</span>
      <span className="t-micro t-dim-2">{value}</span>
    </div>
  );
}

/** A row that is a switch: the whole thing is the target, the pip says where it is. */
function Toggle({
  label,
  detail,
  on,
  onToggle,
}: {
  label: string;
  detail: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="surface hairline"
      style={{ ...rowStyle, width: '100%', textAlign: 'left', flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="t-body">{label}</span>
        <span className="t-micro t-dim-2">{detail}</span>
      </span>
      <span
        aria-hidden
        style={{
          flex: '0 0 auto',
          width: 40,
          height: 24,
          borderRadius: 24,
          padding: 3,
          display: 'flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          background: on ? 'var(--ink)' : 'var(--ink-08)',
          transition: 'background 240ms ease',
        }}
      >
        <motion.span
          layout
          transition={spring.dial}
          style={{ width: 18, height: 18, borderRadius: 18, background: 'var(--paper)', boxShadow: 'var(--lift-1)' }}
        />
      </span>
    </button>
  );
}

function RowLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className="surface hairline" style={rowStyle}>
      <span className="t-body">{label}</span>
      <span className="t-micro t-dim-2">{value}</span>
    </Link>
  );
}
