import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APP_NAME, APP_VERSION, APP_STUDIO } from '@/lib/version';

export async function GET() {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await admin.from('empresas').select('nome, logo_url').limit(1).single();

    return NextResponse.json({
      nome: (data as { nome: string } | null)?.nome || '',
      logo_url: (data as { logo_url: string | null } | null)?.logo_url || null,
      app: APP_NAME,
      version: APP_VERSION,
      studio: APP_STUDIO,
    });
  } catch {
    return NextResponse.json({ nome: '', logo_url: null, app: APP_NAME, version: APP_VERSION, studio: APP_STUDIO });
  }
}
