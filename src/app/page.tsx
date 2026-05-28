import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function RootPage() {
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
