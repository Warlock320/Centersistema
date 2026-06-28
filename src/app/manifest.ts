import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BluesysERP',
    short_name: 'BluesysERP',
    description: 'Sistema ERP completo — vendas, caixa, estoque, NF-e e financeiro.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/api/icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
