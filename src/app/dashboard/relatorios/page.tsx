'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { DollarSign, ShoppingCart, TrendingUp, Users, Search } from 'lucide-react';
import type { Pedido } from '@/types/database.types';

interface KpiData {
  faturamento: number;
  volume: number;
  ticketMedio: number;
  clientesAtendidos: number;
}

interface ClienteRanking { nome: string; total: number; }
interface ProdutoRanking { descricao: string; quantidade: number; total: number; }

export default function RelatoriosPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [dataInicio, setDataInicio] = useState(firstDay);
  const [dataFim, setDataFim] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientesRank, setClientesRank] = useState<ClienteRanking[]>([]);
  const [produtosRank, setProdutosRank] = useState<ProdutoRanking[]>([]);

  const supabase = createClient();

  async function fetchRelatorio() {
    setLoading(true);
    const { data } = await supabase
      .from('pedidos')
      .select('*, clientes(nome), pedido_itens(*)')
      .eq('status', 'faturado')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim + 'T23:59:59')
      .order('created_at', { ascending: false });

    const raw = data as Pedido[] || [];
    setPedidos(raw);

    const faturamento = raw.reduce((s, p) => s + Number(p.total), 0);
    const volume = raw.length;
    const clienteSet = new Set(raw.map((p) => p.cliente_id));

    setKpis({
      faturamento,
      volume,
      ticketMedio: volume > 0 ? faturamento / volume : 0,
      clientesAtendidos: clienteSet.size,
    });

    // Ranking de clientes
    const cliMap: Record<string, { nome: string; total: number }> = {};
    raw.forEach((p) => {
      const id = p.cliente_id;
      if (!cliMap[id]) cliMap[id] = { nome: p.clientes?.nome || 'Desconhecido', total: 0 };
      cliMap[id].total += Number(p.total);
    });
    setClientesRank(Object.values(cliMap).sort((a, b) => b.total - a.total).slice(0, 10));

    // Ranking de produtos
    const prodMap: Record<string, { descricao: string; quantidade: number; total: number }> = {};
    raw.forEach((p) => {
      (p.pedido_itens || []).forEach((item) => {
        const key = item.descricao;
        if (!prodMap[key]) prodMap[key] = { descricao: item.descricao, quantidade: 0, total: 0 };
        prodMap[key].quantidade += Number(item.quantidade);
        prodMap[key].total += Number(item.total);
      });
    });
    setProdutosRank(Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 10));

    setLoading(false);
  }

  const maxCli = clientesRank[0]?.total || 1;
  const maxProd = produtosRank[0]?.total || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios & BI</h1>
        <p className="text-slate-500 text-sm">Análise de faturamento e performance de vendas</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-6 py-4">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Data Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Data Fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <Button onClick={fetchRelatorio} loading={loading}>
            <Search size={16} /> Gerar Relatório
          </Button>
        </div>
      </div>

      {kpis && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Faturamento Bruto', value: kpis.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: DollarSign, color: 'bg-green-500' },
              { label: 'Volume de Vendas', value: `${kpis.volume} pedidos`, icon: ShoppingCart, color: 'bg-blue-500' },
              { label: 'Ticket Médio', value: kpis.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: TrendingUp, color: 'bg-purple-500' },
              { label: 'Clientes Atendidos', value: String(kpis.clientesAtendidos), icon: Users, color: 'bg-orange-500' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500">{k.label}</p>
                  <div className={`w-9 h-9 rounded-lg ${k.color} flex items-center justify-center`}>
                    <k.icon size={16} className="text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Top Clientes */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Top 10 Clientes</h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                {clientesRank.map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">{i + 1}.</span>
                        <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        {c.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(c.total / maxCli) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {clientesRank.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Nenhum dado no período</p>}
              </div>
            </div>

            {/* Top Produtos */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Top 10 Produtos (por faturamento)</h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                {produtosRank.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">{i + 1}.</span>
                        <span className="text-sm font-medium text-slate-800 truncate max-w-52">{p.descricao}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs text-slate-400">{p.quantidade}x · </span>
                        <span className="text-sm font-bold text-slate-900">
                          {p.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${(p.total / maxProd) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {produtosRank.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Nenhum dado no período</p>}
              </div>
            </div>
          </div>

          {/* Tabela de pedidos */}
          {pedidos.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Pedidos Faturados no Período ({pedidos.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['#', 'Cliente', 'Data', 'Total'].map((h) => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-6 py-3 font-mono text-slate-500">#{p.numero}</td>
                        <td className="px-6 py-3 font-medium">{p.clientes?.nome}</td>
                        <td className="px-6 py-3 text-slate-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-3 font-bold">{Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!kpis && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <TrendingUp size={48} className="mb-3" />
          <p>Selecione o período e clique em "Gerar Relatório"</p>
        </div>
      )}
    </div>
  );
}
