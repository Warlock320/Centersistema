'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { OrcamentoPDFButton } from '@/components/OrcamentoPDF';
import { Plus, Copy, ChevronRight, Trash2, AlertTriangle, Clock, Send } from 'lucide-react';
import type { Orcamento, OrcamentoStatus, Cliente, Produto, OrcamentoItem, Usuario, TabelaPreco, PrecoProdutoView } from '@/types/database.types';

const STATUS_STEPS: OrcamentoStatus[] = [
  'criado', 'orcamento_enviado', 'aguardando_aprovacao', 'aprovado', 'aguardando_pecas', 'enviado',
];
const STATUS_LABELS: Record<OrcamentoStatus, string> = {
  criado: 'Criado', orcamento_enviado: 'Enviado', aguardando_aprovacao: 'Ag. Aprovação',
  aprovado: 'Aprovado', aguardando_pecas: 'Ag. Peças', enviado: 'Entregue', cancelado: 'Cancelado',
};
const NEXT_STATUS: Partial<Record<OrcamentoStatus, OrcamentoStatus>> = {
  criado: 'orcamento_enviado', orcamento_enviado: 'aguardando_aprovacao',
  aprovado: 'aguardando_pecas', aguardando_pecas: 'enviado',
};
const NEXT_BTN: Partial<Record<OrcamentoStatus, string>> = {
  criado: 'Enviar Orçamento', orcamento_enviado: 'Solicitar Aprovação',
  aprovado: 'Iniciar Separação', aguardando_pecas: 'Marcar como Entregue',
};

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState<Orcamento | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const [formClienteId, setFormClienteId] = useState('');
  const [formValidade, setFormValidade] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formTabelaId, setFormTabelaId] = useState('');
  const [itens, setItens] = useState<Partial<OrcamentoItem>[]>([
    { descricao: '', quantidade: 1, preco_unitario: 0, desconto: 0, total: 0 },
  ]);

  const [tabelas, setTabelas] = useState<TabelaPreco[]>([]);
  // precosMap[tabelaId][produtoId] = preço
  const [precosMap, setPrecosMap] = useState<Record<string, Record<string, number>>>({});

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: usr } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
      setUsuario(usr as Usuario);
    }
    setLoading(true);
    const [orcs, clis, prods, tabs, precos] = await Promise.all([
      supabase.from('orcamentos').select('*, clientes(nome), usuarios(nome), orcamento_itens(*)').order('numero', { ascending: false }),
      supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('produtos').select('id, nome, codigo, preco, estoque').eq('ativo', true).order('nome'),
      supabase.from('tabelas_preco').select('*').eq('ativo', true).order('padrao', { ascending: false }).order('nome'),
      supabase.from('v_precos_produto').select('produto_id, tabela_preco_id, preco'),
    ]);
    setOrcamentos(orcs.data as Orcamento[] || []);
    setClientes(clis.data as Cliente[] || []);
    setProdutos(prods.data as Produto[] || []);

    const tabList = tabs.data as TabelaPreco[] || [];
    setTabelas(tabList);
    const padrao = tabList.find((t) => t.padrao) || tabList[0];
    if (padrao) setFormTabelaId(padrao.id);

    const map: Record<string, Record<string, number>> = {};
    (precos.data as PrecoProdutoView[] || []).forEach((p) => {
      if (!map[p.tabela_preco_id]) map[p.tabela_preco_id] = {};
      map[p.tabela_preco_id][p.produto_id] = Number(p.preco);
    });
    setPrecosMap(map);

    setLoading(false);
  }

  // Preço de um produto na tabela selecionada (fallback: preço base do produto)
  function precoNaTabela(prodId: string, fallback: number): number {
    return precosMap[formTabelaId]?.[prodId] ?? fallback;
  }

  async function openDetail(orc: Orcamento) {
    const { data } = await supabase.from('orcamentos').select('*, clientes(*), usuarios(nome), orcamento_itens(*)').eq('id', orc.id).single();
    setSelected(data as Orcamento);
    setShowDetail(true);
  }

  function recalcItem(index: number, field: string, value: string | number) {
    setItens((prev) => {
      const copy = [...prev];
      (copy[index] as Record<string, unknown>)[field] = value;
      const item = copy[index];
      const qty = Number(item.quantidade || 0);
      const price = Number(item.preco_unitario || 0);
      const disc = Number(item.desconto || 0);
      copy[index].total = parseFloat((qty * price * (1 - disc / 100)).toFixed(2));
      return copy;
    });
  }

  function setItemProduto(index: number, prodId: string) {
    const prod = produtos.find((p) => p.id === prodId);
    if (!prod) return;
    const preco = precoNaTabela(prodId, prod.preco);
    setItens((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], produto_id: prodId, descricao: prod.nome, preco_unitario: preco };
      const qty = Number(copy[index].quantidade || 1);
      const disc = Number(copy[index].desconto || 0);
      copy[index].total = parseFloat((qty * preco * (1 - disc / 100)).toFixed(2));
      return copy;
    });
  }

  // Ao trocar a tabela de preço, recalcula os itens que têm produto vinculado
  function trocarTabela(tabelaId: string) {
    setFormTabelaId(tabelaId);
    setItens((prev) => prev.map((item) => {
      if (!item.produto_id) return item;
      const prod = produtos.find((p) => p.id === item.produto_id);
      const preco = precosMap[tabelaId]?.[item.produto_id] ?? prod?.preco ?? Number(item.preco_unitario || 0);
      const qty = Number(item.quantidade || 1);
      const disc = Number(item.desconto || 0);
      return { ...item, preco_unitario: preco, total: parseFloat((qty * preco * (1 - disc / 100)).toFixed(2)) };
    }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const total = itens.reduce((s, i) => s + Number(i.total || 0), 0);

    const { data: orcData, error } = await supabase
      .from('orcamentos')
      .insert({
        empresa_id: usuario?.empresa_id,
        cliente_id: formClienteId,
        usuario_id: usuario?.id,
        validade: formValidade || null,
        observacoes: formObs || null,
        total,
      })
      .select()
      .single();

    if (!error && orcData) {
      const itemsToInsert = itens.map((it, i) => ({
        orcamento_id: orcData.id,
        produto_id: it.produto_id || null,
        descricao: it.descricao || '',
        quantidade: Number(it.quantidade || 1),
        preco_unitario: Number(it.preco_unitario || 0),
        desconto: Number(it.desconto || 0),
        total: Number(it.total || 0),
        ordem: i,
      }));
      await supabase.from('orcamento_itens').insert(itemsToInsert);
    }

    setSaving(false);
    setShowForm(false);
    setItens([{ descricao: '', quantidade: 1, preco_unitario: 0, desconto: 0, total: 0 }]);
    setFormClienteId('');
    fetchData();
  }

  async function handleStatusChange(newStatus: OrcamentoStatus) {
    if (!selected) return;
    setActing(true);
    await supabase.from('orcamentos').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (newStatus === 'aprovado') {
      await supabase.rpc('create_pedido_from_orcamento', { orcamento_id: selected.id });
    }
    setActing(false);
    setShowDetail(false);
    fetchData();
  }

  async function handleDuplicate() {
    if (!selected) return;
    setActing(true);
    await supabase.rpc('duplicate_orcamento', { orcamento_id: selected.id });
    setActing(false);
    setShowDetail(false);
    fetchData();
  }

  const filtered = orcamentos.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.clientes?.nome.toLowerCase().includes(q) || String(o.numero).includes(q);
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusOpts = [
    { value: 'criado', label: 'Criado' }, { value: 'orcamento_enviado', label: 'Enviado' },
    { value: 'aguardando_aprovacao', label: 'Ag. Aprovação' }, { value: 'aprovado', label: 'Aprovado' },
    { value: 'aguardando_pecas', label: 'Ag. Peças' }, { value: 'enviado', label: 'Entregue' },
    { value: 'cancelado', label: 'Cancelado' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orçamentos</h1>
          <p className="text-slate-500 text-sm">{orcamentos.length} orçamento(s)</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> Novo Orçamento
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3">
          <input
            type="text"
            placeholder="Buscar por nº ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['#', 'Cliente', 'Vendedor', 'Status', 'Validade', 'Total', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((orc) => (
                <tr key={orc.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(orc)}>
                  <td className="px-6 py-3 font-mono text-slate-500">#{orc.numero}</td>
                  <td className="px-6 py-3 font-medium text-slate-900">{orc.clientes?.nome}</td>
                  <td className="px-6 py-3 text-slate-500">{orc.usuarios?.nome}</td>
                  <td className="px-6 py-3"><Badge type="orcamento" value={orc.status} /></td>
                  <td className="px-6 py-3 text-slate-500">{orc.validade ? new Date(orc.validade).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-6 py-3 font-medium">{Number(orc.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-6 py-3"><ChevronRight size={16} className="text-slate-300" /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Nenhum orçamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* New Orcamento Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo Orçamento" size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <Select
                label="Cliente *"
                value={formClienteId}
                onChange={(e) => setFormClienteId(e.target.value)}
                options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Tabela de Preço</label>
              <select value={formTabelaId} onChange={(e) => trocarTabela(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
                {tabelas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}{Number(t.ajuste_percentual) !== 0 ? ` (${t.ajuste_percentual > 0 ? '+' : ''}${t.ajuste_percentual}%)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Validade" type="date" value={formValidade} onChange={(e) => setFormValidade(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Itens</label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setItens((p) => [...p, { descricao: '', quantidade: 1, preco_unitario: 0, desconto: 0, total: 0 }])}>
                <Plus size={14} /> Adicionar item
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-slate-500">Produto</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-500">Descrição</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-500">Qtd</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-500">Preço</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-500">Desc%</th>
                    <th className="px-3 py-2 text-right text-xs text-slate-500">Total</th>
                    <th className="px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <select
                          value={item.produto_id || ''}
                          onChange={(e) => setItemProduto(i, e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Selecionar...</option>
                          {produtos.map((p) => {
                            const pr = precoNaTabela(p.id, p.preco);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.codigo ? `[${p.codigo}] ` : ''}{p.nome} — {pr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (est: {Number(p.estoque).toFixed(0)})
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.descricao || ''}
                          onChange={(e) => recalcItem(i, 'descricao', e.target.value)}
                          placeholder="Descrição"
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.001" min="0.001" value={item.quantidade || 1}
                          onChange={(e) => recalcItem(i, 'quantidade', e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-16 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" min="0" value={item.preco_unitario || 0}
                          onChange={(e) => recalcItem(i, 'preco_unitario', e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" min="0" max="100" value={item.desconto || 0}
                          onChange={(e) => recalcItem(i, 'desconto', e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 w-14 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-slate-800 text-xs">
                        {Number(item.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-2">
                        {itens.length > 1 && (
                          <button type="button" onClick={() => setItens((p) => p.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-slate-600">Total:</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">
                      {itens.reduce((s, i) => s + Number(i.total || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <Textarea label="Observações" value={formObs} onChange={(e) => setFormObs(e.target.value)} />

          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">Salvar Orçamento</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {selected && (
        <Modal open={showDetail} onClose={() => setShowDetail(false)} title={`Orçamento #${selected.numero}`} size="xl">
          <div className="space-y-5">
            {/* Cancelado Banner */}
            {selected.status === 'cancelado' ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <AlertTriangle size={20} />
                <div>
                  <p className="font-semibold">Orçamento Cancelado</p>
                  {selected.observacoes && <p className="text-sm">{selected.observacoes}</p>}
                </div>
              </div>
            ) : (
              /* Stepper visual */
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {STATUS_STEPS.map((step, idx) => {
                  const currentIdx = STATUS_STEPS.indexOf(selected.status as OrcamentoStatus);
                  const isPast = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={step} className="flex items-center gap-1 shrink-0">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
                        isPast ? 'bg-green-100 text-green-700' :
                        isCurrent ? 'bg-blue-600 text-white' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {isPast ? '✓ ' : ''}{STATUS_LABELS[step]}
                      </div>
                      {idx < STATUS_STEPS.length - 1 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Aguardando aprovação — aviso */}
            {selected.status === 'aguardando_aprovacao' && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                <Clock size={16} className="shrink-0" />
                Este orçamento está na <strong className="ml-1">Fila de Aprovação</strong>. Aguarde a decisão de um gestor ou administrador.
              </div>
            )}

            {/* Info */}
            <div className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-lg p-3">
              <div><span className="text-xs text-slate-400 block">Cliente</span><p className="font-medium">{selected.clientes?.nome}</p></div>
              <div><span className="text-xs text-slate-400 block">Vendedor</span><p className="font-medium">{selected.usuarios?.nome}</p></div>
              <div>
                <span className="text-xs text-slate-400 block">Validade</span>
                <p className={`font-medium ${selected.validade && new Date(selected.validade) < new Date() ? 'text-red-600' : ''}`}>
                  {selected.validade ? new Date(selected.validade).toLocaleDateString('pt-BR') : '—'}
                  {selected.validade && new Date(selected.validade) < new Date() && ' (vencido)'}
                </p>
              </div>
            </div>

            {/* Items */}
            <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  {['Descrição', 'Qtd', 'Preço Un.', 'Desc%', 'Total'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs text-slate-500 font-semibold text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(selected.orcamento_itens || []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5">{item.descricao}</td>
                    <td className="px-4 py-2.5">{Number(item.quantidade).toFixed(2)}</td>
                    <td className="px-4 py-2.5">{Number(item.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-4 py-2.5 text-slate-400">{item.desconto}%</td>
                    <td className="px-4 py-2.5 font-medium">{Number(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-right font-semibold text-slate-600">Total:</td>
                  <td className="px-4 py-2.5 font-bold text-xl text-slate-900">
                    {Number(selected.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              </tfoot>
            </table>

            {selected.observacoes && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                <strong>Observações:</strong> {selected.observacoes}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap items-center">
              {/* Botão de avanço de status (bloqueado em aguardando_aprovacao) */}
              {NEXT_STATUS[selected.status] && selected.status !== 'aguardando_aprovacao' && (
                <Button onClick={() => handleStatusChange(NEXT_STATUS[selected.status]!)} loading={acting}>
                  <Send size={14} /> {NEXT_BTN[selected.status]}
                </Button>
              )}
              {/* PDF */}
              <OrcamentoPDFButton orcamento={selected} empresaNome={usuario?.empresa_id ? undefined : 'Center Auto Peças'} />
              {/* Duplicar */}
              <Button variant="secondary" onClick={handleDuplicate} loading={acting}>
                <Copy size={14} /> Duplicar
              </Button>
              {/* Cancelar — somente status permitidos */}
              {!['aprovado', 'aguardando_pecas', 'enviado', 'cancelado'].includes(selected.status) && (
                <Button variant="danger" size="sm" onClick={() => handleStatusChange('cancelado')}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
