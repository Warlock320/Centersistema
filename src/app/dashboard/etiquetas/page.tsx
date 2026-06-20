'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { Printer, Plus, Trash2, Tag } from 'lucide-react';
import JsBarcode from 'jsbarcode';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Document, Page, View, Text, Image, StyleSheet, pdf } = require('@react-pdf/renderer');

interface ProdutoEtiqueta {
  id: string;
  codigo: string | null;
  nome: string;
  preco: number;
  codigos_auxiliares: string[];
  quantidade: number;
}

const s = StyleSheet.create({
  page: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, fontFamily: 'Helvetica' },
  etiqueta: {
    width: '33.33%', height: 80, padding: 4, borderWidth: 0.5, borderColor: '#ccc',
    alignItems: 'center', justifyContent: 'center',
  },
  codigo: { fontSize: 7, color: '#666', marginBottom: 1 },
  nome: { fontSize: 6.5, textAlign: 'center', maxLines: 2, marginBottom: 2 },
  barcode: { width: 80, height: 22, marginBottom: 1 },
  preco: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
});

function barcodeUrl(code: string): string {
  if (!code) return '';
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, code, { format: 'CODE128', displayValue: false, height: 30, width: 1, margin: 0 });
    return canvas.toDataURL('image/png');
  } catch { return ''; }
}

function EtiquetaDoc({ produtos }: { produtos: ProdutoEtiqueta[] }) {
  const items: ProdutoEtiqueta[] = [];
  produtos.forEach((p) => { for (let i = 0; i < p.quantidade; i++) items.push(p); });
  const barcodes = items.map((p) => barcodeUrl(p.codigos_auxiliares?.[0] || p.codigo || p.id.slice(0, 8)));

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {items.map((p, i) => (
          <View key={i} style={s.etiqueta}>
            <Text style={s.codigo}>{p.codigo || '—'}</Text>
            <Text style={s.nome}>{p.nome.slice(0, 40)}</Text>
            {barcodes[i] ? <Image src={barcodes[i]} style={s.barcode} /> : null}
            <Text style={s.preco}>R$ {Number(p.preco).toFixed(2).replace('.', ',')}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export default function EtiquetasPage() {
  const supabase = createClient();
  const [produtos, setProdutos] = useState<{ id: string; nome: string; codigo: string | null; preco: number; codigos_auxiliares: string[] }[]>([]);
  const [selecionados, setSelecionados] = useState<ProdutoEtiqueta[]>([]);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('produtos').select('id, nome, codigo, preco, codigos_auxiliares').eq('ativo', true).order('nome');
      setProdutos(data || []);
    })();
  }, [supabase]);

  function addProduto(prodId: string) {
    const p = produtos.find((x) => x.id === prodId);
    if (!p || selecionados.some((s) => s.id === prodId)) return;
    setSelecionados((prev) => [...prev, { ...p, quantidade: 1 }]);
  }

  function setQtd(id: string, qtd: number) {
    setSelecionados((prev) => prev.map((p) => p.id === id ? { ...p, quantidade: Math.max(1, qtd) } : p));
  }

  function remover(id: string) {
    setSelecionados((prev) => prev.filter((p) => p.id !== id));
  }

  async function gerarPDF() {
    if (selecionados.length === 0) return;
    setGerando(true);
    try {
      const blob = await pdf(<EtiquetaDoc produtos={selecionados} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etiquetas_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGerando(false);
    }
  }

  const totalEtiquetas = selecionados.reduce((s, p) => s + p.quantidade, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Etiquetas de Preço</h1>
          <p className="text-slate-500 text-sm">Gere etiquetas com código de barras para impressão</p>
        </div>
        <Button onClick={gerarPDF} loading={gerando} disabled={selecionados.length === 0}>
          <Printer size={16} /> Gerar PDF ({totalEtiquetas} etiqueta{totalEtiquetas !== 1 ? 's' : ''})
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div className="max-w-md">
          <Combobox
            label="Adicionar produto"
            value=""
            onChange={addProduto}
            options={produtos.map((p) => ({
              value: p.id,
              label: p.nome,
              sublabel: `${p.codigo || '—'} · R$ ${Number(p.preco).toFixed(2)}`,
            }))}
            placeholder="Buscar produto por nome ou código..."
          />
        </div>

        {selecionados.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Tag size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Adicione produtos para gerar etiquetas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Produto', 'Código', 'Preço', 'Qtd Etiquetas', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selecionados.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.nome}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono">{p.codigo || '—'}</td>
                  <td className="px-4 py-2.5">R$ {Number(p.preco).toFixed(2).replace('.', ',')}</td>
                  <td className="px-4 py-2.5">
                    <input type="number" min={1} value={p.quantidade}
                      onChange={(e) => setQtd(p.id, Number(e.target.value))}
                      className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center" />
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => remover(p.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
