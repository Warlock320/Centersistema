import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { loginToEmail } from '@/lib/login';

export const runtime = 'nodejs';

function service() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  try {
    const { login, success } = await request.json();
    if (!login) return NextResponse.json({ ok: false });

    const email = loginToEmail(login);
    const admin = service();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'desconhecido';
    const userAgent = request.headers.get('user-agent') || '';

    const { data: usuario } = await admin.from('usuarios')
      .select('id, empresa_id, nome, tentativas_login')
      .eq('email', email).maybeSingle();

    if (!usuario) return NextResponse.json({ ok: true });

    if (success) {
      // Login bem-sucedido: reseta tentativas e registra log
      await admin.from('usuarios').update({
        tentativas_login: 0,
        bloqueado_ate: null,
      }).eq('id', usuario.id);

      await admin.from('log_acesso').insert({
        empresa_id: usuario.empresa_id,
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: 'login',
        ip,
        user_agent: userAgent,
      });
    } else {
      // Login falhou: incrementa tentativas
      const tentativas = (usuario.tentativas_login || 0) + 1;
      const update: Record<string, unknown> = { tentativas_login: tentativas };

      // Busca política para verificar se deve bloquear
      const { data: pol } = await admin.from('politicas_seguranca')
        .select('max_tentativas_login, tempo_bloqueio_min')
        .eq('empresa_id', usuario.empresa_id).maybeSingle();

      if (pol?.max_tentativas_login && pol.max_tentativas_login > 0 && tentativas >= pol.max_tentativas_login) {
        const bloqueioAte = new Date(Date.now() + (pol.tempo_bloqueio_min || 15) * 60000);
        update.bloqueado_ate = bloqueioAte.toISOString();

        await admin.from('log_acesso').insert({
          empresa_id: usuario.empresa_id,
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: 'bloqueio',
          ip,
          user_agent: userAgent,
          detalhes: `Bloqueado após ${tentativas} tentativas. Desbloqueio em ${pol.tempo_bloqueio_min}min.`,
        });
      } else {
        await admin.from('log_acesso').insert({
          empresa_id: usuario.empresa_id,
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: 'tentativa_falha',
          ip,
          user_agent: userAgent,
          detalhes: `Tentativa ${tentativas}/${pol?.max_tentativas_login || '∞'}`,
        });
      }

      await admin.from('usuarios').update(update).eq('id', usuario.id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
