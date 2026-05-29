import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Center Auto Peças Gestão',
  description: 'Sistema ERP para gestão de auto peças',
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
