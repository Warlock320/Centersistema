'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Share2, Copy, CheckCircle, Search, Package } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface ProdCatalogo {
  id: string;
  codigo: string | null;
  nome: string;
  preco: number;
  estoque: number;
  selecionado: boolean;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CatalogoPage() {
  const supabase = createClient();
  const toast = useToast();
  const [produtos, setProdutos] = useState<ProdCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [titulo, setTitulo] = useState('Promoções da Semana');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('produtos')
        .select('id, codigo, nome, preco, estoque')
        .eq('ativo', true).gt('estoque', 0).order('nome');
      setProdutos((data || []).map((p) => ({ ...p, selecionado: false } as ProdCatalogo)));
      setLoading(false);
    })();
  }, [supabase]);

  function toggleProduto(id: string) {
    setProdutos((prev) => prev.map((p) => p.id === id ? { ...p, selecionado: !p.selecionado } : p));
  }

  function toggleTodos() {
    const filtered = produtosFiltrados.map((p) => p.id);
    const allSelected = filtered.every((id) => produtos.find((p) => p.id === id)?.selecionado);
    setProdutos((prev) => prev.map((p) => filtered.includes(p.id) ? { ...p, selecionado: !allSelected } : p));
  }

  const selecionados = produtos.filter((p) => p.selecionado);

  function gerarTexto(): string {
    const linhas = [
      `*${titulo}*`,
      '',
      ...selecionados.map((p, i) => `${i + 1}. *${p.nome}*${p.codigo ? ` (${p.codigo})` : ''}\n   ${brl(p.preco)}`),
      '',
      `Total: ${selecionados.length} produto(s)`,
      '',
      'Consulte disponibilidade e faça seu pedido!',
    ];
    return linhas.join('\n');
  }

  function copiarTexto() {
    navigator.clipboard.writeText(gerarTexto());
    setCopiado(true);
    toast.success('Texto copiado!');
    setTimeout(() => setCopiado(false), 2000);
  }

  function enviarWhatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(gerarTexto())}`, '_blank');
  }

  const q = busca.toLowerCase();
  const produtosFiltrados = produtos.filter((p) =>
    !q || p.nome.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catálogo WhatsApp</h1>
          <p className="text-slate-500 text-sm">Selecione produtos e compartilhe com clientes via WhatsApp</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copiarTexto} disabled={selecionados.length === 0}>
            {copiado ? <CheckCircle size={14} /> : <Copy size={14} />} {copiado ? 'Copiado!' : 'Copiar texto'}
          </Button>
          <Button variant="success" onClick={enviarWhatsapp} disabled={selecionados.length === 0}>
            <Share2 size={14} /> WhatsApp ({selecionados.length})
          </Button>
        </div>
      </div>

      {/* Título do catálogo */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <label className="text-sm font-medium text-slate-700 block mb-1">Título do catálogo</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
          className="w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg" />
      </div>

      {/* Preview */}
      {selecionados.length > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <p className="text-xs font-medium text-green-700 mb-2">Preview da mensagem:</p>
          <pre className="text-sm text-green-900 whitespace-pre-wrap font-sans">{gerarTexto()}</pre>
        </div>
      )}

      {/* Lista de produtos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg" />
          </div>
          <Button variant="ghost" size="sm" onClick={toggleTodos}>
            {produtosFiltrados.every((p) => p.selecionado) ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Carregando...</div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-50">
            {produtosFiltrados.map((p) => (
              <label key={p.id} className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-slate-50 ${p.selecionado ? 'bg-blue-50' : ''}`}>
                <input type="checkbox" checked={p.selecionado} onChange={() => toggleProduto(p.id)} className="rounded" />
                <Package size={16} className="text-slate-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.nome}</p>
                  <p className="text-xs text-slate-400">{p.codigo || '—'} · Estoque: {Number(p.estoque).toFixed(0)}</p>
                </div>
                <span className="text-sm font-semibold text-slate-700">{brl(p.preco)}</span>
              </label>
            ))}
            {produtosFiltrados.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-sm">Nenhum produto encontrado</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
