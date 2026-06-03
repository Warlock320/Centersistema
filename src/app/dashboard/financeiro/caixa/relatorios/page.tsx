'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { usePermissions } from '@/components/PermissionsProvider';
import {
  FileBarChart, Printer, ArrowDownCircle, ArrowUpCircle, RotateCcw, Search,
} from 'lucide-react';
import type { Caixa, MovimentoCaixa, ReaberturaCaixa, MovimentoCategoria } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

type CaixaRel = Caixa & { usuarios?: { nome: string } };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-green-100 text-green-700' },
  em_conferencia: { label: 'Em Conferência', cls: 'bg-amber-100 text-amber-700' },
  encerrado: { label: 'Encerrado', cls: 'bg-slate-200 text-slate-600' },
};
const CAT_LABEL: Record<MovimentoCategoria, string> = {
  abertura: 'Abertura', recebimento: 'Recebimento', sangria: 'Sangria', suprimento: 'Suprimento',
};
const FORMA_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferência',
};

export default function RelatorioCaixaPage() {
  const { can } = usePermissions();
  const [caixas, setCaixas] = useState<CaixaRel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const hoje = new Date();
  const ini30 = new Date(); ini30.setDate(ini30.getDate() - 30);
  const [de, setDe] = useState(ini30.toISOString().split('T')[0]);
  const [ate, setAte] = useState(hoje.toISOString().split('T')[0]);

  // Detalhe
  const [sel, setSel] = useState<CaixaRel | null>(null);
  const [movs, setMovs] = useState<MovimentoCaixa[]>([]);
  const [reaberturas, setReaberturas] = useState<ReaberturaCaixa[]>([]);
  const [loadingDet, setLoadingDet] = useState(false);

  const supabase = createClient();

  useEffect(() => { fetchCaixas(); }, [de, ate]);

  async function fetchCaixas() {
    setLoading(true);
    const { data } = await supabase
      .from('caixas')
      .select('*, usuarios:usuarios!caixas_usuario_id_fkey(nome)')
      .gte('aberto_em', de)
      .lte('aberto_em', ate + 'T23:59:59')
      .order('aberto_em', { ascending: false });
    setCaixas((data as CaixaRel[]) || []);
    setLoading(false);
  }

  async function abrirDetalhe(c: CaixaRel) {
    setSel(c); setMovs([]); setReaberturas([]); setLoadingDet(true);
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from('movimentos_caixa').select('*, clientes(nome), usuarios:usuarios!movimentos_caixa_usuario_id_fkey(nome)').eq('caixa_id', c.id).order('created_at'),
      supabase.from('reaberturas_caixa').select('*').eq('caixa_id', c.id).order('created_at'),
    ]);
    setMovs((m as MovimentoCaixa[]) || []);
    setReaberturas((r as ReaberturaCaixa[]) || []);
    setLoadingDet(false);
  }

  if (!can('view_financeiro') && !can('gerir_caixa')) {
    return <div className="py-16 text-center text-slate-400">Sem permissão para ver relatórios de caixa.</div>;
  }

  const q = busca.toLowerCase();
  const filtrados = caixas.filter((c) => !q || (c.usuarios?.nome || '').toLowerCase().includes(q));

  // Totais do detalhe (ignora cancelados)
  const ativos = movs.filter((m) => !m.cancelado);
  const totForma: Record<string, number> = {};
  ativos.filter((m) => m.categoria === 'recebimento').forEach((m) => {
    const k = m.forma_pagamento || 'dinheiro'; totForma[k] = (totForma[k] || 0) + Number(m.valor);
  });
  const totReceb = ativos.filter((m) => m.categoria === 'recebimento').reduce((s, m) => s + Number(m.valor), 0);
  const totSupr = ativos.filter((m) => m.categoria === 'suprimento').reduce((s, m) => s + Number(m.valor), 0);
  const totSang = ativos.filter((m) => m.categoria === 'sangria').reduce((s, m) => s + Number(m.valor), 0);
  const difConf = sel ? Number(sel.saldo_informado || 0) - Number(sel.saldo_calculado || 0) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><FileBarChart size={22} /> Relatórios de Caixa</h1>
        <p className="text-slate-500 text-sm">Consulte os caixas de datas anteriores, lançamento a lançamento.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-44">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por operador..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-1 text-sm">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="px-2 py-2 border border-slate-200 rounded-lg" />
          <span className="text-slate-400">até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="px-2 py-2 border border-slate-200 rounded-lg" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Abertura', 'Encerramento', 'Operador', 'Status', 'Esperado', 'Conferido', 'Diferença', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const dif = Number(c.saldo_informado || 0) - Number(c.saldo_calculado || 0);
                return (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => abrirDetalhe(c)}>
                    <td className="px-5 py-3 text-slate-600">{new Date(c.aberto_em).toLocaleString('pt-BR')}</td>
                    <td className="px-5 py-3 text-slate-500">{c.encerrado_em ? new Date(c.encerrado_em).toLocaleString('pt-BR') : '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{c.usuarios?.nome || '—'}</td>
                    <td className="px-5 py-3"><span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[c.status]?.cls}`}>{STATUS_META[c.status]?.label}</span></td>
                    <td className="px-5 py-3">{formatBRL(Number(c.saldo_calculado || 0))}</td>
                    <td className="px-5 py-3">{formatBRL(Number(c.saldo_informado || 0))}</td>
                    <td className={`px-5 py-3 font-medium ${dif === 0 ? 'text-green-600' : 'text-red-600'}`}>{c.status === 'aberto' ? '—' : dif === 0 ? 'OK' : formatBRL(dif)}</td>
                    <td className="px-5 py-3 text-blue-600 text-xs">ver detalhe →</td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-slate-400">Nenhum caixa no período.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalhe do caixa */}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Detalhe do Caixa" size="lg">
        {sel && (
          <div className="space-y-4" id="rel-caixa-det">
            {/* Cabeçalho */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Operador</p><p className="font-medium">{sel.usuarios?.nome || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Abertura</p><p className="font-medium">{new Date(sel.aberto_em).toLocaleString('pt-BR')}</p></div>
              <div><p className="text-xs text-slate-400">Encerramento</p><p className="font-medium">{sel.encerrado_em ? new Date(sel.encerrado_em).toLocaleString('pt-BR') : '—'}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><p className="font-medium">{STATUS_META[sel.status]?.label}</p></div>
            </div>

            {loadingDet ? (
              <div className="py-8 text-center text-slate-400">Carregando lançamentos...</div>
            ) : (
              <>
                {/* Totais */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Saldo inicial</p><p className="font-bold">{formatBRL(Number(sel.saldo_inicial || 0))}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Recebimentos</p><p className="font-bold text-green-600">{formatBRL(totReceb)}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Suprimentos</p><p className="font-bold text-green-600">{formatBRL(totSupr)}</p></div>
                  <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-400">Sangrias</p><p className="font-bold text-red-600">{formatBRL(totSang)}</p></div>
                </div>

                {/* Por forma */}
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Recebimentos por forma</p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {Object.keys(totForma).length === 0 ? <span className="text-slate-400">—</span> :
                      Object.entries(totForma).map(([f, v]) => (
                        <span key={f} className="px-2.5 py-1 bg-slate-100 rounded-lg">{FORMA_LABEL[f] || f}: <strong>{formatBRL(v)}</strong></span>
                      ))}
                  </div>
                </div>

                {/* Conferência */}
                {sel.status !== 'aberto' && (
                  <div className="grid grid-cols-3 gap-3 text-center bg-slate-50 rounded-lg p-3 text-sm">
                    <div><p className="text-xs text-slate-500">Esperado</p><p className="font-bold">{formatBRL(Number(sel.saldo_calculado || 0))}</p></div>
                    <div><p className="text-xs text-slate-500">Conferido</p><p className="font-bold">{formatBRL(Number(sel.saldo_informado || 0))}</p></div>
                    <div><p className="text-xs text-slate-500">Diferença</p><p className={`font-bold ${difConf === 0 ? 'text-green-600' : 'text-red-600'}`}>{difConf === 0 ? 'OK' : formatBRL(difConf)}</p></div>
                  </div>
                )}

                {/* Lançamentos (ente a ente) */}
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Lançamentos ({movs.length})</p>
                  <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 max-h-72 overflow-y-auto">
                    {movs.map((m) => (
                      <div key={m.id} className={`px-3 py-2 flex items-center justify-between text-sm ${m.cancelado ? 'opacity-60' : ''}`}>
                        <div className="flex items-center gap-2">
                          {m.tipo === 'entrada' ? <ArrowDownCircle size={14} className="text-green-500" /> : <ArrowUpCircle size={14} className="text-red-500" />}
                          <div>
                            <p className={`text-slate-700 ${m.cancelado ? 'line-through' : ''}`}>
                              {CAT_LABEL[m.categoria]}
                              {m.categoria === 'recebimento' && ` · ${FORMA_LABEL[m.forma_pagamento || ''] || m.forma_pagamento}`}
                              {m.clientes?.nome && ` · ${m.clientes.nome}`}
                            </p>
                            <p className="text-xs text-slate-400">
                              {m.descricao ? `${m.descricao} · ` : ''}{m.usuarios?.nome ? `${m.usuarios.nome} · ` : ''}
                              {new Date(m.created_at).toLocaleString('pt-BR')}
                              {m.cancelado && m.motivo_cancelamento && <span className="text-red-500"> · cancelado: {m.motivo_cancelamento}</span>}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold ${m.cancelado ? 'text-slate-400 line-through' : m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {m.tipo === 'entrada' ? '+' : '−'} {formatBRL(Number(m.valor))}
                        </span>
                      </div>
                    ))}
                    {movs.length === 0 && <p className="px-3 py-6 text-center text-slate-400 text-sm">Sem lançamentos.</p>}
                  </div>
                </div>

                {/* Reaberturas */}
                {reaberturas.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-2 flex items-center gap-1"><RotateCcw size={12} /> Reaberturas</p>
                    <div className="space-y-1 text-sm">
                      {reaberturas.map((r) => (
                        <div key={r.id} className="flex justify-between"><span className="text-slate-600">{r.motivo}</span><span className="text-slate-400 text-xs">{new Date(r.created_at).toLocaleString('pt-BR')}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="button" onClick={() => window.print()} className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"><Printer size={14} /> Imprimir</button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
