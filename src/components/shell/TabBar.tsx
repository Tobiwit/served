'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';

/**
 * Four destinations, no chrome. The active item is marked by a single dot rather
 * than a filled pill — the bar should read as an edge of the instrument, not a
 * navigation component sitting on top of it.
 */

const ITEMS = [
  { href: '/', label: 'Explore' },
  { href: '/library', label: 'Recipes' },
  { href: '/add', label: 'Add' },
  { href: '/settings', label: 'Settings' },
];

export function TabBar() {
  const pathname = usePathname();
  // Explore itself is full-bleed and owns its own controls
  if (pathname === '/explore') return null;

  const active = ITEMS.reduce(
    (best, item) =>
      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? item.href : best,
    '/',
  );

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
          gridTemplateColumns: 'repeat(4, 1fr)',
          listStyle: 'none',
          margin: 0,
          padding: '10px 12px 8px',
          height: 'var(--tabbar-h)',
        }}
      >
        {ITEMS.map((item) => {
          const isActive = active === item.href;
          return (
            <li key={item.href} style={{ display: 'flex', justifyContent: 'center' }}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px 4px',
                  minWidth: 56,
                  color: isActive ? 'var(--ink)' : 'var(--ink-30)',
                  transition: 'color 240ms ease',
                }}
              >
                <span style={{ fontSize: 11.5, letterSpacing: '-0.005em', fontWeight: isActive ? 400 : 300 }}>
                  {item.label}
                </span>
                <span style={{ height: 4, display: 'block' }}>
                  {isActive && (
                    <motion.span
                      layoutId="tab-dot"
                      transition={spring.dial}
                      style={{ display: 'block', width: 4, height: 4, borderRadius: 4, background: 'var(--ink)' }}
                    />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
