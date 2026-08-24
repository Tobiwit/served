'use client';

import { useEffect } from 'react';

/**
 * Registers the offline shell.
 *
 * Skipped in development: the worker would sit in front of the dev server's own
 * asset pipeline and serve yesterday's bundle back to you.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => {});

    // registering during load competes with the app's own first paint for bandwidth
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
