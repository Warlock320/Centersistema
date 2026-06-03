import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveRoles, canWith, buildPermissionMap, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';

// Cancelamento de movimento de caixa com OVERRIDE DE GESTOR:
// o operador segue logado, mas um gestor/admin precisa autorizar com e-mail + senha.
export async function POST(request: Request) {
  try {
    const { movId, motivo, gestorEmail, gestorPassword } = await request.json();
    if (!movId || !String(motivo || '').trim() || !gestorEmail || !gestorPassword) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }

    // 1. Operador logado (sessão atual) — define a empresa do contexto
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    const { data: operador } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
    if (!operador) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 403 });
    const empresaId = (operador as { empresa_id: string }).empresa_id;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 500 });

    // 2. Valida as credenciais do gestor SEM tocar na sessão do operador
    const verifier = createServiceClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signin, error: signErr } = await verifier.auth.signInWithPassword({ email: gestorEmail, password: gestorPassword });
    if (signErr || !signin.user) return NextResponse.json({ error: 'E-mail ou senha do gestor inválidos.' }, { status: 401 });
    const gestorId = signin.user.id;

    const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 3. Gestor é da mesma empresa e tem permissão para gerir o caixa?
    const { data: gestor } = await admin.from('usuarios').select('empresa_id, roles, role').eq('id', gestorId).single();
    if (!gestor || (gestor as { empresa_id: string }).empresa_id !== empresaId) {
      return NextResponse.json({ error: 'O gestor informado não pertence à sua empresa.' }, { status: 403 });
    }
    const { data: perms } = await admin.from('permissoes_papel').select('papel, permissao').eq('empresa_id', empresaId);
    const map = perms && perms.length > 0 ? buildPermissionMap(perms as { papel: string; permissao: string }[]) : DEFAULT_ROLE_PERMISSIONS;
    if (!canWith(map, resolveRoles(gestor as { roles?: string[]; role?: string }), 'gerir_caixa')) {
      return NextResponse.json({ error: 'Esse usuário não tem permissão para autorizar cancelamentos.' }, { status: 403 });
    }

    // 4. Regras do movimento/caixa (espelham a RPC cancelar_movimento_caixa)
    const { data: mov } = await admin.from('movimentos_caixa')
      .select('caixa_id, categoria, empresa_id, cancelado').eq('id', movId).single();
    if (!mov || (mov as { empresa_id: string }).empresa_id !== empresaId) {
      return NextResponse.json({ error: 'Movimento não encontrado.' }, { status: 404 });
    }
    if ((mov as { categoria: string }).categoria === 'abertura') {
      return NextResponse.json({ error: 'O movimento de abertura não pode ser cancelado.' }, { status: 400 });
    }
    if ((mov as { cancelado: boolean }).cancelado) {
      return NextResponse.json({ error: 'Movimento já está cancelado.' }, { status: 400 });
    }
    const { data: caixa } = await admin.from('caixas').select('status').eq('id', (mov as { caixa_id: string }).caixa_id).single();
    if (!caixa || (caixa as { status: string }).status !== 'aberto') {
      return NextResponse.json({ error: 'Só é possível cancelar movimentos com o caixa aberto.' }, { status: 400 });
    }

    // 5. Cancela registrando QUEM autorizou (cancelado_por = gestor)
    const { error: updErr } = await admin.from('movimentos_caixa').update({
      cancelado: true,
      cancelado_por: gestorId,
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: motivo,
    }).eq('id', movId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado.' }, { status: 500 });
  }
}
