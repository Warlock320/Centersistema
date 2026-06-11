'use client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Document, Page, View, Text, StyleSheet, pdf } = require('@react-pdf/renderer');
import type { NfeData } from '@/lib/nfe/parser';

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (s: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica', fontSize: 8, color: '#1e293b' },
  head: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 8, marginBottom: 10 },
  emit: { flex: 1 },
  emitNome: { fontSize: 12, fontWeight: 'bold' },
  small: { fontSize: 7.5, color: '#475569' },
  box: { border: '1px solid #cbd5e1', borderRadius: 3, padding: 6, alignItems: 'center', width: 150 },
  boxTitle: { fontSize: 7, color: '#64748b' },
  boxBig: { fontSize: 13, fontWeight: 'bold' },
  chave: { fontSize: 7, marginTop: 3 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 8, fontWeight: 'bold', color: '#475569', marginBottom: 3, backgroundColor: '#f1f5f9', padding: '3 5' },
  row: { flexDirection: 'row' },
  th: { flexDirection: 'row', backgroundColor: '#0f172a', color: '#fff', padding: '4 4' },
  td: { flexDirection: 'row', padding: '3 4', borderBottom: '0.5px solid #e2e8f0' },
  cCod: { width: 55 }, cDesc: { flex: 1 }, cNcm: { width: 50 }, cQtd: { width: 38, textAlign: 'right' },
  cUn: { width: 50, textAlign: 'right' }, cTot: { width: 55, textAlign: 'right' },
  totalBox: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalLabel: { fontWeight: 'bold', marginRight: 12 }, totalVal: { fontWeight: 'bold', fontSize: 12 },
  dupRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '0.5px solid #e2e8f0', padding: '2 4' },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, textAlign: 'center', color: '#94a3b8', fontSize: 6.5 },
});

function DanfeDoc({ data }: { data: NfeData }) {
  const e = data.emitente;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.head}>
          <View style={styles.emit}>
            <Text style={styles.emitNome}>{e.nome || data.emitenteNome}</Text>
            {e.razaoSocial && e.razaoSocial !== e.nome ? <Text style={styles.small}>{e.razaoSocial}</Text> : null}
            <Text style={styles.small}>CNPJ: {e.cnpj}{e.ie ? `  IE: ${e.ie}` : ''}</Text>
            {e.endereco ? <Text style={styles.small}>{e.endereco}</Text> : null}
            <Text style={styles.small}>{[e.cidade, e.estado].filter(Boolean).join(' - ')}{e.cep ? `  CEP ${e.cep}` : ''}{e.telefone ? `  Tel ${e.telefone}` : ''}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>DANFE</Text>
            <Text style={styles.boxBig}>Nº {data.numeroNota}</Text>
            <Text style={styles.small}>Emissão: {dataBR(data.dataEmissao)}</Text>
            <Text style={styles.chave}>Chave: {data.chaveAcesso}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESTINATÁRIO</Text>
          <Text>{data.destinatario.nome || '—'}{data.destinatario.doc ? `   —   ${data.destinatario.doc}` : ''}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRODUTOS / SERVIÇOS</Text>
          <View style={styles.th}>
            <Text style={styles.cCod}>Código</Text>
            <Text style={styles.cDesc}>Descrição</Text>
            <Text style={styles.cNcm}>NCM</Text>
            <Text style={styles.cQtd}>Qtd</Text>
            <Text style={styles.cUn}>V.Unit</Text>
            <Text style={styles.cTot}>V.Total</Text>
          </View>
          {data.produtos.map((p, i) => (
            <View style={styles.td} key={i}>
              <Text style={styles.cCod}>{p.codigo || '—'}</Text>
              <Text style={styles.cDesc}>{p.descricao}</Text>
              <Text style={styles.cNcm}>{p.ncm || '—'}</Text>
              <Text style={styles.cQtd}>{p.quantidade}</Text>
              <Text style={styles.cUn}>{money(p.valorUnitario)}</Text>
              <Text style={styles.cTot}>{money(p.valorTotal)}</Text>
            </View>
          ))}
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>TOTAL DA NOTA</Text>
            <Text style={styles.totalVal}>R$ {money(data.valorTotal)}</Text>
          </View>
        </View>

        {data.duplicatas.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DUPLICATAS / FATURA</Text>
            {data.duplicatas.map((d, i) => (
              <View style={styles.dupRow} key={i}>
                <Text>Parcela {d.numero || i + 1}</Text>
                <Text>Venc.: {dataBR(d.vencimento)}</Text>
                <Text>R$ {money(d.valor)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          Representação gerada pelo sistema a partir do XML da NF-e — documento auxiliar para conferência interna.
        </Text>
      </Page>
    </Document>
  );
}

/** Gera o PDF do DANFE e dispara o download no navegador. */
export async function baixarDanfe(data: NfeData) {
  const blob = await pdf(<DanfeDoc data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `DANFE-${data.numeroNota}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
