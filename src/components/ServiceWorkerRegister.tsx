'use client';

import { useEffect } from 'react';

// Registra o service worker (necessário para instalar como app / PWA)
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* sem PWA, segue normal */ });
    }
  }, []);
  return null;
}
