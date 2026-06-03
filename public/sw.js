// Service Worker mínimo do Center Auto (PWA)
// Cacheia apenas assets estáticos do Next; dados/autenticação seguem sempre pela rede.
const CACHE = 'center-static-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpa caches antigos
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Só cacheia estáticos (cache-first); o resto é rede pura.
  const isStatic = url.pathname.startsWith('/_next/static') || url.pathname === '/logo.png';
  if (!isStatic) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});
