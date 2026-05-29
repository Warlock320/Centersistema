import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/DashboardNav';
import { PermissionsProvider } from '@/components/PermissionsProvider';
import { DEMO_MODE, DEMO_USER, DEMO_COOKIE } from '@/lib/demo';
import { resolveRoles } from '@/lib/permissions';
import { cookies } from 'next/headers';
import type { Usuario } from '@/types/database.types';

function Shell({ usuario, children }: { usuario: Usuario; children: React.ReactNode }) {
  return (
    <PermissionsProvider roles={resolveRoles(usuario)} empresaId={usuario.empresa_id || null}>
      <div className="flex min-h-screen bg-slate-50">
        <DashboardNav usuario={usuario} />
        <main className="flex-1 ml-64 pt-20 px-6 pb-8 min-h-screen">{children}</main>
      </div>
    </PermissionsProvider>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) {
    const cookieStore = await cookies();
    if (cookieStore.get(DEMO_COOKIE)?.value !== '1') redirect('/login');
    return <Shell usuario={DEMO_USER}>{children}</Shell>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!usuario) redirect('/setup');

  return <Shell usuario={usuario as Usuario}>{children}</Shell>;
}
