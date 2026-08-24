'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isConfigured, supabaseClient } from '@/lib/db/supabase';

/**
 * One private account, met once.
 *
 * Email and password rather than a magic link, deliberately: a link opens in Safari,
 * and a Home Screen PWA on iOS keeps its own storage — the session would land in the
 * browser and never reach the installed app. A password is typed where the session
 * is wanted. Supabase rotates the refresh token from then on, so in normal use this
 * screen is never seen again.
 *
 * `unconfigured` is its own state because a sign-in form with no backend behind it
 * is a worse answer than saying so.
 */

export type AuthStatus = 'loading' | 'in' | 'out' | 'unconfigured';

interface AuthValue {
  status: AuthStatus;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isConfigured() ? 'loading' : 'unconfigured');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const db = supabaseClient();
    if (!db) {
      setStatus('unconfigured');
      return;
    }

    let alive = true;

    // reads the persisted session off local storage before it revalidates, so a
    // cold launch with no signal still resolves to "in"
    db.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setEmail(data.session?.user.email ?? null);
      setStatus(data.session ? 'in' : 'out');
    });

    const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setStatus(session ? 'in' : 'out');
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (address: string, password: string) => {
    const db = supabaseClient();
    if (!db) throw new Error('No database is configured.');
    const { error } = await db.auth.signInWithPassword({ email: address.trim(), password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    const db = supabaseClient();
    if (!db) return;
    await db.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(() => ({ status, email, signIn, signOut }), [status, email, signIn, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
