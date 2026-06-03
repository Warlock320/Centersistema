'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import {
  DollarSign, ShoppingCart, TrendingUp, Users, Search, Printer, ArrowDownCircle,
  ArrowUpCircle, Scale, CreditCard, AlertTriangle, UserPlus, PackageX, Wallet,
} from 'lucide-react';

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function pct(v: number) { return `${v.toFixed(1)}%`; }

// ── Tipos das consultas ──
interface CR { valor: number; valor_pago: number | null; status: string; data_pagamento: string | null; data_emissao: string; forma_pagamento: string | null; cliente_id: string | null; clientes?: { nome: string } }
interface CP { valor: number; valor_pago: number | null; status: string; data_pagamento: string | null }
interface PedItem { descricao: string; quantidade: number; total: number }
interface Ped { id: string; numero: number; total: number; created_at: string; cliente_id: string; clientes?: { nome: string }; pedido_itens?: PedItem[] }
interface Cred { limite_credito: number; limite_utilizado: number; valor_vencido: number; status_efetivo: string; score_pontos: number }
interface Parc { saldo: number; faixa_atraso: string }

const FORMA_COR: Record<string, string> = {
  dinheiro: '#22c55e', pix: '#14b8a6', debito: '#3b82f6', credito_vista: '#8b5cf6',
  credito: '#8b5cf6', credito_parcelado: '#6366f1', transferencia: '#64748b', boleto: '#f59e0b', outro: '#94a3b8',
};
const FORMA_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito_vista: 'Crédito à vista',
  credito: 'Crédito', credito_parcelado: 'Crédito parcelado', transferencia: 'Transferência', boleto: 'Boleto', outro: 'Outro',
};
const FAIXA_LABEL: Record<string, string> = { '1_30': '1–30 dias', '31_60': '31–60', '61_90': '61–90', '90_mais': '90+' };

