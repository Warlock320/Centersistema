'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // Pré-cacheia dados para acesso offline
        precacheData(reg);
      }).catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      if ('caches' in window) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
    }
  }, []);

  return null;
}

async function precacheData(reg: ServiceWorkerRegistration) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || !reg.active) return;

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return;

  const headers = {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };

  const urls = [
    `${baseUrl}/rest/v1/produtos?select=id,codigo,nome,preco,estoque,aplicacoes,codigos_auxiliares&ativo=eq.true&order=nome`,
    `${baseUrl}/rest/v1/clientes?select=id,nome,cpf_cnpj,telefone&ativo=eq.true&order=nome`,
    `${baseUrl}/rest/v1/categorias?select=id,nome&order=nome`,
  ];

  reg.active.postMessage({ type: 'CACHE_DATA', urls, headers });
}

// Hook para o botão "Instalar App"
export function useInstallPWA() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  }

  return { canInstall, install };
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
