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
    const { login, password } = await request.json();
    if (!login || !password) return NextResponse.json({ error: 'Login e senha obrigatórios.' }, { status: 400 });

    const email = loginToEmail(login);
    const admin = service();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'desconhecido';
    const userAgent = request.headers.get('user-agent') || '';

    // 1. Buscar usuário pelo email
    const { data: usuario } = await admin.from('usuarios')
      .select('id, empresa_id, nome, ativo, tentativas_login, bloqueado_ate')
      .eq('email', email).maybeSingle();

    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado.', canLogin: false }, { status: 401 });
    }

    if (!usuario.ativo) {
      return NextResponse.json({ error: 'Conta desativada. Contacte o administrador.', canLogin: false }, { status: 403 });
    }

    // 2. Buscar políticas da empresa
    const { data: pol } = await admin.from('politicas_seguranca')
      .select('*').eq('empresa_id', usuario.empresa_id).maybeSingle();

    // 3. Verificar bloqueio por tentativas
    if (pol?.max_tentativas_login && pol.max_tentativas_login > 0) {
      if (usuario.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
        const minRestantes = Math.ceil((new Date(usuario.bloqueado_ate).getTime() - Date.now()) / 60000);
        await logAcesso(admin, usuario, 'bloqueio', ip, userAgent, `Tentativa em conta bloqueada (${minRestantes}min restantes)`);
        return NextResponse.json({
          error: `Conta bloqueada por excesso de tentativas. Tente novamente em ${minRestantes} minuto(s).`,
          canLogin: false,
        }, { status: 429 });
      }
    }

    // 4. Verificar horário de acesso (só para usuários na lista restrita)
    if (pol?.horario_inicio && pol?.horario_fim) {
      const restritos: string[] = pol.usuarios_horario_restrito || [];
      const usuarioRestrito = restritos.length === 0 || restritos.includes(usuario.id);

      if (usuarioRestrito) {
        const agora = new Date();
        const horaAtual = agora.getHours() * 60 + agora.getMinutes();
        const [hi, mi] = pol.horario_inicio.split(':').map(Number);
        const [hf, mf] = pol.horario_fim.split(':').map(Number);
        const inicio = hi * 60 + mi;
        const fim = hf * 60 + mf;

        if (horaAtual < inicio || horaAtual > fim) {
          await logAcesso(admin, usuario, 'tentativa_falha', ip, userAgent, `Fora do horário permitido (${pol.horario_inicio}-${pol.horario_fim})`);
          return NextResponse.json({
            error: `Seu acesso é permitido apenas entre ${pol.horario_inicio} e ${pol.horario_fim}.`,
            canLogin: false,
          }, { status: 403 });
        }
      }
    }

    // 5. Tentar autenticação (via Supabase Auth signInWithPassword precisa do client-side)
    // Aqui apenas validamos as políticas. O login real acontece no client.
    // Retornamos canLogin: true para o client prosseguir.

    return NextResponse.json({ canLogin: true, empresaId: usuario.empresa_id, userId: usuario.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro.' }, { status: 500 });
  }
}

async function logAcesso(
  admin: ReturnType<typeof service>,
  usuario: { id: string; empresa_id: string; nome: string },
  tipo: string, ip: string, userAgent: string, detalhes?: string
) {
  await admin.from('log_acesso').insert({
    empresa_id: usuario.empresa_id,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome,
    tipo,
    ip,
    user_agent: userAgent,
    detalhes,
  }).then(() => {});
}
