import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/DashboardShell';
import { DEMO_MODE, DEMO_USER, DEMO_COOKIE } from '@/lib/demo';
import { cookies } from 'next/headers';
import type { Usuario } from '@/types/database.types';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) {
    const cookieStore = await cookies();
    if (cookieStore.get(DEMO_COOKIE)?.value !== '1') redirect('/login');
    return <DashboardShell usuario={DEMO_USER}>{children}</DashboardShell>;
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

  return <DashboardShell usuario={usuario as Usuario}>{children}</DashboardShell>;
}
