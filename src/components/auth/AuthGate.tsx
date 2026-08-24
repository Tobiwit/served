'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { SignInScreen } from './SignInScreen';

/**
 * Nothing below this renders without a session — which also means `DataProvider`
 * never mounts unauthenticated and never fires a pull that would come back empty.
 *
 * The loading state is a blank fog screen rather than a spinner. Resolving the
 * persisted session is a local read; on every launch after the first it is over
 * before a spinner would have finished appearing.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') return <div style={{ minHeight: '100dvh', background: 'var(--fog)' }} />;
  if (status === 'out') return <SignInScreen />;
  if (status === 'unconfigured') return <Unconfigured />;

  return <>{children}</>;
}

function Unconfigured() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 12,
        padding: '0 var(--shell-pad)',
      }}
    >
      <h1 className="t-title" style={{ margin: 0 }}>
        No database configured
      </h1>
      <p className="t-micro t-dim" style={{ margin: 0, lineHeight: 1.6 }}>
        Set <code style={{ fontSize: 11 }}>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
        <code style={{ fontSize: 11 }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then reload. The
        collection lives in the database now, so there is nothing to show without one.
      </p>
    </main>
  );
}
