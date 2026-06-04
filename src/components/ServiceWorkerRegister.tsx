'use client';

import { useEffect } from 'react';

// Registra o service worker (necessário para instalar como app / PWA).
// Em DESENVOLVIMENTO o SW é desregistrado — senão ele serve chunks JS
// em cache (cache-first em /_next/static) e esconde mudanças do código.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* sem PWA, segue normal */ });
    } else {
      // Dev: remove qualquer SW antigo e limpa o cache de estáticos
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
    }
  }, []);
  return null;
}
