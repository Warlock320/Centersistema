'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight, XCircle } from 'lucide-react';
import type { Pedido, PedidoStatus } from '@/types/database.types';
import { usePermissions } from '@/components/PermissionsProvider';

const STEPS: { status: PedidoStatus; label: string }[] = [
  { status: 'aberto', label: 'Aberto' },
  { status: 'em_andamento', label: 'Em Andamento (Separação)' },
  { status: 'faturado', label: 'Faturado' },
];

const NEXT_STATUS: Partial<Record<PedidoStatus, PedidoStatus>> = {
  aberto: 'em_andamento',
  em_andamento: 'faturado',
};
const NEXT_LABEL: Partial<Record<PedidoStatus, string>> = {
  aberto: 'Iniciar Separação',
  em_andamento: 'Faturar Pedido (baixar estoque)',
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [acting, setActing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const [confirmFaturar, setConfirmFaturar] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [erro, setErro] = useState('');

  const supabase = createClient();
  const { can } = usePermissions();

  useEffect(() => {
    // Filtro inicial via query param (?status=aberto) vindo do dashboard
    const sp = new URLSearchParams(window.location.search).get('status');
    if (sp) setFilterStatus(sp);
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nome), pedido_itens(*)')
      .order('numero', { ascending: false });
    setPedidos(data as Pedido[] || []);
    setLoading(false);
  }

  async function openDetail(p: Pedido) {
    setErro('');
    const { data } = await supabase.from('pedidos').select('*, clientes(*), pedido_itens(*)').eq('id', p.id).single();
    setSelected(data as Pedido);
  }

  async function handleStatusChange(newStatus: PedidoStatus) {
    if (!selected) return;
    setActing(true);
    setErro('');

    if (newStatus === 'faturado') {
      // RPC cria movimentações de estoque (saída) e conta a receber atomicamente.
      // Pode falhar se a loja não permite estoque negativo e faltar saldo.
      const { error } = await supabase.rpc('faturar_pedido', { p_pedido_id: selected.id });
      if (error) {
        setErro(error.message || 'Não foi possível faturar o pedido.');
        setActing(false);
        setConfirmFaturar(false);
        return;
      }
    } else {
      await supabase.from('pedidos').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', selected.id);
    }

    setActing(false);
    setConfirmFaturar(false);
    setSelected(null);
    fetchData();
  }

  async function handleCancelar() {
    if (!selected) return;
    setActing(true);
    setErro('');
    const { error } = await supabase.rpc('cancelar_pedido', { p_pedido_id: selected.id });
    if (error) {
      await supabase.from('pedidos').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', selected.id);
    }
    setActing(false);
    setConfirmCancelar(false);
    setSelected(null);
    fetchData();
  }

  const filtered = pedidos.filter((p) => {
    const q = search.toLowerCase();
    const matchQ = !q || p.clientes?.nome.toLowerCase().includes(q) || String(p.numero).includes(q);
    const matchS = !filterStatus || p.status === filterStatus;
    return matchQ && matchS;
  });

  // Cancelar pedido em separação é ação gerencial (depende de approve_orcamentos)
  const podeCancelarAndamento = can('approve_orcamentos');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
        <p className="text-slate-500 text-sm">{pedidos.length} pedido(s) · {pedidos.filter(p => p.status === 'faturado').length} faturado(s)</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nº ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="faturado">Faturado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['#', 'Cliente', 'Status', 'Itens', 'Total', 'Data', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(p)}>
                  <td className="px-6 py-3 font-mono text-slate-500">#{p.numero}</td>
                  <td className="px-6 py-3 font-medium text-slate-900">{p.clientes?.nome}</td>
                  <td className="px-6 py-3"><Badge type="pedido" value={p.status} /></td>
                  <td className="px-6 py-3 text-slate-500">{p.pedido_itens?.length || 0} it.</td>
                  <td className="px-6 py-3 font-medium">{Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-6 py-3 text-slate-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-3"><ChevronRight size={16} className="text-slate-300" /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">Nenhum pedido encontrado</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={`Pedido #${selected.numero}`} size="xl">
          <div className="space-y-5">
            {erro && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <XCircle size={16} className="shrink-0" /> {erro}
              </div>
            )}
            {/* Stepper */}
            {selected.status === 'cancelado' ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <XCircle size={20} />
                <div>
                  <p className="font-semibold">Pedido Cancelado</p>
                  <p className="text-sm">Estoque estornado automaticamente.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {STEPS.map((step, idx) => {
                  const currentIdx = STEPS.findIndex((s) => s.status === selected.status);
                  const isPast = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={step.status} className="flex items-center gap-2 shrink-0 flex-1">
                      <div className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium text-center ${
                        isPast ? 'bg-green-100 text-green-700' :
                        isCurrent ? 'bg-blue-600 text-white' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {isPast && '✓ '}{step.label}
                      </div>
                      {idx < STEPS.length - 1 && <ChevronRight size={16} className="text-slate-300 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info */}
            <div className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-lg p-4">
              <div><span className="text-slate-400 block text-xs">Cliente</span><p className="font-medium">{selected.clientes?.nome}</p></div>
              <div><span className="text-slate-400 block text-xs">Data</span><p className="font-medium">{new Date(selected.created_at).toLocaleDateString('pt-BR')}</p></div>
              <div><span className="text-slate-400 block text-xs">Total</span>
                <p className="font-bold text-lg text-slate-900">{Number(selected.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>

            {/* Items */}
            <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  {['Descrição', 'Qtd', 'Preço Un.', 'Total'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs text-slate-500 font-semibold text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(selected.pedido_itens || []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-50">
                    <td className="px-4 py-2.5">{item.descricao}</td>
                    <td className="px-4 py-2.5">{Number(item.quantidade).toFixed(2)}</td>
                    <td className="px-4 py-2.5">{Number(item.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-4 py-2.5 font-medium">{Number(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selected.observacoes && (
              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <strong className="text-slate-700">Obs:</strong> {selected.observacoes}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 flex-wrap pt-1">
              {selected.status === 'aberto' && (
                <Button onClick={() => handleStatusChange('em_andamento')} loading={acting}>
                  Iniciar Separação
                </Button>
              )}
              {selected.status === 'em_andamento' && (
                <Button variant="success" onClick={() => setConfirmFaturar(true)}>
                  Faturar Pedido
                </Button>
              )}
              {(selected.status === 'aberto' || (selected.status === 'em_andamento' && podeCancelarAndamento)) && (
                <Button variant="danger" size="sm" onClick={() => setConfirmCancelar(true)}>
                  <XCircle size={14} /> Cancelar Pedido
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      <Confirm
        open={confirmFaturar}
        title="Faturar pedido"
        message="O pedido será marcado como faturado e o estoque dos produtos será baixado automaticamente. Essa ação não pode ser desfeita."
        confirmLabel="Confirmar faturamento"
        variant="primary"
        loading={acting}
        onConfirm={() => handleStatusChange('faturado')}
        onCancel={() => setConfirmFaturar(false)}
      />

      <Confirm
        open={confirmCancelar}
        title="Cancelar pedido"
        message="O pedido será cancelado e qualquer saída de estoque já registrada será estornada automaticamente."
        confirmLabel="Sim, cancelar"
        loading={acting}
        onConfirm={handleCancelar}
        onCancel={() => setConfirmCancelar(false)}
      />
    </div>
  );
}
