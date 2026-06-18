'use client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Document, Page, View, Text, Image, StyleSheet, pdf } = require('@react-pdf/renderer');
import JsBarcode from 'jsbarcode';
import type { NfeData } from '@/lib/nfe/parser';

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const dataBR = (s: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '');
const horaBR = (s: string) => (s ? new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const chaveFmt = (c: string) => (c || '').replace(/(\d{4})(?=\d)/g, '$1 ');

const FRETE: Record<string, string> = {
  '0': '0 - Rem.', '1': '1 - Dest.', '2': '2 - Terceiros',
  '3': '3 - Próprio Rem.', '4': '4 - Próprio Dest.', '9': '9 - Sem frete',
};

const s = StyleSheet.create({
  page: { paddingVertical: 16, paddingHorizontal: 18, fontFamily: 'Helvetica', fontSize: 6.5, color: '#000' },
  // canhoto
  canhoto: { flexDirection: 'row', borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: '#000' },
  recebemos: { flex: 1, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', padding: 3 },
  recRow: { flexDirection: 'row', marginTop: 4 },
  nfBox: { width: 120, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', padding: 3, alignItems: 'center', justifyContent: 'center' },
  dashed: { borderBottomWidth: 0.7, borderColor: '#000', borderStyle: 'dashed', marginVertical: 4 },
  // grade genérica
  grid: { borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: '#000' },
  row: { flexDirection: 'row' },
  cell: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', paddingHorizontal: 3, paddingVertical: 1.5, justifyContent: 'center' },
  lbl: { fontSize: 5, color: '#333' },
  val: { fontSize: 7 },
  valB: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  secTitle: { fontSize: 6, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 1 },
  center: { alignItems: 'center', textAlign: 'center' },
  // cabeçalho
  emit: { width: '38%', borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', padding: 4, alignItems: 'center', textAlign: 'center', justifyContent: 'center' },
  emitNome: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  danfe: { width: '28%', borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', padding: 3, alignItems: 'center', textAlign: 'center' },
  danfeTit: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  ent: { flexDirection: 'row', borderWidth: 0.5, borderColor: '#000', marginVertical: 2 },
  entN: { fontSize: 10, fontFamily: 'Helvetica-Bold', paddingHorizontal: 4 },
  chaveBox: { width: '34%', borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', padding: 3, alignItems: 'center', textAlign: 'center', justifyContent: 'center', overflow: 'hidden' },
  barcode: { height: 30, width: 180, marginBottom: 2 },
  chaveTxt: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  // produtos
  th: { flexDirection: 'row', borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: '#000', backgroundColor: '#eee' },
  thc: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', paddingHorizontal: 2, paddingVertical: 2, fontSize: 5, textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  tdc: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#000', paddingHorizontal: 2, paddingVertical: 1.5, fontSize: 6 },
});

// larguras das colunas de produto (em %)
const P = { cod: '8%', desc: '30%', ncm: '7%', cst: '5%', cfop: '6%', un: '5%', qt: '8%', vu: '9%', vt: '9%', bc: '8%', vi: '8%', vipi: '7%' };

function Cell({ label, value, w, bold, alignR }: { label: string; value: string; w?: string | number; bold?: boolean; alignR?: boolean }) {
  return (
    <View style={[s.cell, w ? { width: w } : { flex: 1 }]}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={[bold ? s.valB : s.val, alignR ? { textAlign: 'right' } : {}]}>{value || ' '}</Text>
    </View>
  );
}

function DanfeDoc({ data, barcode }: { data: NfeData; barcode: string }) {
  const e = data.emitente;
  const d = data.destinatario;
  const t = data.totais;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* CANHOTO */}
        <View style={s.canhoto}>
          <View style={s.recebemos}>
            <Text style={{ fontSize: 5.5 }}>
              RECEBEMOS DE {e.razaoSocial || data.emitenteNome} OS PRODUTOS / SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
            </Text>
            <View style={s.recRow}>
              <View style={[s.cell, { width: 90, height: 20 }]}><Text style={s.lbl}>DATA DE RECEBIMENTO</Text><Text style={s.val}> </Text></View>
              <View style={[s.cell, { flex: 1, height: 20, borderRightWidth: 0 }]}><Text style={s.lbl}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</Text><Text style={s.val}> </Text></View>
            </View>
          </View>
          <View style={s.nfBox}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>NF-e</Text>
            <Text style={{ fontSize: 7 }}>Nº {String(data.numeroNota).padStart(9, '0')}</Text>
            <Text style={{ fontSize: 7 }}>SÉRIE {data.serie}</Text>
          </View>
        </View>
        <View style={s.dashed} />

        {/* CABEÇALHO */}
        <View style={s.grid}>
          <View style={s.row}>
            {/* Emitente */}
            <View style={s.emit}>
              <Text style={s.emitNome}>{e.nome || data.emitenteNome}</Text>
              <Text>{e.endereco}</Text>
              <Text>{e.bairro}</Text>
              <Text>{[e.cidade, e.estado].filter(Boolean).join(' - ')}{e.cep ? ` - ${e.cep}` : ''}</Text>
              {e.telefone ? <Text>Tel: {e.telefone}</Text> : null}
            </View>
            {/* DANFE */}
            <View style={s.danfe}>
              <Text style={s.danfeTit}>DANFE</Text>
              <Text style={{ fontSize: 5.5 }}>Documento Auxiliar da{'\n'}Nota Fiscal Eletrônica</Text>
              <View style={s.ent}>
                <View style={{ alignItems: 'center', paddingHorizontal: 3, borderRightWidth: 0.5, borderColor: '#000' }}>
                  <Text style={{ fontSize: 5 }}>0-Entrada</Text>
                  <Text style={{ fontSize: 5 }}>1-Saída</Text>
                </View>
                <Text style={s.entN}>{data.tipoNF}</Text>
              </View>
              <Text style={{ fontSize: 6 }}>Nº {String(data.numeroNota).padStart(9, '0')}</Text>
              <Text style={{ fontSize: 6 }}>SÉRIE {data.serie}   FOLHA 1 de 1</Text>
            </View>
            {/* Chave / barcode */}
            <View style={s.chaveBox}>
              {barcode ? <Image src={barcode} style={s.barcode} /> : null}
              <Text style={s.lbl}>CHAVE DE ACESSO</Text>
              <Text style={s.chaveTxt}>{chaveFmt(data.chaveAcesso)}</Text>
              <Text style={{ fontSize: 5, marginTop: 2 }}>Consulta de autenticidade no portal nacional da NF-e</Text>
              <Text style={{ fontSize: 5 }}>www.nfe.fazenda.gov.br/portal</Text>
            </View>
          </View>
          {/* Natureza / Protocolo */}
          <View style={s.row}>
            <Cell label="NATUREZA DA OPERAÇÃO" value={data.naturezaOperacao} w="50%" />
            <Cell label="PROTOCOLO DE AUTORIZAÇÃO DE USO" value={data.protocolo.numero ? `${data.protocolo.numero}  ${dataBR(data.protocolo.data)} ${horaBR(data.protocolo.data)}` : ''} />
          </View>
          {/* IE / IE ST / CNPJ */}
          <View style={s.row}>
            <Cell label="INSCRIÇÃO ESTADUAL" value={e.ie} w="34%" />
            <Cell label="INSC. ESTADUAL DO SUBST. TRIB." value="" w="33%" />
            <Cell label="CNPJ" value={e.cnpj} />
          </View>
        </View>

        {/* DESTINATÁRIO / REMETENTE */}
        <Text style={s.secTitle}>DESTINATÁRIO / REMETENTE</Text>
        <View style={s.grid}>
          <View style={s.row}>
            <Cell label="NOME / RAZÃO SOCIAL" value={d.nome} w="56%" />
            <Cell label="CNPJ / CPF" value={d.doc} w="26%" />
            <Cell label="DATA DA EMISSÃO" value={dataBR(data.dataEmissao)} />
          </View>
          <View style={s.row}>
            <Cell label="ENDEREÇO" value={d.endereco} w="40%" />
            <Cell label="BAIRRO / DISTRITO" value={d.bairro} w="24%" />
            <Cell label="CEP" value={d.cep} w="18%" />
            <Cell label="DATA SAÍDA / ENTRADA" value="" />
          </View>
          <View style={s.row}>
            <Cell label="MUNICÍPIO" value={d.municipio} w="28%" />
            <Cell label="FONE / FAX" value={d.telefone} w="18%" />
            <Cell label="UF" value={d.uf} w="8%" />
            <Cell label="INSCRIÇÃO ESTADUAL" value={d.ie} w="28%" />
            <Cell label="HORA SAÍDA" value="" />
          </View>
        </View>

        {/* FATURA / DUPLICATAS */}
        {data.duplicatas.length > 0 && (
          <>
            <Text style={s.secTitle}>FATURA / DUPLICATAS</Text>
            <View style={s.grid}>
              <View style={s.row}>
                {data.duplicatas.slice(0, 6).map((dp, i) => (
                  <Cell key={i} label={`PARC. ${dp.numero || i + 1}`} value={`${dataBR(dp.vencimento)}  R$ ${money(dp.valor)}`} />
                ))}
              </View>
            </View>
          </>
        )}

        {/* CÁLCULO DO IMPOSTO */}
        <Text style={s.secTitle}>CÁLCULO DO IMPOSTO</Text>
        <View style={s.grid}>
          <View style={s.row}>
            <Cell label="BASE DE CÁLCULO DO ICMS" value={money(t.baseIcms)} alignR />
            <Cell label="VALOR DO ICMS" value={money(t.valorIcms)} alignR />
            <Cell label="BASE CÁLCULO ICMS ST" value={money(t.baseIcmsSt)} alignR />
            <Cell label="VALOR ICMS ST" value={money(t.valorIcmsSt)} alignR />
            <Cell label="VALOR TOTAL PRODUTOS" value={money(t.valorProdutos)} alignR />
          </View>
          <View style={s.row}>
            <Cell label="VALOR DO FRETE" value={money(t.valorFrete)} alignR />
            <Cell label="VALOR DO SEGURO" value={money(t.valorSeguro)} alignR />
            <Cell label="DESCONTO" value={money(t.desconto)} alignR />
            <Cell label="OUTRAS DESPESAS" value={money(t.outrasDespesas)} alignR />
            <Cell label="VALOR DO IPI" value={money(t.valorIpi)} alignR />
            <Cell label="VALOR TOTAL DA NOTA" value={money(t.valorTotal)} bold alignR />
          </View>
        </View>

        {/* TRANSPORTADOR */}
        <Text style={s.secTitle}>TRANSPORTADOR / VOLUMES TRANSPORTADOS</Text>
        <View style={s.grid}>
          <View style={s.row}>
            <Cell label="FRETE POR CONTA" value={FRETE[data.modalidadeFrete] || data.modalidadeFrete} w="20%" />
            <Cell label="VALOR APROX. DOS TRIBUTOS" value={money(t.valorAproxTributos)} alignR />
          </View>
        </View>

        {/* DADOS DOS PRODUTOS */}
        <Text style={s.secTitle}>DADOS DOS PRODUTOS / SERVIÇOS</Text>
        <View style={s.th}>
          <Text style={[s.thc, { width: P.cod }]}>CÓD</Text>
          <Text style={[s.thc, { width: P.desc }]}>DESCRIÇÃO</Text>
          <Text style={[s.thc, { width: P.ncm }]}>NCM/SH</Text>
          <Text style={[s.thc, { width: P.cst }]}>CST</Text>
          <Text style={[s.thc, { width: P.cfop }]}>CFOP</Text>
          <Text style={[s.thc, { width: P.un }]}>UN</Text>
          <Text style={[s.thc, { width: P.qt }]}>QUANT</Text>
          <Text style={[s.thc, { width: P.vu }]}>V.UNIT</Text>
          <Text style={[s.thc, { width: P.vt }]}>V.TOTAL</Text>
          <Text style={[s.thc, { width: P.bc }]}>BC ICMS</Text>
          <Text style={[s.thc, { width: P.vi }]}>V.ICMS</Text>
          <Text style={[s.thc, { width: P.vipi }]}>V.IPI</Text>
        </View>
        <View style={s.grid}>
          {data.produtos.map((p, i) => (
            <View style={s.row} key={i}>
              <Text style={[s.tdc, { width: P.cod }]}>{p.codigo}</Text>
              <Text style={[s.tdc, { width: P.desc }]}>{p.descricao}</Text>
              <Text style={[s.tdc, { width: P.ncm }]}>{p.ncm}</Text>
              <Text style={[s.tdc, { width: P.cst }]}>{p.cst}</Text>
              <Text style={[s.tdc, { width: P.cfop }]}>{p.cfop}</Text>
              <Text style={[s.tdc, { width: P.un }]}>{p.unidade}</Text>
              <Text style={[s.tdc, { width: P.qt, textAlign: 'right' }]}>{qtd(p.quantidade)}</Text>
              <Text style={[s.tdc, { width: P.vu, textAlign: 'right' }]}>{money(p.valorUnitario)}</Text>
              <Text style={[s.tdc, { width: P.vt, textAlign: 'right' }]}>{money(p.valorTotal)}</Text>
              <Text style={[s.tdc, { width: P.bc, textAlign: 'right' }]}>{money(p.baseIcms)}</Text>
              <Text style={[s.tdc, { width: P.vi, textAlign: 'right' }]}>{money(p.valorIcms)}</Text>
              <Text style={[s.tdc, { width: P.vipi, textAlign: 'right' }]}>{money(p.valorIpi)}</Text>
            </View>
          ))}
        </View>

        {/* DADOS ADICIONAIS */}
        <Text style={s.secTitle}>DADOS ADICIONAIS</Text>
        <View style={[s.grid, { minHeight: 40 }]}>
          <View style={s.row}>
            <Cell label="INFORMAÇÕES COMPLEMENTARES" value={data.informacoesComplementares} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

function barcodeDataUrl(chave: string): string {
  if (!chave) return '';
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, chave, { format: 'CODE128C', displayValue: false, height: 50, width: 1.2, margin: 2 });
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/** Gera o PDF do DANFE (layout oficial) e dispara o download no navegador. */
export async function baixarDanfe(data: NfeData) {
  const barcode = barcodeDataUrl(data.chaveAcesso);
  const blob = await pdf(<DanfeDoc data={data} barcode={barcode} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DANFE-${data.numeroNota}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
