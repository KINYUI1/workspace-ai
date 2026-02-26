/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// Precache static assets (injected by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST);

// --- API Caching Strategies ---

// Auth endpoints: never cache (tokens, login)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/auth'),
  new NetworkFirst({ cacheName: 'api-auth' }),
);

// GET /api/* (except auth): stale-while-revalidate
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth') &&
    request.method === 'GET',
  new StaleWhileRevalidate({
    cacheName: 'api-data',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 30, // 30 minutes
      }),
    ],
  }),
);

// Static assets: cache-first (Vite hashes filenames)
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
);

// Images: cache-first
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  }),
);

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
