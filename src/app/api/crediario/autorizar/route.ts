import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveRoles, canWith, buildPermissionMap, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';

// Autorização de venda no crediário (acima do limite / cliente inadimplente).
// Override de gestor: o operador inicia, um gestor/admin autoriza com e-mail + senha.
// Registra a liberação em aprovacoes_credito (auditoria).
export async function POST(request: Request) {
  try {
    const { clienteId, tipo, valor, motivo, gestorEmail, gestorPassword } = await request.json();
    if (!clienteId || !tipo || !String(motivo || '').trim() || !gestorEmail || !gestorPassword) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }
    if (!['acima_limite', 'inadimplente'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de aprovação inválido.' }, { status: 400 });
    }

    // 1. Operador logado → empresa do contexto
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

    // 2. Valida credenciais do gestor sem afetar a sessão do operador
    const verifier = createServiceClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signin, error: signErr } = await verifier.auth.signInWithPassword({ email: gestorEmail, password: gestorPassword });
    if (signErr || !signin.user) return NextResponse.json({ error: 'E-mail ou senha do gestor inválidos.' }, { status: 401 });
    const gestorId = signin.user.id;

    const admin = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 3. Gestor é da mesma empresa e tem aprovar_credito?
    const { data: gestor } = await admin.from('usuarios').select('empresa_id, roles, role').eq('id', gestorId).single();
    if (!gestor || (gestor as { empresa_id: string }).empresa_id !== empresaId) {
      return NextResponse.json({ error: 'O gestor não pertence à sua empresa.' }, { status: 403 });
    }
    // Cliente é da mesma empresa
    const { data: cliente } = await admin.from('clientes').select('empresa_id').eq('id', clienteId).single();
    if (!cliente || (cliente as { empresa_id: string }).empresa_id !== empresaId) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }
    const { data: perms } = await admin.from('permissoes_papel').select('papel, permissao').eq('empresa_id', empresaId);
    const map = perms && perms.length > 0 ? buildPermissionMap(perms as { papel: string; permissao: string }[]) : DEFAULT_ROLE_PERMISSIONS;
    if (!canWith(map, resolveRoles(gestor as { roles?: string[]; role?: string }), 'aprovar_credito')) {
      return NextResponse.json({ error: 'Esse usuário não tem permissão para aprovar crédito.' }, { status: 403 });
    }

    // 4. Registra a liberação (auditoria)
    const { error: insErr } = await admin.from('aprovacoes_credito').insert({
      empresa_id: empresaId, cliente_id: clienteId, tipo,
      valor: Number(valor) || 0, aprovado_por: gestorId, motivo,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado.' }, { status: 500 });
  }
}
