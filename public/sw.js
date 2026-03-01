/**
 * CloudCampus Service Worker
 * Place this file at: public/sw.js
 *
 * This enables real mobile push notifications on Android Chrome and iOS Safari
 * (PWA mode). The new Notification() API is desktop-only and is silently
 * ignored on mobile. Only registration.showNotification() produces the
 * slide-down-from-top signal on mobile — exactly like WhatsApp.
 */

self.addEventListener('install',  ()      => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// When user taps the notification banner, focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
