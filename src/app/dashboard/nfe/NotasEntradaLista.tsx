'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { matchBusca } from '@/lib/busca';
import { Download, Search, RefreshCw } from 'lucide-react';

interface NfeImportada {
  id: string;
  chave_acesso: string;
  numero_nota: number;
  emitente_nome: string;
  valor_total: number;
  created_at: string;
}

const moeda = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function NotasEntradaLista({ refreshKey }: { refreshKey?: number }) {
  const supabase = createClient();
  const [notas, setNotas] = useState<NfeImportada[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from('nfe_importadas')
      .select('id, chave_acesso, numero_nota, emitente_nome, valor_total, created_at')
      .order('created_at', { ascending: false });
    setNotas((data as NfeImportada[]) || []);
    setLoading(false);
  }

  const filtradas = notas.filter((n) => {
    const matchQ = matchBusca(`${n.numero_nota} ${n.emitente_nome} ${n.chave_acesso}`, busca);
    const ref = n.created_at.slice(0, 10);
    return matchQ && (!de || ref >= de) && (!ate || ref <= ate);
  });

  async function baixarXml(n: NfeImportada) {
    const { data } = await supabase.from('nfe_importadas').select('xml_conteudo').eq('id', n.id).single();
    const xml = (data as { xml_conteudo?: string } | null)?.xml_conteudo;
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe-${n.numero_nota}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº, fornecedor, chave..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-64 max-w-full" />
          </div>
          <label className="text-xs text-slate-500">De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="block mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" /></label>
          <label className="text-xs text-slate-500">Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="block mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" /></label>
        </div>
        <button onClick={carregar} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 px-3 py-2"><RefreshCw size={14} /> Atualizar</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left px-4 py-3">Nº</th>
              <th className="text-left px-4 py-3">Fornecedor</th>
              <th className="text-left px-4 py-3">Importada em</th>
              <th className="text-right px-4 py-3">Valor</th>
              <th className="text-right px-4 py-3">XML</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Carregando...</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nenhuma nota de entrada importada.</td></tr>}
            {filtradas.map((n) => (
              <tr key={n.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-800">{n.numero_nota}</td>
                <td className="px-4 py-3 text-slate-700">{n.emitente_nome}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(n.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-right text-slate-700">{moeda(n.valor_total)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => baixarXml(n)} title="Baixar XML" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Download size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
