import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardNav } from '@/components/DashboardNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
      <main className="flex-1 ml-64 pt-4 px-6 pb-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
