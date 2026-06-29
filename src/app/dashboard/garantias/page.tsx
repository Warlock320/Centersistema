'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { usePermissions } from '@/components/PermissionsProvider';
import { Search, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Garantia, GarantiaStatus } from '@/types/database.types';
import { Pagination } from '@/components/ui/Pagination';

const statusColors: Record<GarantiaStatus, string> = {
  ativa: 'bg-green-100 text-green-700',
  expirada: 'bg-slate-100 text-slate-600',
  acionada: 'bg-amber-100 text-amber-700',
  cancelada: 'bg-red-100 text-red-700',
};

const statusLabels: Record<GarantiaStatus, string> = {
  ativa: 'Ativa',
  expirada: 'Expirada',
  acionada: 'Acionada',
  cancelada: 'Cancelada',
};

const statusIcons: Record<GarantiaStatus, React.ElementType> = {
  ativa: CheckCircle,
  expirada: Clock,
  acionada: AlertTriangle,
  cancelada: XCircle,
};

export default function GarantiasPage() {
  const supabase = createClient();
  const { can } = usePermissions();

  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modal de acionamento
  const [acionarModal, setAcionarModal] = useState(false);
  const [selectedGarantia, setSelectedGarantia] = useState<Garantia | null>(null);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const fetchGarantias = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from('garantias')
      .select('*, clientes(nome), pedidos(numero)')
      .order('data_expiracao', { ascending: true });

    const hoje = new Date().toISOString().split('T')[0];
    const list = (data || []) as Garantia[];

    // Auto-marcar expiradas
    const expiradas = list.filter(
      (g) => g.status === 'ativa' && g.data_expiracao < hoje
    );

    if (expiradas.length > 0) {
      await Promise.all(
        expiradas.map((g) =>
          supabase.from('garantias').update({ status: 'expirada' }).eq('id', g.id)
        )
      );
      // Atualizar localmente
      list.forEach((g) => {
        if (g.status === 'ativa' && g.data_expiracao < hoje) {
          g.status = 'expirada';
        }
      });
    }

    setGarantias(list);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGarantias(); }, [fetchGarantias]);

  function openAcionar(g: Garantia) {
    setSelectedGarantia(g);
    setMotivo('');
    setAcionarModal(true);
  }

  async function handleAcionar() {
    if (!selectedGarantia || !motivo.trim()) return;
    setSaving(true);

    await supabase
      .from('garantias')
      .update({
        status: 'acionada',
        motivo_acionamento: motivo.trim(),
      })
      .eq('id', selectedGarantia.id);

    setSaving(false);
    setAcionarModal(false);
    setSelectedGarantia(null);
    fetchGarantias();
  }

  const fmtDate = (d: string) => {
    if (!d) return '-';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const diasRestantes = (dataExp: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const exp = new Date(dataExp + 'T00:00:00');
    const diff = Math.ceil((exp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const filtered = garantias.filter((g) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      g.produto_descricao.toLowerCase().includes(q) ||
      (g.clientes?.nome || '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || g.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Controle de Garantias</h1>
          <p className="text-sm text-slate-500 mt-1">Acompanhe as garantias dos produtos vendidos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente ou produto..."
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
          <option value="ativa">Ativa</option>
          <option value="expirada">Expirada</option>
          <option value="acionada">Acionada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['ativa', 'expirada', 'acionada', 'cancelada'] as GarantiaStatus[]).map((st) => {
          const count = garantias.filter((g) => g.status === st).length;
          const Icon = statusIcons[st];
          return (
            <button
              key={st}
              onClick={() => setFilterStatus(filterStatus === st ? '' : st)}
              className={`bg-white rounded-xl shadow-sm border p-4 text-left transition-colors ${
                filterStatus === st ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={statusColors[st].split(' ')[1]} />
                <span className="text-xs font-medium text-slate-500 uppercase">{statusLabels[st]}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-400">
            {search || filterStatus ? 'Nenhuma garantia encontrada com os filtros aplicados.' : 'Nenhuma garantia registrada.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pedido</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Venda</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expira</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dias Rest.</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 20, page * 20).map((g) => {
                  const dias = diasRestantes(g.data_expiracao);
                  const Icon = statusIcons[g.status];
                  return (
                    <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={g.produto_descricao}>
                        {g.produto_descricao}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{g.clientes?.nome || '-'}</td>
                      <td className="px-6 py-3 text-center text-slate-600">
                        #{g.pedidos?.numero || '-'}
                      </td>
                      <td className="px-6 py-3 text-center text-slate-600">{fmtDate(g.data_venda)}</td>
                      <td className="px-6 py-3 text-center text-slate-600">{fmtDate(g.data_expiracao)}</td>
                      <td className="px-6 py-3 text-center">
                        {g.status === 'ativa' ? (
                          <span className={`font-medium ${dias <= 7 ? 'text-red-600' : dias <= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                            {dias}d
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[g.status]}`}>
                          <Icon size={12} />
                          {statusLabels[g.status]}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        {g.status === 'ativa' && can('edit_pedidos') && (
                          <Button size="sm" variant="secondary" onClick={() => openAcionar(g)}>
                            <AlertTriangle size={14} />
                            Acionar
                          </Button>
                        )}
                        {g.status === 'acionada' && g.motivo_acionamento && (
                          <span className="text-xs text-slate-500 italic max-w-[150px] truncate block" title={g.motivo_acionamento}>
                            {g.motivo_acionamento}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / 20))} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Modal de Acionamento */}
      <Modal open={acionarModal} onClose={() => setAcionarModal(false)} title="Acionar Garantia">
        {selectedGarantia && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <p className="text-sm"><strong>Produto:</strong> {selectedGarantia.produto_descricao}</p>
              <p className="text-sm"><strong>Cliente:</strong> {selectedGarantia.clientes?.nome || '-'}</p>
              <p className="text-sm"><strong>Pedido:</strong> #{selectedGarantia.pedidos?.numero || '-'}</p>
              <p className="text-sm">
                <strong>Validade:</strong> {fmtDate(selectedGarantia.data_venda)} a {fmtDate(selectedGarantia.data_expiracao)}
              </p>
            </div>

            <Textarea
              label="Motivo do acionamento *"
              placeholder="Descreva o defeito ou problema relatado pelo cliente..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
              maxLength={500}
            />

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                loading={saving}
                disabled={!motivo.trim()}
                onClick={handleAcionar}
                className="flex-1"
              >
                Confirmar Acionamento
              </Button>
              <Button variant="secondary" onClick={() => setAcionarModal(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
