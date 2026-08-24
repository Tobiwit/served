'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { GradientField } from '@/components/glass/GradientField';
import { useAuth } from '@/lib/auth/AuthProvider';
import { spring } from '@/lib/motion';

/**
 * The account screen you are not supposed to see.
 *
 * It exists to protect the database, not to onboard anyone: there is no sign-up, no
 * password reset, no provider buttons. One address, one password, once. Everything
 * below the field is the same rose plate the launch gate opens on, so arriving here
 * still reads as the app rather than as a login wall bolted to the front of it.
 */
export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 26,
        padding: 'calc(var(--safe-t) + 40px) var(--shell-pad) calc(var(--safe-b) + 40px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.settle}
        style={{
          position: 'relative',
          height: 132,
          borderRadius: 'var(--r-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--lift-2)',
        }}
      >
        <GradientField tone="plateRose" blur={34} />
        <div
          style={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 20,
          }}
        >
          <h1 className="t-display" style={{ margin: 0, color: 'var(--lume)' }}>
            Served
          </h1>
        </div>
      </motion.div>

      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-micro t-dim">Email</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span className="t-micro t-dim">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error && (
          <p className="t-micro" style={{ margin: '2px 0 0', color: 'var(--coral)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          style={{
            position: 'relative',
            marginTop: 6,
            height: 52,
            borderRadius: 'var(--r-lg)',
            border: 'none',
            overflow: 'hidden',
            background: 'var(--ink-04)',
            opacity: busy || !email.trim() || !password ? 0.5 : 1,
            cursor: 'pointer',
          }}
        >
          {!busy && email.trim() && password && <GradientField tone="engage" blur={26} />}
          <span
            className="t-body"
            style={{
              position: 'relative',
              color: email.trim() && password && !busy ? 'var(--lume)' : 'var(--ink-45)',
            }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </span>
        </button>
      </form>

      <p className="t-micro t-dim-2" style={{ margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
        This is a private collection. The account exists to keep it that way — you
        should only ever meet this screen once.
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 'var(--r-sm)',
  border: '1px solid var(--ink-08)',
  outline: 'none',
  background: 'var(--paper)',
  // 16px is the threshold below which mobile Safari zooms the page on focus
  fontSize: 16,
  fontWeight: 300,
};
