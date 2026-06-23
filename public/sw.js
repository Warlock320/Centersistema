// Service Worker — Center Auto Peças (PWA Completo)
// Cache de estáticos + dados offline + página fallback
const CACHE_STATIC = 'center-static-v2';
const CACHE_DATA = 'center-data-v1';
const CACHE_PAGES = 'center-pages-v1';

const OFFLINE_PAGE = '/offline.html';

// Páginas para pré-cachear (shell do app)
const PRECACHE_PAGES = [
  '/dashboard',
  '/login',
  OFFLINE_PAGE,
];

// Rotas de API para cachear (stale-while-revalidate)
const DATA_ROUTES = [
  '/rest/v1/produtos',
  '/rest/v1/clientes',
  '/rest/v1/categorias',
  '/rest/v1/fornecedores',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_PAGES);
      // Pré-cacheia a página offline
      try { await cache.add(OFFLINE_PAGE); } catch { /* ok */ }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpa caches de versões antigas
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![CACHE_STATIC, CACHE_DATA, CACHE_PAGES].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Estáticos do Next (cache-first)
  if (url.pathname.startsWith('/_next/static') || url.pathname.match(/\.(png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // 2. Dados do Supabase (stale-while-revalidate)
  if (DATA_ROUTES.some((r) => url.pathname.includes(r))) {
    event.respondWith(staleWhileRevalidate(request, CACHE_DATA));
    return;
  }

  // 3. Páginas de navegação (network-first com fallback offline)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstPage(request));
    return;
  }
});

// Cache-first: estáticos nunca mudam
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate: retorna cache imediato, atualiza em background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } }));

  return cached || fetchPromise;
}

// Network-first: tenta rede, se falhar mostra cache ou página offline
async function networkFirstPage(request) {
  const cache = await caches.open(CACHE_PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_PAGE);
    if (offline) return offline;
    return new Response('Sem conexão', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

// Recebe mensagem do app para forçar cache de dados
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_DATA') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_DATA);
        const urls = event.data.urls || [];
        for (const url of urls) {
          try {
            const res = await fetch(url, { headers: event.data.headers || {} });
            if (res.ok) await cache.put(url, res);
          } catch { /* ignora erros de cache individual */ }
        }
      })()
    );
  }
});