export default function RelatoriosPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(firstDay);
  const [dataFim, setDataFim] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [carregou, setCarregou] = useState(false);

  // Resultados
  const [kpis, setKpis] = useState({
    recebido: 0, despesas: 0, resultado: 0, faturado: 0, aReceber: 0, aPagar: 0,
    volume: 0, ticket: 0, clientes: 0, novosClientes: 0, estoqueBaixo: 0,
  });
  const [serie, setSerie] = useState<{ label: string; receita: number; despesa: number }[]>([]);
  const [formas, setFormas] = useState<{ forma: string; total: number }[]>([]);
  const [clientesRank, setClientesRank] = useState<{ nome: string; total: number }[]>([]);
  const [produtosRank, setProdutosRank] = useState<{ descricao: string; quantidade: number; total: number }[]>([]);
  const [credito, setCredito] = useState({ concedido: 0, utilizado: 0, vencido: 0, inadimplentes: 0, scoreMedio: 0, clientes: 0 });
  const [aging, setAging] = useState<Record<string, number>>({});
  const [pedidos, setPedidos] = useState<Ped[]>([]);

  const supabase = createClient();

  const fetchRelatorio = useCallback(async () => {
    setLoading(true);
    const ini = dataInicio;
    const fim = dataFim + 'T23:59:59';
    const fimDay = dataFim;

    const [crR, cpR, pedR, credR, parcR, novosR, estoqueR] = await Promise.all([
      supabase.from('contas_receber').select('valor, valor_pago, status, data_pagamento, data_emissao, forma_pagamento, cliente_id, clientes(nome)'),
      supabase.from('contas_pagar').select('valor, valor_pago, status, data_pagamento'),
      supabase.from('pedidos').select('*, clientes(nome), pedido_itens(*)').eq('status', 'faturado').gte('created_at', ini).lte('created_at', fim).order('created_at', { ascending: false }),
      supabase.from('v_credito_cliente').select('limite_credito, limite_utilizado, valor_vencido, status_efetivo, score_pontos'),
      supabase.from('v_parcelas_cliente').select('saldo, faixa_atraso'),
      supabase.from('clientes').select('id', { count: 'exact', head: true }).gte('created_at', ini).lte('created_at', fim),
      supabase.from('v_produtos_abaixo_minimo').select('id', { count: 'exact', head: true }),
    ]);

    const cr = (crR.data as unknown as CR[]) || [];
    const cp = (cpR.data as unknown as CP[]) || [];
    const peds = (pedR.data as unknown as Ped[]) || [];
    const cred = (credR.data as unknown as Cred[]) || [];
    const parc = (parcR.data as unknown as Parc[]) || [];

    const inRange = (d: string | null) => !!d && d >= ini && d <= fimDay;

    // Financeiro do período
    const recebido = cr.filter((c) => inRange(c.data_pagamento)).reduce((s, c) => s + Number(c.valor_pago || 0), 0);
    const despesas = cp.filter((c) => inRange(c.data_pagamento)).reduce((s, c) => s + Number(c.valor_pago ?? c.valor), 0);
    const faturado = cr.filter((c) => inRange(c.data_emissao)).reduce((s, c) => s + Number(c.valor), 0);
    const aReceber = cr.filter((c) => c.status === 'pendente' || c.status === 'pago_parcial').reduce((s, c) => s + (Number(c.valor) - Number(c.valor_pago || 0)), 0);
    const aPagar = cp.filter((c) => c.status === 'pendente' || c.status === 'aprovado').reduce((s, c) => s + Number(c.valor), 0);

    // Pedidos faturados → volume/ticket/rankings
    const volume = peds.length;
    const faturamentoPed = peds.reduce((s, p) => s + Number(p.total), 0);
    const clienteSet = new Set(peds.map((p) => p.cliente_id));
    const cliMap: Record<string, { nome: string; total: number }> = {};
    peds.forEach((p) => {
      if (!cliMap[p.cliente_id]) cliMap[p.cliente_id] = { nome: p.clientes?.nome || '—', total: 0 };
      cliMap[p.cliente_id].total += Number(p.total);
    });
    const prodMap: Record<string, { descricao: string; quantidade: number; total: number }> = {};
    peds.forEach((p) => (p.pedido_itens || []).forEach((it) => {
      if (!prodMap[it.descricao]) prodMap[it.descricao] = { descricao: it.descricao, quantidade: 0, total: 0 };
      prodMap[it.descricao].quantidade += Number(it.quantidade);
      prodMap[it.descricao].total += Number(it.total);
    }));

    // Recebimentos por forma (no período)
    const formaMap: Record<string, number> = {};
    cr.filter((c) => inRange(c.data_pagamento)).forEach((c) => {
      const f = c.forma_pagamento || 'outro';
      formaMap[f] = (formaMap[f] || 0) + Number(c.valor_pago || 0);
    });

    // Série temporal (diária se ≤ 62 dias, senão mensal)
    const diffDias = Math.ceil((new Date(fimDay).getTime() - new Date(ini).getTime()) / 86400000);
    const mensal = diffDias > 62;
    const chave = (d: string) => (mensal ? d.slice(0, 7) : d.slice(0, 10));
    const serieMap: Record<string, { receita: number; despesa: number }> = {};
    cr.filter((c) => inRange(c.data_pagamento)).forEach((c) => {
      const k = chave(c.data_pagamento!);
      (serieMap[k] ||= { receita: 0, despesa: 0 }).receita += Number(c.valor_pago || 0);
    });
    cp.filter((c) => inRange(c.data_pagamento)).forEach((c) => {
      const k = chave(c.data_pagamento!);
      (serieMap[k] ||= { receita: 0, despesa: 0 }).despesa += Number(c.valor_pago ?? c.valor);
    });
    const serieArr = Object.entries(serieMap).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => ({
      label: mensal ? k.split('-').reverse().join('/') : k.slice(8, 10) + '/' + k.slice(5, 7),
      receita: v.receita, despesa: v.despesa,
    }));

    // Crediário (posição atual)
    const concedido = cred.reduce((s, c) => s + Number(c.limite_credito), 0);
    const utilizado = cred.reduce((s, c) => s + Number(c.limite_utilizado), 0);
    const vencido = cred.reduce((s, c) => s + Number(c.valor_vencido), 0);
    const inadimplentes = cred.filter((c) => c.status_efetivo === 'inadimplente').length;
    const comCredito = cred.filter((c) => Number(c.limite_credito) > 0 || Number(c.limite_utilizado) > 0);
    const scoreMedio = comCredito.length ? comCredito.reduce((s, c) => s + Number(c.score_pontos), 0) / comCredito.length : 0;
    const agingMap: Record<string, number> = {};
    parc.filter((p) => p.faixa_atraso !== 'a_vencer').forEach((p) => { agingMap[p.faixa_atraso] = (agingMap[p.faixa_atraso] || 0) + Number(p.saldo); });

    setKpis({
      recebido, despesas, resultado: recebido - despesas, faturado, aReceber, aPagar,
      volume, ticket: volume ? faturamentoPed / volume : 0, clientes: clienteSet.size,
      novosClientes: novosR.count || 0, estoqueBaixo: estoqueR.count || 0,
    });
    setSerie(serieArr);
    setFormas(Object.entries(formaMap).map(([forma, total]) => ({ forma, total })).sort((a, b) => b.total - a.total));
    setClientesRank(Object.values(cliMap).sort((a, b) => b.total - a.total).slice(0, 10));
    setProdutosRank(Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 10));
    setCredito({ concedido, utilizado, vencido, inadimplentes, scoreMedio, clientes: comCredito.length });
    setAging(agingMap);
    setPedidos(peds);
    setLoading(false);
    setCarregou(true);
  }, [dataInicio, dataFim]);

  useEffect(() => { fetchRelatorio(); /* carga inicial */ }, []);

  function preset(tipo: 'hoje' | 'semana' | 'mes' | 'ano') {
    const t = new Date(); const y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
    const f = (x: Date) => x.toLocaleDateString('en-CA');
    if (tipo === 'hoje') { setDataInicio(f(t)); setDataFim(f(t)); }
    else if (tipo === 'semana') { setDataInicio(f(new Date(y, m, d - 6))); setDataFim(f(t)); }
    else if (tipo === 'mes') { setDataInicio(f(new Date(y, m, 1))); setDataFim(f(t)); }
    else { setDataInicio(f(new Date(y, 0, 1))); setDataFim(f(t)); }
  }

  const totalFormas = formas.reduce((s, f) => s + f.total, 0);
  const maxSerie = Math.max(1, ...serie.map((s) => Math.max(s.receita, s.despesa)));
  const maxCli = clientesRank[0]?.total || 1;
  const maxProd = produtosRank[0]?.total || 1;
  // Donut de formas (conic-gradient)
  let acc = 0;
  const donut = formas.map((f) => {
    const start = totalFormas ? (acc / totalFormas) * 360 : 0;
    acc += f.total;
    const end = totalFormas ? (acc / totalFormas) * 360 : 0;
    return `${FORMA_COR[f.forma] || '#94a3b8'} ${start}deg ${end}deg`;
  }).join(', ');

  const kpiCards = [
    { label: 'Recebido no período', value: brl(kpis.recebido), icon: ArrowDownCircle, color: 'bg-green-500' },
    { label: 'Despesas pagas', value: brl(kpis.despesas), icon: ArrowUpCircle, color: 'bg-red-500' },
    { label: 'Resultado', value: brl(kpis.resultado), icon: Scale, color: kpis.resultado >= 0 ? 'bg-blue-600' : 'bg-red-600' },
    { label: 'A receber (aberto)', value: brl(kpis.aReceber), icon: Wallet, color: 'bg-amber-500' },
    { label: 'A pagar (aberto)', value: brl(kpis.aPagar), icon: CreditCard, color: 'bg-orange-500' },
    { label: 'Vendas faturadas', value: `${kpis.volume}`, icon: ShoppingCart, color: 'bg-indigo-500' },
    { label: 'Ticket médio', value: brl(kpis.ticket), icon: TrendingUp, color: 'bg-purple-500' },
    { label: 'Clientes atendidos', value: `${kpis.clientes}`, icon: Users, color: 'bg-teal-500' },
    { label: 'Novos clientes', value: `${kpis.novosClientes}`, icon: UserPlus, color: 'bg-cyan-500' },
    { label: 'Produtos em falta', value: `${kpis.estoqueBaixo}`, icon: PackageX, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios &amp; BI</h1>
          <p className="text-slate-500 text-sm">Período: {new Date(dataInicio + 'T00:00:00').toLocaleDateString('pt-BR')} a {new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
        </div>
        <Button variant="secondary" onClick={() => window.print()} className="print:hidden"><Printer size={16} /> Exportar PDF</Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 sm:px-6 py-4 flex items-end gap-3 flex-wrap print:hidden">
        <div className="flex gap-1">
          {(['hoje', 'semana', 'mes', 'ano'] as const).map((p) => (
            <button key={p} type="button" onClick={() => preset(p)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 capitalize">
              {p === 'mes' ? 'mês' : p}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Início</label>
          <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Fim</label>
          <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <Button onClick={fetchRelatorio} loading={loading}><Search size={16} /> Gerar</Button>
      </div>

      {loading && !carregou ? (
        <div className="py-20 text-center text-slate-400">Carregando...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpiCards.map((k) => (
              <div key={k.label} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500">{k.label}</p>
                  <div className={`w-8 h-8 rounded-lg ${k.color} flex items-center justify-center`}><k.icon size={15} className="text-white" /></div>
                </div>
                <p className="text-lg font-bold text-slate-900">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Receita x Despesa */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Receita × Despesa</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500" /> Recebido</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400" /> Despesa</span>
              </div>
            </div>
            {serie.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Sem movimentação financeira no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-3 h-48 min-w-max px-1">
                  {serie.map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-1 justify-end" style={{ minWidth: 36 }}>
                      <div className="flex items-end gap-0.5 h-40">
                        <div className="w-3 bg-green-500 rounded-t" style={{ height: `${(s.receita / maxSerie) * 100}%` }} title={`Recebido ${brl(s.receita)}`} />
                        <div className="w-3 bg-red-400 rounded-t" style={{ height: `${(s.despesa / maxSerie) * 100}%` }} title={`Despesa ${brl(s.despesa)}`} />
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Recebimentos por forma (donut) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Recebimentos por forma</h2>
              {totalFormas === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Nenhum recebimento no período.</p>
              ) : (
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="relative w-36 h-36 rounded-full shrink-0" style={{ background: `conic-gradient(${donut})` }}>
                    <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400">Total</span>
                      <span className="text-sm font-bold text-slate-800">{brl(totalFormas)}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-40">
                    {formas.map((f) => (
                      <div key={f.forma} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span className="w-3 h-3 rounded-sm" style={{ background: FORMA_COR[f.forma] || '#94a3b8' }} />
                          {FORMA_LABEL[f.forma] || f.forma}
                        </span>
                        <span className="font-medium text-slate-800">{brl(f.total)} <span className="text-xs text-slate-400">({pct(totalFormas ? (f.total / totalFormas) * 100 : 0)})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Crediário / Inadimplência */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><CreditCard size={16} /> Crediário</h2>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><p className="text-xs text-slate-400">Limite concedido</p><p className="font-bold text-slate-800">{brl(credito.concedido)}</p></div>
                <div><p className="text-xs text-slate-400">Em uso</p><p className="font-bold text-slate-800">{brl(credito.utilizado)} <span className="text-xs text-slate-400">({pct(credito.concedido ? (credito.utilizado / credito.concedido) * 100 : 0)})</span></p></div>
                <div><p className="text-xs text-slate-400">Vencido</p><p className="font-bold text-red-600">{brl(credito.vencido)}</p></div>
                <div><p className="text-xs text-slate-400">Inadimplentes</p><p className="font-bold text-orange-600">{credito.inadimplentes} <span className="text-xs text-slate-400">de {credito.clientes}</span></p></div>
                <div><p className="text-xs text-slate-400">Score médio</p><p className="font-bold text-amber-600">{credito.scoreMedio.toFixed(0)}<span className="text-xs text-slate-400">/100</span></p></div>
              </div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-1.5">Inadimplência por faixa</p>
              <div className="space-y-1">
                {(['1_30', '31_60', '61_90', '90_mais'] as const).map((fx) => (
                  <div key={fx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{FAIXA_LABEL[fx]}</span>
                    <span className={`font-medium ${aging[fx] ? 'text-red-600' : 'text-slate-400'}`}>{brl(aging[fx] || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Top 10 Clientes</h2></div>
              <div className="px-6 py-4 space-y-3">
                {clientesRank.map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-800"><span className="text-xs font-bold text-slate-400 mr-2">{i + 1}.</span>{c.nome}</span>
                      <span className="text-sm font-bold text-slate-900">{brl(c.total)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(c.total / maxCli) * 100}%` }} /></div>
                  </div>
                ))}
                {clientesRank.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Nenhum dado no período</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Top 10 Produtos</h2></div>
              <div className="px-6 py-4 space-y-3">
                {produtosRank.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-800 truncate max-w-52"><span className="text-xs font-bold text-slate-400 mr-2">{i + 1}.</span>{p.descricao}</span>
                      <span className="text-right shrink-0 ml-2"><span className="text-xs text-slate-400">{p.quantidade}x · </span><span className="text-sm font-bold text-slate-900">{brl(p.total)}</span></span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(p.total / maxProd) * 100}%` }} /></div>
                  </div>
                ))}
                {produtosRank.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Nenhum dado no período</p>}
              </div>
            </div>
          </div>

          {/* Pedidos faturados */}
          {pedidos.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Pedidos Faturados ({pedidos.length})</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">{['#', 'Cliente', 'Data', 'Total'].map((h) => <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-400">{h}</th>)}</tr></thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono text-slate-500">#{p.numero}</td>
                        <td className="px-6 py-3 font-medium">{p.clientes?.nome}</td>
                        <td className="px-6 py-3 text-slate-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-3 font-bold">{brl(Number(p.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
