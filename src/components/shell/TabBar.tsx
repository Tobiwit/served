'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { GradientField } from '@/components/glass/GradientField';
import { spring } from '@/lib/motion';

/**
 * Five destinations in three weights.
 *
 *   Recipes · Tracker · [ Explore ] · List · Settings
 *
 * Explore is the reason the app exists, so it sits in the middle as a lit glass plate
 * — the same engage tone as the launch bar it leads to. Tracker and List are the two
 * things touched every day and get full-size labels either side of it. Recipes and
 * Settings are reached for less and sit quietly at the edges. Adding a recipe is no
 * longer a destination of its own: it is a button on the Recipes screen.
 *
 * The active item is still marked by a single dot rather than a filled pill — the
 * bar should read as an edge of the instrument, not a navigation component.
 */

type Weight = 'hero' | 'main' | 'edge';

const ITEMS: { href: string; label: string; weight: Weight; also?: string[] }[] = [
  { href: '/library', label: 'Recipes', weight: 'edge', also: ['/add', '/recipe', '/ingredients'] },
  { href: '/tracker', label: 'Tracker', weight: 'main' },
  { href: '/', label: 'Explore', weight: 'hero' },
  { href: '/shopping', label: 'List', weight: 'main' },
  { href: '/settings', label: 'Settings', weight: 'edge' },
];

function activeHref(pathname: string): string {
  for (const item of ITEMS) {
    if (item.href === '/') continue;
    const prefixes = [item.href, ...(item.also ?? [])];
    if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return item.href;
  }
  return '/';
}

export function TabBar() {
  const pathname = usePathname();
  // Explore itself is full-bleed and owns its own controls
  if (pathname === '/explore') return null;

  const active = activeHref(pathname);

  return (
    <nav
      aria-label="Main"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        paddingBottom: 'var(--safe-b)',
        background: 'linear-gradient(180deg, rgba(236,236,237,0) 0%, rgba(236,236,237,0.92) 46%, rgba(236,236,237,1) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: '0.85fr 1.05fr 1.5fr 1.05fr 0.85fr',
          alignItems: 'center',
          listStyle: 'none',
          margin: 0,
          padding: '8px 6px 6px',
          height: 'var(--tabbar-h)',
        }}
      >
        {ITEMS.map((item) => {
          const isActive = active === item.href;
          return (
            <li key={item.href} style={{ display: 'flex', justifyContent: 'center' }}>
              {item.weight === 'hero' ? (
                <HeroTab href={item.href} label={item.label} active={isActive} />
              ) : (
                <Tab href={item.href} label={item.label} weight={item.weight} active={isActive} />
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Dot({ show, color = 'var(--ink)' }: { show: boolean; color?: string }) {
  return (
    <span style={{ height: 4, display: 'block' }}>
      {show && (
        <motion.span
          layoutId="tab-dot"
          transition={spring.dial}
          style={{ display: 'block', width: 4, height: 4, borderRadius: 4, background: color }}
        />
      )}
    </span>
  );
}

function Tab({ href, label, weight, active }: { href: string; label: string; weight: Weight; active: boolean }) {
  const main = weight === 'main';
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: main ? 6 : 5,
        padding: '8px 4px 4px',
        minWidth: 0,
        color: active ? 'var(--ink)' : main ? 'var(--ink-45)' : 'var(--ink-30)',
        transition: 'color 240ms ease',
      }}
    >
      <span
        style={{
          fontSize: main ? 14 : 10.5,
          letterSpacing: main ? '-0.02em' : '0',
          fontWeight: active ? 400 : 300,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <Dot show={active} />
    </Link>
  );
}

function HeroTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} style={{ display: 'block' }}>
      <motion.span
        whileTap={{ scale: 0.95 }}
        transition={spring.dial}
        className="grain hairline-lume"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          width: 112,
          height: 46,
          marginTop: -6,
          borderRadius: 'var(--r-pill)',
          overflow: 'hidden',
          boxShadow: active ? 'var(--lift-3)' : 'var(--lift-2)',
          isolation: 'isolate',
        }}
      >
        <GradientField tone="engage" blur={20} />
        <span
          style={{
            position: 'relative',
            zIndex: 2,
            color: '#fff',
            fontSize: 15,
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          {label}
        </span>
        {active && (
          <span
            aria-hidden
            style={{ position: 'relative', zIndex: 2, width: 4, height: 4, borderRadius: 4, background: 'var(--lume)' }}
          />
        )}
      </motion.span>
    </Link>
  );
}
