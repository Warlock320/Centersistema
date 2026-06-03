import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Center Auto Peças Gestão',
  description: 'Sistema ERP para gestão de auto peças',
  icons: { icon: '/logo.png', apple: '/logo.png' },
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
