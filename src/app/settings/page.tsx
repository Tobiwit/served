'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/store/DataProvider';
import { useExplore } from '@/lib/store/ExploreProvider';
import { HEALTH_CONFIG, VOLUME_CONFIG } from '@/lib/scoring';

export default function SettingsPage() {
  const { recipes, ingredients, storageKind, resetToSeed } = useData();
  const { reset } = useExplore();
  const [standalone, setStandalone] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true);
  }, []);

  return (
    <main className="screen" style={{ paddingTop: 'calc(var(--safe-t) + 26px)' }}>
      <header style={{ marginBottom: 22 }}>
        <h1 className="t-display" style={{ margin: 0 }}>
          Settings
        </h1>
      </header>

      <Group title="Collection">
        <RowLink href="/ingredients" label="Ingredient database" value={`${ingredients.length} entries`} />
        <RowLink href="/library" label="Recipes" value={`${recipes.length} saved`} />
        <Row label="Storage" value={storageKind === 'supabase' ? 'Supabase' : 'On this device'} />
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

      <Group title="Data">
        <button
          type="button"
          onClick={async () => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            await resetToSeed();
            setConfirmReset(false);
          }}
          disabled={storageKind === 'supabase'}
          className="surface hairline"
          style={{
            ...rowStyle,
            width: '100%',
            textAlign: 'left',
            opacity: storageKind === 'supabase' ? 0.45 : 1,
          }}
        >
          <span className="t-body">{confirmReset ? 'Tap again to confirm' : 'Restore starter collection'}</span>
          <span className="t-micro t-dim-2">
            {storageKind === 'supabase'
              ? 'Only available on device storage'
              : 'Replaces everything with the seeded recipes and ingredients'}
          </span>
        </button>
      </Group>
    </main>
  );
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

function RowLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href} className="surface hairline" style={rowStyle}>
      <span className="t-body">{label}</span>
      <span className="t-micro t-dim-2">{value}</span>
    </Link>
  );
}
