/* eslint-disable no-undef */

/**
 * Offline shell.
 *
 * The device mirror is only worth having if the app can be launched to reach it. A
 * Home Screen PWA opened with no signal has no browser to fall back on: without a
 * service worker holding the HTML and the JS bundle, it is a white screen, and every
 * recipe cached in IndexedDB stays unreachable behind it.
 *
 * Three rules, and one prohibition:
 *   - build assets are immutable, so serve them from the cache and refresh behind
 *   - pages and RSC payloads try the network first, then fall back to the last copy
 *   - recipe photos carry a timestamp in the path, so they are safe to keep forever
 *   - Supabase REST and auth are never cached: stale rows and stale tokens are worse
 *     than an honest failure, and the app is built to handle that failure anyway
 */

const VERSION = 'v1';
const SHELL = `served-shell-${VERSION}`;
const ASSETS = `served-assets-${VERSION}`;
const PHOTOS = `served-photos-${VERSION}`;
const MINE = [SHELL, ASSETS, PHOTOS];

/** Every route the tab bar can reach, so a cold offline launch lands anywhere. */
const ROUTES = ['/', '/explore', '/library', '/add', '/ingredients', '/settings'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // a route that will not precache must not sink the whole install
      Promise.allSettled(ROUTES.map((route) => cache.add(new Request(route, { cache: 'reload' })))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('served-') && !MINE.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase: photos are worth keeping, rows and tokens never are.
  if (url.hostname.endsWith('.supabase.co')) {
    if (url.pathname.includes('/storage/v1/object/public/')) {
      event.respondWith(cacheFirst(request, PHOTOS));
    }
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  // page loads and the RSC payloads client-side navigation runs on
  if (request.mode === 'navigate' || url.searchParams.has('_rsc')) {
    event.respondWith(networkFirst(request, SHELL));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    // an unvisited route offline still deserves the shell rather than a browser error
    const root = await cache.match('/');
    if (root && request.mode === 'navigate') return root;
    throw error;
  }
}
