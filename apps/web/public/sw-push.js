/**
 * Custom push handler — imported by the vite-plugin-pwa generated SW
 * via importScripts or injectManifest strategy.
 *
 * This file is served from /sw-push.js and handles:
 * - push events (show notification)
 * - notificationclick (open app / navigate)
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Polla 2026', body: event.data.text() };
  }

  const {
    title = 'Polla 2026',
    body = '',
    icon = '/icons/pwa-192.svg',
    badge = '/icons/pwa-192.svg',
    tag,
    data = {},
    actions = [],
    requireInteraction = false,
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data,
      actions,
      requireInteraction,
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? '/dashboard';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) return clients.openWindow(url);
      }),
  );
});
