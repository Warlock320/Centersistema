import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'BluesysERP',
  description: 'Sistema ERP completo para gestão empresarial',
  appleWebApp: { capable: true, title: 'BluesysERP', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

// Aplica o tema salvo antes da pintura (evita "piscar" claro→escuro)
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
        <ServiceWorkerRegister />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
