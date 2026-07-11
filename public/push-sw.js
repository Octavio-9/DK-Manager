/* Handlers Web Push ajoutés au service worker généré par vite-plugin-pwa
   (injectés via workbox.importScripts). Reçoit les notifications hors-app,
   les affiche, met à jour le badge, et ouvre l'app au bon endroit au clic. */

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }

  const title = data.title || 'DK Manager'
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  }

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options)
    if (typeof data.badgeCount === 'number' && 'setAppBadge' in self.navigator) {
      try { await self.navigator.setAppBadge(data.badgeCount) } catch (e) { /* noop */ }
    }
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clientList) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client && url) { try { await client.navigate(url) } catch (e) { /* noop */ } }
        return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
