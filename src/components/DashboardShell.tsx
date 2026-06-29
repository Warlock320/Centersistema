'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PermissionsProvider } from '@/components/PermissionsProvider';
import { DashboardNav } from '@/components/DashboardNav';
import { RouteGuard } from '@/components/RouteGuard';
import IdleGuard from '@/components/IdleGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModulesProvider } from '@/components/ModulesProvider';
import { resolveRoles } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/client';
import type { Usuario } from '@/types/database.types';

// Telas em "modo operação" — o menu lateral recolhe sozinho para dar tela cheia
const ROTAS_FOCO = ['/dashboard/financeiro/caixa'];

export function DashboardShell({ usuario, children }: { usuario: Usuario; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [idleTimeout, setIdleTimeout] = useState(0);

  useEffect(() => {
    if (ROTAS_FOCO.includes(pathname)) setCollapsed(true);
    else setCollapsed(false);
  }, [pathname]);

  // Carrega política de timeout da empresa
  useEffect(() => {
    const supabase = createClient();
    supabase.from('politicas_seguranca')
      .select('timeout_inatividade')
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.timeout_inatividade) setIdleTimeout(data.timeout_inatividade);
      });
  }, [usuario.empresa_id]);

  return (
    <ModulesProvider empresaId={usuario.empresa_id || null}>
    <PermissionsProvider roles={resolveRoles(usuario) as string[]} empresaId={usuario.empresa_id || null}>
      <RouteGuard />
      {idleTimeout > 0 && <IdleGuard timeoutSeconds={idleTimeout} />}
      <div className="flex min-h-screen bg-slate-50">
        <DashboardNav usuario={usuario} collapsed={collapsed} />

        {/* Botão sutil de mostrar/esconder o menu (somente desktop) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Mostrar menu' : 'Esconder menu'}
          title={collapsed ? 'Mostrar menu' : 'Esconder menu'}
          className={`hidden md:flex fixed top-1/2 -translate-y-1/2 z-40 items-center justify-center w-5 h-14 bg-slate-200/70 hover:bg-slate-300 text-slate-500 hover:text-slate-700 rounded-r-md shadow-sm transition-all duration-200 ${collapsed ? 'left-0' : 'left-64'}`}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <main className={`flex-1 pt-20 px-4 md:px-6 pb-8 min-h-screen w-full min-w-0 transition-all duration-200 ml-0 ${collapsed ? 'md:ml-0' : 'md:ml-64'}`}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </PermissionsProvider>
    </ModulesProvider>
  );
}
