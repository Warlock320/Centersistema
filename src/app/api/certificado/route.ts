import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveRoles, can } from '@/lib/permissions';
import forge from 'node-forge';
import crypto from 'crypto';

export const runtime = 'nodejs';

const BUCKET = 'certificados';

function service() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.');
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function encKey(): Buffer {
  const hex = process.env.CERT_ENC_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('CERT_ENC_KEY ausente ou inválida (precisa ser 64 caracteres hex = 32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

function criptografar(texto: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return { cipher: enc.toString('hex'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

// Autentica o requester e exige manage_config (admin). Retorna empresa_id.
async function autorizar() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado.', status: 401 as const };
  const { data: requester } = await supabase
    .from('usuarios').select('empresa_id, roles, role').eq('id', user.id).single();
  if (!requester || !can(resolveRoles(requester), 'manage_config')) {
    return { error: 'Sem permissão para gerenciar o certificado.', status: 403 as const };
  }
  return { empresaId: (requester as { empresa_id: string }).empresa_id };
}

// Lê os metadados do certificado (sem nada sensível)
export async function GET() {
  const auth = await autorizar();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const admin = service();
  const { data } = await admin.from('certificados_digitais')
    .select('titular_nome, titular_cnpj, validade, ativo, created_at, updated_at')
    .eq('empresa_id', auth.empresaId).maybeSingle();
  return NextResponse.json({ certificado: data || null });
}

// Importa/atualiza o certificado A1 (.pfx + senha)
export async function POST(request: Request) {
  try {
    const auth = await autorizar();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const formData = await request.formData();
    const file = formData.get('arquivo') as File | null;
    const senha = String(formData.get('senha') || '');
    if (!file) return NextResponse.json({ error: 'Selecione o arquivo do certificado (.pfx/.p12).' }, { status: 400 });
    if (!senha) return NextResponse.json({ error: 'Informe a senha do certificado.' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());

    // Valida o .pfx com a senha e extrai titular/CNPJ/validade
    let titularNome = '', titularCnpj = '', validade: string | null = null;
    try {
      const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(buf.toString('binary')));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const bag = certBags[forge.pki.oids.certBag]?.[0];
      const cert = bag?.cert;
      if (!cert) throw new Error('sem certificado');
      const cn = String(cert.subject.getField('CN')?.value || '');
      titularNome = cn.split(':')[0].trim();
      titularCnpj = (cn.match(/\d{14}/) || [])[0] || (cn.match(/\d{11}/) || [])[0] || '';
      validade = cert.validity.notAfter.toISOString().slice(0, 10);
    } catch {
      return NextResponse.json({ error: 'Não foi possível abrir o certificado. Verifique se o arquivo é um .pfx/.p12 válido e se a senha está correta.' }, { status: 400 });
    }

    const senhaEnc = criptografar(senha);
    const admin = service();
    const path = `${auth.empresaId}/cert.pfx`;

    const { error: upErr } = await admin.storage.from(BUCKET)
      .upload(path, buf, { contentType: 'application/x-pkcs12', upsert: true });
    if (upErr) return NextResponse.json({ error: 'Erro ao guardar o arquivo: ' + upErr.message }, { status: 500 });

    const { error: dbErr } = await admin.from('certificados_digitais').upsert({
      empresa_id: auth.empresaId,
      arquivo_path: path,
      titular_nome: titularNome || null,
      titular_cnpj: titularCnpj || null,
      validade,
      senha_cipher: senhaEnc.cipher,
      senha_iv: senhaEnc.iv,
      senha_tag: senhaEnc.tag,
      ativo: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'empresa_id' });
    if (dbErr) return NextResponse.json({ error: 'Erro ao salvar: ' + dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, titular_nome: titularNome, titular_cnpj: titularCnpj, validade });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado.' }, { status: 500 });
  }
}

// Remove o certificado (arquivo + registro)
export async function DELETE() {
  try {
    const auth = await autorizar();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const admin = service();
    await admin.storage.from(BUCKET).remove([`${auth.empresaId}/cert.pfx`]);
    await admin.from('certificados_digitais').delete().eq('empresa_id', auth.empresaId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado.' }, { status: 500 });
  }
}
