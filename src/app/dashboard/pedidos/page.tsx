'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight, XCircle, FileText, Download, CheckCircle, AlertCircle, FileDown } from 'lucide-react';
import type { Pedido, PedidoStatus, NfeEmitida } from '@/types/database.types';
import { usePermissions } from '@/components/PermissionsProvider';
import { parseNfeXml } from '@/lib/nfe/parser';
import { baixarDanfe } from '@/components/DanfePDF';

const STEPS: { status: PedidoStatus; label: string }[] = [
  { status: 'aberto', label: 'Aberto' },
  { status: 'em_andamento', label: 'Em Andamento (Separação)' },
  { status: 'faturado', label: 'Faturado' },
];


export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [acting, setActing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const [confirmSeparar, setConfirmSeparar] = useState(false);
  const [confirmFaturar, setConfirmFaturar] = useState(false);
  const [confirmFaturarSim, setConfirmFaturarSim] = useState(false);
  const [confirmCancelar, setConfirmCancelar] = useState(false);
  const [erro, setErro] = useState('');
  const [emitindoNfe, setEmitindoNfe] = useState(false);
  const [nfeMsg, setNfeMsg] = useState<{ ok: boolean; text: string } | null>(null);

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
    setNfeMsg(null);
    const { data } = await supabase.from('pedidos').select('*, clientes(*), pedido_itens(*), nfe_emitidas!pedidos_nfe_id_fkey(*)').eq('id', p.id).single();
    setSelected(data as Pedido);
  }

  async function handleStatusChange(newStatus: PedidoStatus) {
    if (!selected) return;
    setActing(true);
    setErro('');

    const { error } = await supabase.from('pedidos').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) {
      setErro('Erro ao alterar status: ' + error.message);
      setActing(false);
      return;
    }

    setActing(false);
    setSelected(null);
    fetchData();
  }

  async function handleCancelar() {
    if (!selected) return;
    setActing(true);
    setErro('');
    const { error } = await supabase.rpc('cancelar_pedido', { p_pedido_id: selected.id });
    if (error) {
      setErro('Erro ao cancelar pedido: ' + error.message);
      setActing(false);
      setConfirmCancelar(false);
      return;
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

  async function handleEmitirNfe(simulacao = false) {
    if (!selected) return;
    setEmitindoNfe(true);
    setNfeMsg(null);
    setErro('');
    try {
      const res = await fetch('/api/nfe/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: selected.id, simulacao }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const prefixo = json.simulacao ? '[SIMULAÇÃO] ' : '';
        setNfeMsg({ ok: true, text: `${prefixo}NF-e #${json.numero} autorizada! Protocolo: ${json.protocolo}` });
        openDetail(selected);
        fetchData();
      } else {
        setNfeMsg({ ok: false, text: json.error || json.motivo || 'Erro ao emitir NF-e.' });
      }
    } catch (err) {
      setNfeMsg({ ok: false, text: 'Erro de conexão: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setEmitindoNfe(false);
    }
  }

  function getNfeXml(): string {
    if (!selected?.nfe_emitidas) return '';
    const nfe = selected.nfe_emitidas as NfeEmitida;
    return nfe.xml_autorizada || nfe.xml_envio || '';
  }

  async function handleDownloadXml() {
    const xmlContent = getNfeXml();
    if (!xmlContent) { setErro('XML não disponível.'); return; }
    const nfe = selected!.nfe_emitidas as NfeEmitida;
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${nfe.chave_acesso}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadDanfe() {
    const xmlContent = getNfeXml();
    if (!xmlContent) { setErro('XML não disponível para gerar DANFE.'); return; }
    try {
      const nfeData = parseNfeXml(xmlContent);
      await baixarDanfe(nfeData);
    } catch {
      setErro('Erro ao gerar PDF do DANFE.');
    }
  }

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

            {/* NF-e — pedido faturado com nota */}
            {selected.nfe_emitidas && (
              <div className="space-y-2">
                {(() => {
                  const nfe = selected.nfe_emitidas as NfeEmitida;
                  return (
                    <div className={`flex flex-col gap-3 p-4 rounded-xl border ${
                      nfe.status === 'autorizada' ? 'bg-green-50 border-green-200'
                        : nfe.status === 'rejeitada' ? 'bg-red-50 border-red-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <FileText size={20} className={
                          nfe.status === 'autorizada' ? 'text-green-600' :
                          nfe.status === 'rejeitada' ? 'text-red-500' : 'text-slate-400'
                        } />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm">
                            NF-e #{nfe.numero} — {nfe.status.toUpperCase()}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            Chave: {nfe.chave_acesso}
                            {nfe.protocolo_autorizacao && <> · Protocolo: {nfe.protocolo_autorizacao}</>}
                          </p>
                          {nfe.motivo && <p className="text-xs text-slate-400 mt-0.5">{nfe.motivo}</p>}
                        </div>
                      </div>
                      {(nfe.xml_autorizada || nfe.xml_envio) && (
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={handleDownloadXml}>
                            <Download size={14} /> XML
                          </Button>
                          <Button variant="secondary" size="sm" onClick={handleDownloadDanfe}>
                            <FileDown size={14} /> DANFE (PDF)
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Mensagem de emissão */}
            {nfeMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
                nfeMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {nfeMsg.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {nfeMsg.text}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-2 flex-wrap pt-1">
              {selected.status === 'aberto' && (
                <Button onClick={() => setConfirmSeparar(true)}>
                  Iniciar Separação
                </Button>
              )}
              {selected.status === 'em_andamento' && !selected.nfe_emitidas && (
                <>
                  <Button variant="success" onClick={() => setConfirmFaturar(true)}>
                    <FileText size={14} /> Faturar + Emitir NF-e
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmFaturarSim(true)}>
                    Simular (sem SEFAZ)
                  </Button>
                </>
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
        open={confirmSeparar}
        title="Iniciar Separação"
        message={`Deseja alterar o status do pedido #${selected?.numero} para "Em Andamento (Separação)"?`}
        confirmLabel="Sim, iniciar separação"
        variant="primary"
        loading={acting}
        onConfirm={() => { setConfirmSeparar(false); handleStatusChange('em_andamento'); }}
        onCancel={() => setConfirmSeparar(false)}
      />

      <Confirm
        open={confirmFaturar}
        title="Faturar + Emitir NF-e"
        message={`Deseja faturar o pedido #${selected?.numero}? O XML da NF-e será gerado, assinado e enviado à SEFAZ. O estoque será baixado e uma conta a receber será criada. Essa ação não pode ser desfeita.`}
        confirmLabel="Sim, faturar e emitir NF-e"
        variant="primary"
        loading={emitindoNfe}
        onConfirm={() => { setConfirmFaturar(false); handleEmitirNfe(false); }}
        onCancel={() => setConfirmFaturar(false)}
      />

      <Confirm
        open={confirmFaturarSim}
        title="Simular Faturamento"
        message={`Deseja simular o faturamento do pedido #${selected?.numero}? O XML será gerado mas NÃO será enviado à SEFAZ. O estoque será baixado e o pedido será marcado como faturado. A nota gerada não tem valor fiscal.`}
        confirmLabel="Sim, simular"
        variant="primary"
        loading={emitindoNfe}
        onConfirm={() => { setConfirmFaturarSim(false); handleEmitirNfe(true); }}
        onCancel={() => setConfirmFaturarSim(false)}
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
