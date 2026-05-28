'use client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Document, Page, View, Text, StyleSheet, PDFDownloadLink } = require('@react-pdf/renderer');

import { Button } from './ui/Button';
import { FileDown } from 'lucide-react';
import type { Orcamento } from '@/types/database.types';

interface Props {
  orcamento: Orcamento;
  empresaNome?: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b' },
  header: { marginBottom: 24, borderBottom: '2px solid #2563eb', paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2563eb', marginBottom: 2 },
  subtitle: { fontSize: 10, color: '#64748b' },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 120, color: '#64748b', fontSize: 9 },
  value: { flex: 1 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 8, color: '#475569' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: '6 8', borderRadius: 4, marginBottom: 2 },
  tableRow: { flexDirection: 'row', padding: '5 8', borderBottom: '1px solid #f1f5f9' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingTop: 8, borderTop: '1px solid #cbd5e1' },
  totalLabel: { fontWeight: 'bold', marginRight: 16 },
  totalValue: { fontWeight: 'bold', fontSize: 13, color: '#2563eb' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#94a3b8', fontSize: 8 },
});

function OrcamentoDoc({ orcamento, empresaNome }: Props) {
  const itens = orcamento.orcamento_itens || [];
  const cliente = orcamento.clientes;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{empresaNome || 'Center Auto Peças'}</Text>
          <Text style={styles.subtitle}>Orçamento #{orcamento.numero}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>{cliente?.nome || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CPF/CNPJ:</Text>
            <Text style={styles.value}>{cliente?.cpf_cnpj || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Validade:</Text>
            <Text style={styles.value}>
              {orcamento.validade ? new Date(orcamento.validade).toLocaleDateString('pt-BR') : '-'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Data:</Text>
            <Text style={styles.value}>{new Date(orcamento.created_at).toLocaleDateString('pt-BR')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itens do Orçamento</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, { fontWeight: 'bold' }]}>Descrição</Text>
            <Text style={[styles.col2, { fontWeight: 'bold' }]}>Qtd</Text>
            <Text style={[styles.col2, { fontWeight: 'bold' }]}>Preço Un.</Text>
            <Text style={[styles.col2, { fontWeight: 'bold' }]}>Desc %</Text>
            <Text style={[styles.col2, { fontWeight: 'bold' }]}>Total</Text>
          </View>
          {itens.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{item.descricao}</Text>
              <Text style={styles.col2}>{item.quantidade}</Text>
              <Text style={styles.col2}>
                {Number(item.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
              <Text style={styles.col2}>{item.desconto}%</Text>
              <Text style={styles.col2}>
                {Number(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Geral:</Text>
          <Text style={styles.totalValue}>
            {Number(orcamento.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </Text>
        </View>

        {orcamento.observacoes && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text>{orcamento.observacoes}</Text>
          </View>
        )}

        <Text style={styles.footer}>Documento gerado pelo sistema Center Auto Peças Gestão</Text>
      </Page>
    </Document>
  );
}

export default function OrcamentoPDFButtonInner({ orcamento, empresaNome }: Props) {
  return (
    <PDFDownloadLink
      document={<OrcamentoDoc orcamento={orcamento} empresaNome={empresaNome} />}
      fileName={`orcamento-${orcamento.numero}.pdf`}
    >
      {({ loading }: { loading: boolean }) => (
        <Button variant="secondary" size="sm" loading={loading}>
          <FileDown size={14} />
          {loading ? 'Gerando...' : 'PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
