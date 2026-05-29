// Bootstrap do usuário MASTER (admin) + empresa.
// Uso:
//   node scripts/criar-master.mjs "email" "senha" "Nome" "Nome da Empresa" "CNPJ"
// As variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são lidas do .env.local.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lê .env.local manualmente (sem dependências externas)
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch { /* ignore */ }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error('❌ Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const [, , email, senha, nome, empresaNome, cnpj] = process.argv;
if (!email || !senha) {
  console.error('Uso: node scripts/criar-master.mjs "email" "senha" "Nome" "Empresa" "CNPJ"');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const NOME = nome || email.split('@')[0];
const EMPRESA = empresaNome || 'Center Auto Peças';
const CNPJ = (cnpj || '').replace(/\D/g, '') || String(Date.now()).padStart(14, '0').slice(0, 14);

async function main() {
  // 1) Já existe esse e-mail?
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === email);

  if (user) {
    console.log(`ℹ️  Usuário ${email} já existe no Auth (id ${user.id}). Vou garantir o perfil admin.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true,
    });
    if (error) { console.error('❌ Erro ao criar no Auth:', error.message); process.exit(1); }
    user = data.user;
    console.log(`✅ Usuário criado no Auth: ${email} (id ${user.id})`);
  }

  // 2) Já tem perfil?
  const { data: perfil } = await admin.from('usuarios').select('id, empresa_id, roles').eq('id', user.id).single();
  if (perfil) {
    // Garante papel admin
    const roles = Array.from(new Set([...(perfil.roles || []), 'admin']));
    await admin.from('usuarios').update({ roles, role: 'admin', ativo: true }).eq('id', user.id);
    console.log(`✅ Perfil já existia — papéis atualizados para: ${roles.join(', ')}`);
    console.log('\n🎉 Pronto! Faça login com o e-mail e senha informados.');
    return;
  }

  // 3) Cria empresa
  const { data: empresa, error: empErr } = await admin
    .from('empresas')
    .insert({ nome: EMPRESA, razao_social: EMPRESA, cnpj: CNPJ })
    .select()
    .single();
  if (empErr) { console.error('❌ Erro ao criar empresa:', empErr.message); process.exit(1); }
  console.log(`✅ Empresa criada: ${EMPRESA} (id ${empresa.id})`);

  // 4) Cria perfil admin
  const { error: usrErr } = await admin.from('usuarios').insert({
    id: user.id, empresa_id: empresa.id, nome: NOME, email,
    role: 'admin', roles: ['admin'], ativo: true,
  });
  if (usrErr) { console.error('❌ Erro ao criar perfil:', usrErr.message); process.exit(1); }
  console.log(`✅ Perfil admin criado: ${NOME}`);

  // 5) Conta caixa + plano de contas padrão
  await admin.from('contas_bancarias').insert({ empresa_id: empresa.id, nome: 'Caixa', tipo: 'caixa', saldo_inicial: 0 });
  await admin.rpc('seed_plano_contas', { p_empresa_id: empresa.id }).then(
    () => console.log('✅ Plano de contas e centros de custo padrão criados'),
    (e) => console.log('⚠️  seed_plano_contas falhou (rode o app que ele cria depois):', e.message)
  );

  console.log('\n🎉 MASTER pronto! Faça login com:');
  console.log(`   E-mail: ${email}`);
  console.log(`   Senha:  ${senha}`);
  console.log('   (troque a senha depois em produção)');
}

main().catch((e) => { console.error(e); process.exit(1); });
