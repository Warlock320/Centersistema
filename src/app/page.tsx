import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEMO_MODE, DEMO_COOKIE } from '@/lib/demo';
import { cookies } from 'next/headers';

export default async function RootPage() {
  if (DEMO_MODE) {
    const cookieStore = await cookies();
    redirect(cookieStore.get(DEMO_COOKIE)?.value === '1' ? '/dashboard' : '/login');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', user.id)
      .single();
    redirect(usuario ? '/dashboard' : '/setup');
  }

  redirect('/login');
}
