import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { resolveRoles, can } from '@/lib/permissions';
import { buildNfeXml, type NfeBuildInput } from '@/lib/nfe/builder';
import { extractCertificate, signNfeXml } from '@/lib/nfe/signer';
import { enviarNfeSefaz } from '@/lib/nfe/sefaz';
import { IBGE_UF } from '@/lib/nfe/constants';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

function service() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function decryptPassword(cipher: string, iv: string, tag: string): string {
  const hex = process.env.CERT_ENC_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('CERT_ENC_KEY ausente ou inválida.');
  const key = Buffer.from(hex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(cipher, 'hex', 'utf8') + decipher.final('utf8');
}

export async function POST(request: Request) {
  try {
    // 1. Autenticação e permissão
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const { data: requester } = await supabase
      .from('usuarios').select('empresa_id, roles, role').eq('id', user.id).single();
    if (!requester || !can(resolveRoles(requester), 'manage_config')) {
      return NextResponse.json({ error: 'Sem permissão para emitir NF-e.' }, { status: 403 });
    }
    const empresaId = (requester as { empresa_id: string }).empresa_id;

    // 2. Dados do request
    const body = await request.json();
    const { pedido_id, simulacao } = body as { pedido_id: string; simulacao?: boolean };
    if (!pedido_id) return NextResponse.json({ error: 'pedido_id é obrigatório.' }, { status: 400 });

    const admin = service();

    // 3. Carregar empresa com campos fiscais
    const { data: empresa, error: empErr } = await admin
      .from('empresas').select('*').eq('id', empresaId).single();
    if (empErr || !empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

    if (!simulacao && (!empresa.inscricao_estadual || !empresa.codigo_municipio)) {
      return NextResponse.json({ error: 'Configure os dados fiscais da empresa (IE, código município) antes de emitir NF-e.' }, { status: 400 });
    }

    // 4. Carregar pedido + itens + cliente
    const { data: pedido, error: pedErr } = await admin
      .from('pedidos').select('*, clientes(*), pedido_itens(*)').eq('id', pedido_id).single();
    if (pedErr || !pedido) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    if (pedido.status === 'faturado') return NextResponse.json({ error: 'Este pedido já foi faturado.' }, { status: 400 });
    if (pedido.status !== 'em_andamento') return NextResponse.json({ error: 'Apenas pedidos em andamento (separação concluída) podem ser faturados.' }, { status: 400 });
    if (pedido.nfe_id) return NextResponse.json({ error: 'Este pedido já possui uma NF-e vinculada.' }, { status: 400 });

    const cliente = pedido.clientes;
    if (!cliente) return NextResponse.json({ error: 'Cliente do pedido não encontrado.' }, { status: 404 });

    // 5. Carregar dados fiscais dos produtos
    const produtoIds = (pedido.pedido_itens || [])
      .map((i: { produto_id: string | null }) => i.produto_id).filter(Boolean);
    const { data: produtosRaw } = produtoIds.length
      ? await admin.from('produtos').select('id, codigo, ncm, cfop_saida, origem, csosn, cst_icms, aliquota_icms, cest, cst_pis, cst_cofins, aliquota_pis, aliquota_cofins').in('id', produtoIds)
      : { data: [] };
    const prodMap = new Map((produtosRaw || []).map((p: Record<string, unknown>) => [p.id, p]));

    const itensComFiscal = (pedido.pedido_itens || []).map((item: Record<string, unknown>) => {
      const prod = prodMap.get(item.produto_id) as Record<string, unknown> | undefined;
      return {
        ...item,
        ncm: (prod?.ncm as string) || '00000000',
        cfop: (prod?.cfop_saida as string) || '5102',
        origem: (prod?.origem as number) ?? 0,
        csosn: (prod?.csosn as string) || '102',
        cst_icms: (prod?.cst_icms as string) || null,
        aliquota_icms: Number(prod?.aliquota_icms || 0),
        cst_pis: (prod?.cst_pis as string) || '99',
        cst_cofins: (prod?.cst_cofins as string) || '99',
        aliquota_pis: Number(prod?.aliquota_pis || 0),
        aliquota_cofins: Number(prod?.aliquota_cofins || 0),
        cest: (prod?.cest as string) || undefined,
        codigo_produto: (prod?.codigo as string) || undefined,
      };
    });

    // 6. Obter próximo número e incrementar atomicamente
    const numero = empresa.nfe_proximo_numero || 1;
    const serieFiscal = empresa.nfe_serie || 1;
    await admin.from('empresas').update({ nfe_proximo_numero: numero + 1 }).eq('id', empresaId);

    // 7. Gerar XML
    const ambienteEmissao = simulacao ? 2 : (empresa.nfe_ambiente || 2);
    const buildInput: NfeBuildInput = {
      empresa,
      cliente,
      itens: itensComFiscal,
      numero,
      serie: serieFiscal,
      ambiente: ambienteEmissao,
    };
    const { xml, chaveAcesso } = buildNfeXml(buildInput);

    // ── MODO SIMULAÇÃO ──────────────────────────────────────────────
    if (simulacao) {
      const protSimulado = `SIM${Date.now()}`;
      const { data: nfeRecord, error: nfeInsErr } = await admin.from('nfe_emitidas').insert({
        empresa_id: empresaId,
        pedido_id,
        numero,
        serie: serieFiscal,
        chave_acesso: chaveAcesso,
        status: 'autorizada',
        protocolo_autorizacao: protSimulado,
        xml_envio: xml,
        xml_autorizada: xml,
        motivo: 'SIMULAÇÃO — sem valor fiscal (certificado e SEFAZ não utilizados)',
        destinatario_nome: cliente.nome,
        destinatario_doc: cliente.cpf_cnpj,
        valor_total: pedido.total,
      }).select('id').single();
      if (nfeInsErr) return NextResponse.json({ error: 'Erro ao registrar NF-e: ' + nfeInsErr.message }, { status: 500 });

      // Faturar pedido (estoque + conta a receber + status) e vincular NF-e
      const { error: fatErr } = await admin.rpc('faturar_pedido', { p_pedido_id: pedido_id });
      if (fatErr) {
        await admin.from('nfe_emitidas').delete().eq('id', nfeRecord!.id);
        return NextResponse.json({ error: 'NF-e gerada mas erro ao faturar: ' + fatErr.message }, { status: 500 });
      }

      const { error: linkErr } = await admin.from('pedidos').update({ nfe_id: nfeRecord!.id }).eq('id', pedido_id);
      if (linkErr) {
        // Pedido já faturado, mas sem vínculo — tenta novamente
        await admin.from('pedidos').update({ nfe_id: nfeRecord!.id }).eq('id', pedido_id);
      }

      // Registrar na aba de saída (não bloqueia se falhar)
      await admin.from('notas_saida').insert({
        empresa_id: empresaId,
        chave_acesso: chaveAcesso,
        numero_nota: String(numero),
        destinatario_nome: cliente.nome,
        destinatario_doc: cliente.cpf_cnpj,
        cliente_id: cliente.id,
        valor_total: pedido.total,
        data_emissao: new Date().toISOString().slice(0, 10),
        arquivo_path: `nfe-emitida/${nfeRecord!.id}`,
        arquivo_nome: `NFe_${chaveAcesso}.xml`,
        arquivo_tipo: 'xml',
      }).then(() => {});

      return NextResponse.json({
        ok: true,
        simulacao: true,
        nfe_id: nfeRecord!.id,
        chave_acesso: chaveAcesso,
        protocolo: protSimulado,
        numero,
        serie: serieFiscal,
        status: 'autorizada',
        motivo: 'SIMULAÇÃO — NF-e gerada sem envio à SEFAZ',
      });
    }

    // ── MODO REAL ───────────────────────────────────────────────────

    // 8. Carregar certificado e assinar
    const { data: certRecord } = await admin.from('certificados_digitais')
      .select('arquivo_path, senha_cipher, senha_iv, senha_tag')
      .eq('empresa_id', empresaId).eq('ativo', true).single();
    if (!certRecord) return NextResponse.json({ error: 'Certificado digital não encontrado. Importe-o em Configurações.' }, { status: 400 });

    const { data: pfxFile } = await admin.storage.from('certificados').download(certRecord.arquivo_path);
    if (!pfxFile) return NextResponse.json({ error: 'Arquivo do certificado não encontrado no Storage.' }, { status: 500 });

    const pfxBuffer = Buffer.from(await pfxFile.arrayBuffer());
    const senha = decryptPassword(certRecord.senha_cipher, certRecord.senha_iv, certRecord.senha_tag);
    const certData = extractCertificate(pfxBuffer, senha);

    const xmlAssinado = signNfeXml(xml, certData);

    // 9. Criar registro NF-e como "processando"
    const { data: nfeRecord, error: nfeInsErr } = await admin.from('nfe_emitidas').insert({
      empresa_id: empresaId,
      pedido_id,
      numero,
      serie: serieFiscal,
      chave_acesso: chaveAcesso,
      status: 'processando',
      xml_envio: xmlAssinado,
      destinatario_nome: cliente.nome,
      destinatario_doc: cliente.cpf_cnpj,
      valor_total: pedido.total,
    }).select('id').single();
    if (nfeInsErr) return NextResponse.json({ error: 'Erro ao registrar NF-e: ' + nfeInsErr.message }, { status: 500 });
    const nfeId = nfeRecord!.id;

    // 10. Enviar à SEFAZ
    const uf = IBGE_UF[empresa.codigo_uf || ''] || empresa.estado || 'SP';
    let sefazResult;
    try {
      sefazResult = await enviarNfeSefaz(xmlAssinado, uf, empresa.nfe_ambiente || 2, certData);
    } catch (err) {
      await admin.from('nfe_emitidas').update({
        status: 'rejeitada',
        motivo: `Erro de comunicação: ${err instanceof Error ? err.message : String(err)}`,
        updated_at: new Date().toISOString(),
      }).eq('id', nfeId);
      return NextResponse.json({
        error: 'Falha na comunicação com a SEFAZ: ' + (err instanceof Error ? err.message : String(err)),
        nfe_id: nfeId,
      }, { status: 502 });
    }

    // 11. Processar resposta
    const protCstat = sefazResult.protNFe?.infProt.cStat;

    if (protCstat === '100') {
      const prot = sefazResult.protNFe!.infProt;
      await admin.from('nfe_emitidas').update({
        status: 'autorizada',
        protocolo_autorizacao: prot.nProt,
        xml_autorizada: sefazResult.xmlAutorizada || xmlAssinado,
        motivo: prot.xMotivo,
        updated_at: new Date().toISOString(),
      }).eq('id', nfeId);

      // Faturar pedido (estoque + conta a receber + status) e vincular NF-e
      const { error: fatErr } = await admin.rpc('faturar_pedido', { p_pedido_id: pedido_id });
      if (fatErr) {
        return NextResponse.json({
          ok: false, nfe_id: nfeId, status: 'autorizada',
          error: 'NF-e autorizada mas erro ao faturar pedido: ' + fatErr.message,
        }, { status: 500 });
      }

      const { error: linkErr } = await admin.from('pedidos').update({ nfe_id: nfeId }).eq('id', pedido_id);
      if (linkErr) {
        await admin.from('pedidos').update({ nfe_id: nfeId }).eq('id', pedido_id);
      }

      // Registrar na aba de saída (não bloqueia se falhar)
      await admin.from('notas_saida').insert({
        empresa_id: empresaId,
        chave_acesso: chaveAcesso,
        numero_nota: String(numero),
        destinatario_nome: cliente.nome,
        destinatario_doc: cliente.cpf_cnpj,
        cliente_id: cliente.id,
        valor_total: pedido.total,
        data_emissao: new Date().toISOString().slice(0, 10),
        arquivo_path: `nfe-emitida/${nfeId}`,
        arquivo_nome: `NFe_${chaveAcesso}.xml`,
        arquivo_tipo: 'xml',
      }).then(() => {});

      return NextResponse.json({
        ok: true,
        nfe_id: nfeId,
        chave_acesso: chaveAcesso,
        protocolo: prot.nProt,
        numero,
        serie: serieFiscal,
        status: 'autorizada',
        motivo: prot.xMotivo,
      });
    }

    const statusFinal = protCstat === '110' || protCstat === '301' || protCstat === '302' ? 'denegada' : 'rejeitada';
    const motivo = sefazResult.protNFe?.infProt.xMotivo || sefazResult.xMotivo || `cStat ${sefazResult.cStat}`;

    await admin.from('nfe_emitidas').update({
      status: statusFinal,
      motivo,
      updated_at: new Date().toISOString(),
    }).eq('id', nfeId);

    return NextResponse.json({
      ok: false,
      nfe_id: nfeId,
      status: statusFinal,
      cStat: protCstat || sefazResult.cStat,
      motivo,
    }, { status: 422 });

  } catch (err) {
    console.error('Erro emissão NF-e:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erro inesperado na emissão.',
    }, { status: 500 });
  }
}
