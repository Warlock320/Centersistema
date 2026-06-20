'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { usePermissions } from '@/components/PermissionsProvider';
import {
  RotateCcw, Search, Plus, CheckCircle, XCircle, Package,
} from 'lucide-react';
import type {
  Devolucao, DevolucaoItem, DevolucaoStatus, DevolucaoTipo,
  Pedido, PedidoItem,
} from '@/types/database.types';

const statusColors: Record<DevolucaoStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700',
  aprovada: 'bg-blue-100 text-blue-700',
  concluida: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
};

const statusLabels: Record<DevolucaoStatus, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const tipoLabels: Record<DevolucaoTipo, string> = {
  devolucao: 'Devolução',
  troca: 'Troca',
};

interface ItemParaDevolucao {
  pedido_item_id: string;
  produto_id: string | null;
  descricao: string;
  quantidade_max: number;
  quantidade: number;
  preco_unitario: number;
  selecionado: boolean;
}

export default function DevolucoesPage() {
  const supabase = createClient();
  const { can } = usePermissions();

  const [devolucoes, setDevolucoes] = useState<Devolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [acting, setActing] = useState(false);

  // Modal nova devolução
  const [novaModal, setNovaModal] = useState(false);
  const [tipo, setTipo] = useState<DevolucaoTipo>('devolucao');
  const [motivo, setMotivo] = useState('');
  const [pedidoBusca, setPedidoBusca] = useState('');
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [itensDevolucao, setItensDevolucao] = useState<ItemParaDevolucao[]>([]);
  const [buscandoPedido, setBuscandoPedido] = useState(false);
  const [erroPedido, setErroPedido] = useState('');

  // Modal detalhe
  const [detalheModal, setDetalheModal] = useState(false);
  const [detalhe, setDetalhe] = useState<Devolucao | null>(null);
  const [detalheItens, setDetalheItens] = useState<DevolucaoItem[]>([]);

  const fetchDevolucoes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('devolucoes')
      .select('*, clientes(nome), pedidos(numero)')
      .order('created_at', { ascending: false });
    setDevolucoes((data || []) as Devolucao[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDevolucoes(); }, [fetchDevolucoes]);

  // Buscar pedido pelo número
  async function buscarPedido() {
    const num = parseInt(pedidoBusca.replace('#', '').trim());
    if (isNaN(num)) { setErroPedido('Informe o número do pedido.'); return; }

    setBuscandoPedido(true);
    setErroPedido('');
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, clientes(nome), pedido_itens(*)')
      .eq('numero', num)
      .single();

    if (error || !data) {
      setErroPedido('Pedido não encontrado.');
      setBuscandoPedido(false);
      return;
    }

    const pedido = data as Pedido;
    setPedidoSelecionado(pedido);

    const itens: ItemParaDevolucao[] = (pedido.pedido_itens || []).map((it: PedidoItem) => ({
      pedido_item_id: it.id,
      produto_id: it.produto_id,
      descricao: it.descricao,
      quantidade_max: it.quantidade,
      quantidade: it.quantidade,
      preco_unitario: it.preco_unitario,
      selecionado: false,
    }));

    setItensDevolucao(itens);
    setBuscandoPedido(false);
  }

  function toggleItem(idx: number) {
    setItensDevolucao((prev) =>
      prev.map((it, i) => i === idx ? { ...it, selecionado: !it.selecionado } : it)
    );
  }

  function updateQtd(idx: number, val: string) {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;
    setItensDevolucao((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, quantidade: Math.min(num, it.quantidade_max) } : it
      )
    );
  }

  async function handleCriarDevolucao() {
    if (!pedidoSelecionado || !motivo.trim()) return;
    const selecionados = itensDevolucao.filter((it) => it.selecionado);
    if (selecionados.length === 0) return;

    setActing(true);
    const valorTotal = selecionados.reduce(
      (s, it) => s + it.quantidade * it.preco_unitario,
      0
    );

    // Buscar empresa_id
    const { data: me } = await supabase.from('usuarios').select('empresa_id, id').limit(1).single();
    if (!me) { setActing(false); return; }

    // Inserir devolução
    const { data: dev, error: devErr } = await supabase
      .from('devolucoes')
      .insert({
        empresa_id: me.empresa_id,
        pedido_id: pedidoSelecionado.id,
        cliente_id: pedidoSelecionado.cliente_id,
        tipo,
        motivo: motivo.trim(),
        valor_total: valorTotal,
        status: 'pendente',
      })
      .select()
      .single();

    if (devErr || !dev) {
      setActing(false);
      return;
    }

    // Inserir itens
    const itensInsert = selecionados.map((it) => ({
      devolucao_id: dev.id,
      produto_id: it.produto_id,
      descricao: it.descricao,
      quantidade: it.quantidade,
      valor_unitario: it.preco_unitario,
      total: it.quantidade * it.preco_unitario,
    }));

    await supabase.from('devolucao_itens').insert(itensInsert);

    setActing(false);
    setNovaModal(false);
    resetNovaForm();
    fetchDevolucoes();
  }

  async function handleAprovar(dev: Devolucao) {
    if (!confirm(`Confirma a aprovação desta ${tipoLabels[dev.tipo].toLowerCase()}? O estoque dos itens será estornado.`)) return;
    setActing(true);
    try {
      const { data: me } = await supabase.from('usuarios').select('id, empresa_id').limit(1).single();
      if (!me) throw new Error('Usuário não encontrado');

      const { data: itens } = await supabase.from('devolucao_itens').select('*').eq('devolucao_id', dev.id);

      // Estorno atômico via RPC
      const itensEstorno = (itens || [])
        .filter((it: DevolucaoItem) => it.produto_id)
        .map((it: DevolucaoItem) => ({
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          descricao: it.descricao,
        }));

      if (itensEstorno.length > 0) {
        const { error: estErr } = await supabase.rpc('estornar_estoque_devolucao', {
          p_empresa_id: me.empresa_id,
          p_itens: itensEstorno,
        });
        if (estErr) {
          // Fallback: inserir movimentações uma a uma
          for (const it of itensEstorno) {
            await supabase.from('movimentacoes_estoque').insert({
              empresa_id: me.empresa_id,
              produto_id: it.produto_id,
              tipo: 'entrada',
              quantidade: it.quantidade,
              custo_unitario: 0,
              referencia_tipo: 'devolucao',
              referencia_id: dev.id,
              observacao: `Estorno — ${it.descricao}`,
            });
          }
        }
      }

      const { error: upErr } = await supabase.from('devolucoes')
        .update({ status: 'concluida', aprovado_por: me.id }).eq('id', dev.id);
      if (upErr) throw upErr;
    } catch (err) {
      alert('Erro ao aprovar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActing(false);
      fetchDevolucoes();
    }
  }

  async function handleCancelar(dev: Devolucao) {
    if (!confirm('Cancelar esta devolução? Esta ação não pode ser desfeita.')) return;
    setActing(true);
    const { error } = await supabase.from('devolucoes').update({ status: 'cancelada' }).eq('id', dev.id);
    if (error) alert('Erro: ' + error.message);
    setActing(false);
    fetchDevolucoes();
  }

  async function openDetalhe(dev: Devolucao) {
    setDetalhe(dev);
    const { data } = await supabase
      .from('devolucao_itens')
      .select('*')
      .eq('devolucao_id', dev.id);
    setDetalheItens((data || []) as DevolucaoItem[]);
    setDetalheModal(true);
  }

  function resetNovaForm() {
    setTipo('devolucao');
    setMotivo('');
    setPedidoBusca('');
    setPedidoSelecionado(null);
    setItensDevolucao([]);
    setErroPedido('');
  }

  function openNovaModal() {
    resetNovaForm();
    setNovaModal(true);
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const filtered = devolucoes.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (d.clientes?.nome || '').toLowerCase().includes(q) ||
      d.motivo.toLowerCase().includes(q) ||
      String(d.pedidos?.numero || '').includes(q);
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const selecionados = itensDevolucao.filter((it) => it.selecionado);
  const valorTotalNova = selecionados.reduce(
    (s, it) => s + it.quantidade * it.preco_unitario,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devoluções e Trocas</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie devoluções e trocas de produtos</p>
        </div>
        {can('edit_pedidos') && (
          <Button onClick={openNovaModal}>
            <Plus size={16} />
            Nova Devolução
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, motivo ou nº pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="aprovada">Aprovada</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            {search || filterStatus
              ? 'Nenhuma devolução encontrada com os filtros aplicados.'
              : 'Nenhuma devolução registrada.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pedido</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Motivo</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        d.tipo === 'devolucao' ? 'bg-red-50 text-red-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {d.tipo === 'devolucao' ? <RotateCcw size={12} /> : <Package size={12} />}
                        {tipoLabels[d.tipo]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-800">{d.clientes?.nome || '-'}</td>
                    <td className="px-6 py-3 text-center text-slate-600">#{d.pedidos?.numero || '-'}</td>
                    <td className="px-6 py-3 text-slate-600 max-w-[200px] truncate" title={d.motivo}>{d.motivo}</td>
                    <td className="px-6 py-3 text-right font-medium text-slate-800">{fmt(d.valor_total)}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{fmtDate(d.created_at)}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[d.status]}`}>
                        {statusLabels[d.status]}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openDetalhe(d)}>
                          Detalhes
                        </Button>
                        {d.status === 'pendente' && can('edit_pedidos') && (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              loading={acting}
                              onClick={() => handleAprovar(d)}
                            >
                              <CheckCircle size={14} />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              loading={acting}
                              onClick={() => handleCancelar(d)}
                            >
                              <XCircle size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova Devolução */}
      <Modal open={novaModal} onClose={() => setNovaModal(false)} title="Nova Devolução / Troca" size="lg">
        <div className="space-y-4">
          {/* Tipo */}
          <div className="flex gap-3">
            <button
              onClick={() => setTipo('devolucao')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                tipo === 'devolucao'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Devolução
            </button>
            <button
              onClick={() => setTipo('troca')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                tipo === 'troca'
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Troca
            </button>
          </div>

          {/* Busca de pedido */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Nº do Pedido</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: 1234"
                value={pedidoBusca}
                onChange={(e) => setPedidoBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarPedido()}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button variant="secondary" loading={buscandoPedido} onClick={buscarPedido}>
                <Search size={14} />
                Buscar
              </Button>
            </div>
            {erroPedido && <p className="text-xs text-red-500 mt-1">{erroPedido}</p>}
          </div>

          {/* Info do pedido encontrado */}
          {pedidoSelecionado && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>Pedido:</strong> #{pedidoSelecionado.numero}</p>
              <p><strong>Cliente:</strong> {pedidoSelecionado.clientes?.nome || '-'}</p>
              <p><strong>Total:</strong> {fmt(pedidoSelecionado.total)}</p>
            </div>
          )}

          {/* Itens do pedido */}
          {itensDevolucao.length > 0 && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                Selecione os itens para {tipo === 'devolucao' ? 'devolução' : 'troca'}
              </label>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-10 px-3 py-2" />
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Produto</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500">Qtd</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Unit.</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensDevolucao.map((it, idx) => (
                      <tr key={idx} className={`border-b border-slate-100 ${it.selecionado ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={it.selecionado}
                            onChange={() => toggleItem(idx)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-800">{it.descricao}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            max={it.quantidade_max}
                            step="1"
                            value={it.quantidade}
                            onChange={(e) => updateQtd(idx, e.target.value)}
                            disabled={!it.selecionado}
                            className="w-16 text-center border border-slate-200 rounded px-1 py-0.5 text-sm disabled:bg-slate-50"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmt(it.preco_unitario)}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">
                          {it.selecionado ? fmt(it.quantidade * it.preco_unitario) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selecionados.length > 0 && (
                <div className="mt-2 text-right text-sm font-semibold text-slate-700">
                  Total: {fmt(valorTotalNova)}
                </div>
              )}
            </div>
          )}

          {/* Motivo */}
          <Textarea
            label="Motivo *"
            placeholder="Descreva o motivo da devolução ou troca..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />

          {/* Ações */}
          <div className="flex gap-3 pt-2">
            <Button
              loading={acting}
              disabled={!pedidoSelecionado || !motivo.trim() || selecionados.length === 0}
              onClick={handleCriarDevolucao}
              className="flex-1"
            >
              Registrar {tipoLabels[tipo]}
            </Button>
            <Button variant="secondary" onClick={() => setNovaModal(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalhe */}
      <Modal open={detalheModal} onClose={() => setDetalheModal(false)} title="Detalhes da Devolução" size="lg">
        {detalhe && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Tipo</p>
                <p className="text-sm font-medium">{tipoLabels[detalhe.tipo]}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[detalhe.status]}`}>
                  {statusLabels[detalhe.status]}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Cliente</p>
                <p className="text-sm font-medium">{detalhe.clientes?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Pedido</p>
                <p className="text-sm font-medium">#{detalhe.pedidos?.numero || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Data</p>
                <p className="text-sm font-medium">{fmtDate(detalhe.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Valor Total</p>
                <p className="text-sm font-bold text-slate-900">{fmt(detalhe.valor_total)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase mb-1">Motivo</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{detalhe.motivo}</p>
            </div>

            {detalheItens.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase mb-2">Itens</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Produto</th>
                        <th className="text-center px-4 py-2 text-xs font-semibold text-slate-500">Qtd</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Unit.</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalheItens.map((it) => (
                        <tr key={it.id} className="border-b border-slate-100">
                          <td className="px-4 py-2 text-slate-800">{it.descricao}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{it.quantidade}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{fmt(it.valor_unitario)}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-800">{fmt(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
