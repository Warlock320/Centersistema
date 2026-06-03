'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Combobox } from '@/components/ui/Combobox';
import { usePermissions } from '@/components/PermissionsProvider';
import { useToast } from '@/components/ui/Toast';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import { Plus, Minus, SlidersHorizontal, ArrowDownCircle, ArrowUpCircle, Warehouse } from 'lucide-react';
import type { Produto, MovimentacaoEstoque } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
const num = (v: unknown) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

type Operacao = 'entrada' | 'saida' | 'ajuste';

const REF_LABEL: Record<string, string> = {
  nfe: 'NF-e', pedido: 'Pedido', ajuste: 'Manual', compra: 'Compra',
};

export default function EstoquePage() {
  const [movs, setMovs] = useState<(MovimentacaoEstoque & { produtos?: { nome: string; codigo: string | null } })[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterProduto, setFilterProduto] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [op, setOp] = useState<Operacao>('entrada');
  const [prodId, setProdId] = useState('');
  const [qtd, setQtd] = useState('');
  const [custo, setCusto] = useState(0);
  const [novaQtd, setNovaQtd] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');

  const supabase = createClient();
  const toast = useToast();
  const { can } = usePermissions();
  const podeEditar = can('edit_estoque');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [movsRes, prods] = await Promise.all([
      supabase.from('movimentacoes_estoque').select('*, produtos(nome, codigo)').order('created_at', { ascending: false }).limit(200),
      supabase.from('produtos').select('id, nome, codigo, ref, estoque, custo, codigos_auxiliares').eq('ativo', true).order('nome'),
    ]);
    setMovs(movsRes.data as (MovimentacaoEstoque & { produtos?: { nome: string; codigo: string | null } })[] || []);
    setProdutos(prods.data as Produto[] || []);
    setLoading(false);
  }

  function openOp(operacao: Operacao) {
    setOp(operacao);
    setProdId(''); setQtd(''); setCusto(0); setNovaQtd(''); setObs(''); setErro('');
    setShowForm(true);
  }

  const prodSelecionado = produtos.find((p) => p.id === prodId);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!prodId) { setErro('Selecione o produto.'); return; }
    const prod = produtos.find((p) => p.id === prodId);
    if (!prod) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    const empresaId = (usr as { empresa_id: string })!.empresa_id;

    let tipo: 'entrada' | 'saida';
    let quantidade: number;
    let observacao = obs;

    if (op === 'ajuste') {
      const alvo = num(novaQtd);
      const diff = alvo - Number(prod.estoque);
      if (diff === 0) { setErro('A quantidade é igual à atual.'); setSaving(false); return; }
      tipo = diff > 0 ? 'entrada' : 'saida';
      quantidade = Math.abs(diff);
      observacao = `Ajuste de inventário: ${Number(prod.estoque)} → ${alvo}${obs ? ` · ${obs}` : ''}`;
    } else {
      quantidade = num(qtd);
      if (quantidade <= 0) { setErro('Informe a quantidade.'); setSaving(false); return; }
      tipo = op;
    }

    const { error } = await supabase.from('movimentacoes_estoque').insert({
      empresa_id: empresaId,
      produto_id: prodId,
      tipo,
      quantidade,
      custo_unitario: op === 'entrada' ? custo : Number(prod.custo || 0),
      referencia_tipo: 'ajuste',
      observacao: observacao || null,
    });

    if (error) { setErro(error.message); toast.error('Erro: ' + error.message); setSaving(false); return; }

    // Em entrada de compra, atualiza o custo do produto (último custo)
    if (op === 'entrada' && custo > 0) {
      await supabase.from('produtos').update({ custo }).eq('id', prodId);
    }

    setSaving(false);
    setShowForm(false);
    toast.success(op === 'entrada' ? 'Entrada registrada!' : op === 'saida' ? 'Saída registrada!' : 'Estoque ajustado!');
    fetchAll();
  }

  const movsFiltradas = filterProduto ? movs.filter((m) => m.produto_id === filterProduto) : movs;

  const prodOptions = produtos.map((p) => ({
    value: p.id,
    label: p.nome,
    sublabel: `${p.codigo ? `[${p.codigo}] ` : ''}estoque: ${Number(p.estoque).toFixed(0)}`,
    keywords: `${p.codigo || ''} ${p.ref || ''} ${(p.codigos_auxiliares || []).join(' ')}`,
  }));

  const opInfo = {
    entrada: { titulo: 'Entrada de Estoque', cor: 'success' as const, icon: ArrowDownCircle },
    saida: { titulo: 'Saída de Estoque', cor: 'danger' as const, icon: ArrowUpCircle },
    ajuste: { titulo: 'Ajuste de Inventário', cor: 'primary' as const, icon: SlidersHorizontal },
  }[op];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estoque</h1>
          <p className="text-slate-500 text-sm">Movimentações de entrada, saída e ajuste de inventário</p>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            <Button variant="success" size="sm" onClick={() => openOp('entrada')}><Plus size={14} /> Entrada</Button>
            <Button variant="danger" size="sm" onClick={() => openOp('saida')}><Minus size={14} /> Saída</Button>
            <Button variant="secondary" size="sm" onClick={() => openOp('ajuste')}><SlidersHorizontal size={14} /> Ajuste</Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="max-w-sm">
            <Combobox value={filterProduto} onChange={setFilterProduto} options={prodOptions}
              placeholder="Filtrar por produto (código, ref ou nome)..." />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Data', 'Produto', 'Tipo', 'Qtd', 'Custo Un.', 'Origem', 'Observação'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movsFiltradas.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-500">{new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-6 py-3">
                      <p className="font-medium text-slate-800">{m.produtos?.nome || '—'}</p>
                      {m.produtos?.codigo && <p className="text-xs text-slate-400 font-mono">{m.produtos.codigo}</p>}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.tipo === 'entrada' ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                        {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className={`px-6 py-3 font-bold ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {m.tipo === 'entrada' ? '+' : '−'}{Number(m.quantidade).toFixed(0)}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{Number(m.custo_unitario) > 0 ? formatBRL(Number(m.custo_unitario)) : '—'}</td>
                    <td className="px-6 py-3">
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{REF_LABEL[m.referencia_tipo] || m.referencia_tipo}</span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs max-w-xs truncate">{m.observacao || '—'}</td>
                  </tr>
                ))}
                {movsFiltradas.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">Nenhuma movimentação registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de operação */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={opInfo.titulo} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          {erro && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{erro}</div>}

          <Combobox label="Produto *" value={prodId} onChange={setProdId} options={prodOptions}
            placeholder="Buscar produto..." />

          {prodSelecionado && (
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg text-sm">
              <Warehouse size={15} className="text-slate-400" />
              Estoque atual: <strong>{Number(prodSelecionado.estoque).toFixed(0)}</strong>
            </div>
          )}

          {op === 'ajuste' ? (
            <Input label="Nova quantidade (contagem real) *" type="text" inputMode="decimal"
              value={novaQtd} onChange={(e) => setNovaQtd(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="Ex: 7" required />
          ) : (
            <Input label="Quantidade *" type="text" inputMode="decimal"
              value={qtd} onChange={(e) => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="Ex: 10" required />
          )}

          {op === 'entrada' && (
            <Input label="Custo unitário (R$)" inputMode="numeric"
              value={formatMoedaInput(custo)} onChange={(e) => setCusto(parseMoedaInput(e.target.value))}
              placeholder="0,00" />
          )}

          <Textarea label="Observação" value={obs} onChange={(e) => setObs(e.target.value)}
            placeholder={op === 'entrada' ? 'Ex: compra fornecedor X' : op === 'saida' ? 'Ex: perda / uso interno' : 'Ex: inventário mensal'} />

          {op === 'ajuste' && prodSelecionado && novaQtd !== '' && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 text-center">
              {(() => {
                const diff = num(novaQtd) - Number(prodSelecionado.estoque);
                if (diff === 0) return 'Sem alteração';
                return `${diff > 0 ? 'Entrada' : 'Saída'} de ${Math.abs(diff)} un.`;
              })()}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" variant={opInfo.cor} loading={saving} className="flex-1">Confirmar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
