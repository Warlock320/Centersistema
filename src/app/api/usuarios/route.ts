import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveRoles, can, ALL_ROLES, type UserRole } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const { nome, email, password, roles } = await request.json();

    // Validação básica
    if (!nome || !email || !password || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
    }
    const validRoles = (roles as string[]).filter((r): r is UserRole => ALL_ROLES.includes(r as UserRole));
    if (validRoles.length === 0) {
      return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 });
    }

    // Autentica o requester e confere que é admin da empresa
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { data: requester } = await supabase
      .from('usuarios')
      .select('empresa_id, roles, role')
      .eq('id', user.id)
      .single();

    if (!requester || !can(resolveRoles(requester), 'manage_config')) {
      return NextResponse.json({ error: 'Sem permissão para cadastrar usuários.' }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.' }, { status: 500 });
    }

    // Cliente com service role para criar o usuário no Auth
    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // já confirmado — pode logar de imediato
    });
    if (authErr || !created.user) {
      const msg = authErr?.message?.includes('already')
        ? 'Já existe um usuário com este e-mail.'
        : (authErr?.message || 'Erro ao criar usuário no Auth.');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Cria o perfil na tabela usuarios (mesma empresa do requester)
    const { error: profileErr } = await admin.from('usuarios').insert({
      id: created.user.id,
      empresa_id: (requester as { empresa_id: string }).empresa_id,
      nome,
      email,
      role: validRoles[0],
      roles: validRoles,
    });

    if (profileErr) {
      // rollback do auth user para não deixar órfão
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: 'Erro ao criar perfil: ' + profileErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: created.user.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro inesperado.' },
      { status: 500 }
    );
  }
}

// Admin redefine a senha de um usuário da própria empresa
export async function PATCH(request: Request) {
  try {
    const { userId, password } = await request.json();
    if (!userId || !password) return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { data: requester } = await supabase
      .from('usuarios').select('empresa_id, roles, role').eq('id', user.id).single();
    if (!requester || !can(resolveRoles(requester), 'manage_config')) {
      return NextResponse.json({ error: 'Sem permissão para alterar senhas.' }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 });

    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Garante que o alvo é da MESMA empresa do admin (isolamento)
    const { data: alvo } = await admin.from('usuarios').select('empresa_id').eq('id', userId).single();
    if (!alvo || (alvo as { empresa_id: string }).empresa_id !== (requester as { empresa_id: string }).empresa_id) {
      return NextResponse.json({ error: 'Usuário não pertence à sua empresa.' }, { status: 403 });
    }

    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro inesperado.' },
      { status: 500 }
    );
  }
}

// Excluir usuário — SOMENTE papel administrador
export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    // Só quem tem o PAPEL admin pode excluir (não basta manage_config)
    const { data: requester } = await supabase
      .from('usuarios').select('empresa_id, roles, role').eq('id', user.id).single();
    if (!requester || !resolveRoles(requester).includes('admin')) {
      return NextResponse.json({ error: 'Apenas administradores podem excluir usuários.' }, { status: 403 });
    }
    if (userId === user.id) {
      return NextResponse.json({ error: 'Você não pode excluir a própria conta.' }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 });

    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Alvo precisa ser da MESMA empresa (isolamento)
    const { data: alvo } = await admin.from('usuarios').select('empresa_id').eq('id', userId).single();
    if (!alvo || (alvo as { empresa_id: string }).empresa_id !== (requester as { empresa_id: string }).empresa_id) {
      return NextResponse.json({ error: 'Usuário não pertence à sua empresa.' }, { status: 403 });
    }

    // Remove o perfil (FKs em outras tabelas são ON DELETE SET NULL) e depois o usuário do Auth
    await admin.from('usuarios').delete().eq('id', userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro inesperado.' },
      { status: 500 }
    );
  }
}
