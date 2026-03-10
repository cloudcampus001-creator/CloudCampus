/**
 * CloudCampus Service Worker — Offline-First + Push Notifications
 *
 * Strategy:
 *  - App Shell (HTML, JS, CSS, fonts, images) → Cache First
 *  - Supabase / API calls → Network First, fall back to cache
 *  - Navigation requests → Serve cached index.html (SPA support)
 *  - Truly offline → Show offline.html fallback
 *  - Push events → Show device notification (WhatsApp-style)
 */

const CACHE_NAME   = 'cloudcampus-v2';
const OFFLINE_URL  = '/offline.html';

const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/logo.png',
  '/manifest.json',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
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
  self.clients.claim();
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('gemini') ||
    url.pathname.startsWith('/functions/')
  ) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(cacheFirstWithNetwork(request));
});

// ─── STRATEGY: Cache First ────────────────────────────────────────────────────
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    return new Response('Offline', { status: 503 });
  }
}

// ─── STRATEGY: Network First ──────────────────────────────────────────────────
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

// ─── STRATEGY: SPA Navigation ─────────────────────────────────────────────────
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
  } catch { /* fall through to cache */ }

  const cached = (await caches.match('/index.html')) || (await caches.match('/'));
  if (cached) return cached;

  return (
    (await caches.match(OFFLINE_URL)) ||
    new Response('<h1>You are offline</h1>', {
      headers: { 'Content-Type': 'text/html' },
    })
  );
}

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
// Handles background push events (e.g. when app is closed).
// The frontend sends a push via the Web Push API + VAPID keys.
// The payload must be: { title, body, url, tag }
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'CloudCampus', body: event.data?.text() || '' }; }

  const title = data.title || 'CloudCampus';
  const options = {
    body:     data.body  || 'New notification',
    icon:     '/logo.png',
    badge:    '/logo.png',
    tag:      data.tag   || `cloudcampus_push_${Date.now()}`,
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url: data.url || '/' },
    actions: [
      { action: 'open',    title: 'Open'    },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        // If app is already open — focus it and navigate
        for (const client of list) {
          if ('focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
            return;
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// ─── NOTIFICATION CLOSE ───────────────────────────────────────────────────────
self.addEventListener('notificationclose', () => {
  // analytics hook — extend if needed
});
