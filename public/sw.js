/**
 * CloudCampus Service Worker — Offline-First (WhatsApp-style)
 * 
 * Strategy:
 *  - App Shell (HTML, JS, CSS, fonts, images) → Cache First
 *  - Supabase / API calls → Network First, fall back to cache
 *  - Navigation requests → Serve cached index.html (SPA support)
 *  - Truly offline → Show offline.html fallback
 */

const CACHE_NAME = 'cloudcampus-v1';
const OFFLINE_URL = '/offline.html';

// Core app shell files to pre-cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/logo.png',
  '/manifest.json',
];

// ─── INSTALL: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting(); // activate immediately
});

// ─── ACTIVATE: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim(); // take control of all open tabs
});

// ─── FETCH: intercept every network request ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET and non-HTTP(S) requests (e.g. chrome-extension)
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // 2. Supabase / external API → Network First, fall back to cache
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gemini') ||
    url.pathname.startsWith('/functions/')
  ) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // 3. HTML navigation → serve index.html from cache (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // 4. Static assets (JS, CSS, images, fonts) → Cache First
  event.respondWith(cacheFirstWithNetwork(request));
});

// ─── STRATEGY: Cache First (static assets) ───────────────────────────────────
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()); // store for next time
    }
    return response;
  } catch {
    // If it's an image, return a transparent placeholder
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    return new Response('Offline', { status: 503 });
  }
}

// ─── STRATEGY: Network First (API calls) ─────────────────────────────────────
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── STRATEGY: SPA Navigation ────────────────────────────────────────────────
async function handleNavigation(request) {
  try {
    // Try the network first for fresh HTML
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
  } catch {
    // Network failed — serve cached index.html so the SPA can boot
  }

  // Serve cached index.html (React router handles the route)
  const cached =
    (await caches.match('/index.html')) || (await caches.match('/'));
  if (cached) return cached;

  // Last resort: show the offline page
  return (
    (await caches.match(OFFLINE_URL)) ||
    new Response('<h1>You are offline</h1>', {
      headers: { 'Content-Type': 'text/html' },
    })
  );
}

// ─── PUSH NOTIFICATIONS (existing logic kept) ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow('/');
      })
  );
});
