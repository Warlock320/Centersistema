import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/DashboardNav';
import { DEMO_MODE, DEMO_USER, DEMO_COOKIE } from '@/lib/demo';
import { cookies } from 'next/headers';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (DEMO_MODE) {
    const cookieStore = await cookies();
    if (cookieStore.get(DEMO_COOKIE)?.value !== '1') redirect('/login');
    return (
      <div className="flex min-h-screen bg-slate-50">
        <DashboardNav usuario={DEMO_USER} />
        <main className="flex-1 ml-64 pt-4 px-6 pb-8 min-h-screen">{children}</main>
      </div>
    );
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DashboardNav usuario={usuario} />
      <main className="flex-1 ml-64 pt-4 px-6 pb-8 min-h-screen">{children}</main>
    </div>
  );
}
