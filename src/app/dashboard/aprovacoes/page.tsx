'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import type { Orcamento } from '@/types/database.types';
import { createPedidoFromOrcamento, updateOrcamentoStatus } from '@/lib/supabase/queries';
import { usePermissions } from '@/components/PermissionsProvider';

export default function AprovacoesPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Orcamento | null>(null);
  const [obs, setObs] = useState('');
  const [acting, setActing] = useState(false);

  const supabase = createClient();
  const { can } = usePermissions();

  useEffect(() => {
    fetchData();
    // Realtime subscription
    const channel = supabase
      .channel('aprovacoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from('orcamentos')
      .select('*, clientes(nome, cpf_cnpj), usuarios(nome), orcamento_itens(*)')
      .eq('status', 'aguardando_aprovacao')
      .order('updated_at', { ascending: true });
    setOrcamentos(data as Orcamento[] || []);
    setLoading(false);
  }

  async function handleAprovar() {
    if (!selected) return;
    setActing(true);
    await updateOrcamentoStatus(selected.id, 'aprovado', obs || undefined);
    await createPedidoFromOrcamento(selected.id);
    setSelected(null);
    setObs('');
    setActing(false);
    fetchData();
  }

  async function handleRejeitar() {
    if (!selected) return;
    if (!obs.trim()) {
      alert('Informe a justificativa da rejeição.');
      return;
    }
    setActing(true);
    await updateOrcamentoStatus(selected.id, 'cancelado', obs);
    setSelected(null);
    setObs('');
    setActing(false);
    fetchData();
  }

  const canAccess = can('approve_orcamentos');

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <XCircle size={40} className="mb-3" />
        <p className="text-lg font-medium">Acesso Restrito</p>
        <p className="text-sm">Apenas gestores e administradores têm acesso a esta área.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fila de Aprovação</h1>
        <p className="text-slate-500 text-sm">
          {orcamentos.length === 0 ? 'Nenhum orçamento aguardando aprovação' : `${orcamentos.length} orçamento(s) aguardando decisão`}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Carregando fila...</div>
      ) : orcamentos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col items-center py-20 text-slate-400">
          <CheckCircle size={48} className="mb-3 text-green-400" />
          <p className="text-lg font-medium text-slate-600">Fila limpa!</p>
          <p className="text-sm">Todos os orçamentos foram processados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orcamentos.map((orc) => (
            <div key={orc.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Clock size={11} /> Aguardando
                    </span>
                    <h3 className="font-bold text-slate-900">Orçamento #{orc.numero}</h3>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Cliente: <strong>{orc.clientes?.nome}</strong> · Vendedor: {orc.usuarios?.nome}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(orc.updated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {Number(orc.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  {orc.validade && (
                    <p className="text-xs text-slate-400">
                      Válido até {new Date(orc.validade).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>

              {/* Itens */}
              <div className="px-6 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase">
                      <th className="text-left py-1">Item</th>
                      <th className="text-right py-1">Qtd</th>
                      <th className="text-right py-1">Preço Un.</th>
                      <th className="text-right py-1">Desc</th>
                      <th className="text-right py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orc.orcamento_itens || []).map((item) => (
                      <tr key={item.id} className="border-t border-slate-50">
                        <td className="py-1.5 text-slate-700">{item.descricao}</td>
                        <td className="py-1.5 text-right text-slate-600">{item.quantidade}</td>
                        <td className="py-1.5 text-right text-slate-600">
                          {Number(item.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-1.5 text-right text-slate-400">{item.desconto}%</td>
                        <td className="py-1.5 text-right font-medium text-slate-800">
                          {Number(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {orc.observacoes && (
                <div className="px-6 py-2 bg-slate-50 text-sm text-slate-500">
                  <strong>Obs:</strong> {orc.observacoes}
                </div>
              )}

              <div className="px-6 py-4 flex items-center gap-3 bg-slate-50 border-t border-slate-100">
                <Button onClick={() => { setSelected(orc); setObs(''); }} variant="primary" size="sm">
                  <DollarSign size={14} /> Tomar Decisão
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Decisão — Orçamento #${selected?.numero}`}>
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">
            Cliente: <strong>{selected?.clientes?.nome}</strong> · Total:{' '}
            <strong>{Number(selected?.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          </p>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Observações / Justificativa de rejeição
            </label>
            <textarea
              rows={3}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Opcional para aprovação. Obrigatório para rejeição."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleAprovar} loading={acting} variant="success" className="flex-1">
              <CheckCircle size={16} /> Aprovar e Gerar Pedido
            </Button>
            <Button onClick={handleRejeitar} loading={acting} variant="danger" className="flex-1">
              <XCircle size={16} /> Rejeitar
            </Button>
          </div>
          <Button variant="secondary" onClick={() => setSelected(null)} className="w-full">Cancelar</Button>
        </div>
      </Modal>
    </div>
  );
}
