import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DollarSign, ShoppingCart, Users, AlertTriangle, TrendingUp, Package, CreditCard, CalendarClock, BarChart3 } from 'lucide-react';
import type { Produto, Pedido } from '@/types/database.types';
import { DEMO_MODE } from '@/lib/demo';
import { resolveRoles, buildPermissionMap, canWith, resolveHomeRoute, DEFAULT_ROLE_PERMISSIONS, type RolePermissionMap } from '@/lib/permissions';
import Link from 'next/link';

function KpiCard({ title, value, subtitle, icon: Icon, color, href }: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; color: string; href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-100 h-full ${href ? 'hover:shadow-md hover:border-blue-200 transition-all cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const statusLabel: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em Andamento', faturado: 'Faturado', cancelado: 'Cancelado',
};
const statusColor: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700', em_andamento: 'bg-yellow-100 text-yellow-700',
  faturado: 'bg-green-100 text-green-700', cancelado: 'bg-red-100 text-red-700',
};

function MiniBar({ data, color = 'bg-blue-500' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
            <div className={`w-full ${color} rounded-t-sm transition-all`} style={{ height: `${Math.max(2, (d.value / max) * 80)}px` }} />
          </div>
          <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardUI({
  totalMes, pedidosAbertos, clientesAtivos, alertas, pedidos, crediario,
  faturamentoDiario, topProdutos, mesAnterior,
}: {
  totalMes: number;
  pedidosAbertos: number;
  clientesAtivos: number;
  alertas: Produto[];
  pedidos: Pedido[];
  crediario: { venceHoje: number; inadimplentes: number; totalAtraso: number };
  faturamentoDiario: { label: string; value: number }[];
  topProdutos: { nome: string; total: number; qtd: number }[];
  mesAnterior: number;
}) {
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const variacao = mesAnterior > 0 ? ((totalMes - mesAnterior) / mesAnterior) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm capitalize">Visão geral do negócio — {mes}</p>
      </div>

      {DEMO_MODE && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <Package size={18} className="shrink-0" />
          <span>
            <strong>Modo Demo ativo.</strong> Os dados são fictícios. Configure o Supabase no{' '}
            <code className="bg-amber-100 px-1 rounded">.env.local</code> para usar dados reais.
          </span>
        </div>
      )}

      {/* Alertas de crediário (cobrança do dia) */}
      {(crediario.venceHoje > 0 || crediario.inadimplentes > 0 || crediario.totalAtraso > 0) && (
        <Link href="/dashboard/crediario" className="flex items-center gap-4 p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800 text-sm hover:bg-orange-100 transition-colors flex-wrap">
          <span className="flex items-center gap-2 font-semibold"><CreditCard size={18} className="shrink-0" /> Crediário hoje:</span>
          <span className="flex items-center gap-1.5"><CalendarClock size={15} /> {crediario.venceHoje} parcela(s) vencem hoje</span>
          <span className="flex items-center gap-1.5"><AlertTriangle size={15} /> {crediario.inadimplentes} inadimplente(s)</span>
          <span className="flex items-center gap-1.5"><DollarSign size={15} /> {crediario.totalAtraso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em atraso</span>
          <span className="ml-auto font-medium underline">abrir crediário →</span>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Faturamento do Mês"
          value={totalMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          subtitle="Ver relatórios →"
          icon={DollarSign}
          color="bg-green-500"
          href="/dashboard/relatorios"
        />
        <KpiCard
          title="Pedidos em Aberto"
          value={String(pedidosAbertos)}
          subtitle="Ver pedidos →"
          icon={ShoppingCart}
          color="bg-blue-500"
          href="/dashboard/pedidos?status=aberto"
        />
        <KpiCard
          title="Clientes Ativos"
          value={String(clientesAtivos)}
          subtitle="Ver clientes →"
          icon={Users}
          color="bg-purple-500"
          href="/dashboard/clientes"
        />
        <KpiCard
          title="Alertas de Estoque"
          value={String(alertas.length)}
          subtitle="Ver produtos em falta →"
          icon={AlertTriangle}
          color={alertas.length > 0 ? 'bg-red-500' : 'bg-slate-400'}
          href="/dashboard/produtos?estoque=baixo"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faturamento últimos 7 dias */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500" />
              Faturamento (últimos 7 dias)
            </h2>
            {variacao !== 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${variacao > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}% vs mês anterior
              </span>
            )}
          </div>
          {faturamentoDiario.length > 0 ? (
            <MiniBar data={faturamentoDiario} color="bg-blue-500" />
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Sem dados no período</p>
          )}
        </div>

        {/* Top 5 produtos vendidos no mês */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-500" />
            Top Produtos (mês)
          </h2>
          {topProdutos.length > 0 ? (
            <div className="space-y-3">
              {topProdutos.map((p, i) => {
                const maxVal = topProdutos[0]?.total || 1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-700 truncate flex-1">{i + 1}. {p.nome}</span>
                      <span className="text-slate-500 shrink-0 ml-2">{p.qtd}un · {Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(p.total / maxVal) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">Nenhuma venda neste mês</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pedidos recentes */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              Pedidos Recentes
            </h2>
            <Link href="/dashboard/pedidos" className="text-xs text-blue-600 hover:underline">
              Ver todos
            </Link>
          </div>
          {pedidos.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum pedido registrado ainda</p>
              <Link href="/dashboard/orcamentos" className="text-xs text-blue-500 hover:underline mt-1 block">
                Criar primeiro orçamento →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    {['#', 'Cliente', 'Status', 'Total'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-500 font-mono">#{p.numero}</td>
                      <td className="px-6 py-3 font-medium text-slate-800">{p.clientes?.nome || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status] || 'bg-slate-100 text-slate-600'}`}>
                          {statusLabel[p.status] || p.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium">
                        {Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertas de Estoque */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              Estoque Crítico
            </h2>
            {alertas.length > 0 && (
              <Link href="/dashboard/produtos" className="text-xs text-blue-600 hover:underline">
                Ver produtos
              </Link>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {alertas.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                <AlertTriangle size={28} className="mx-auto mb-2 opacity-20" />
                Todos os produtos estão com estoque adequado
              </div>
            ) : (
              alertas.slice(0, 8).map((p) => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.nome}</p>
                    <p className="text-xs text-slate-400">Mínimo: {Number(p.estoque_minimo).toFixed(0)}</p>
                  </div>
                  <span className="ml-3 px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-lg whitespace-nowrap">
                    {Number(p.estoque).toFixed(0)} un.
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  if (DEMO_MODE) {
    return <DashboardUI totalMes={0} pedidosAbertos={0} clientesAtivos={0} alertas={[]} pedidos={[]}
      crediario={{ venceHoje: 0, inadimplentes: 0, totalAtraso: 0 }}
      faturamentoDiario={[]} topProdutos={[]} mesAnterior={0} />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Quem não tem permissão para ver o dashboard cai na sua primeira tela disponível
  // (ex.: operador de caixa entra direto no Caixa Diário).
  const { data: perfil } = await supabase
    .from('usuarios').select('roles, role, empresa_id').eq('id', user.id).single();
  const roles = resolveRoles(perfil || {});
  const empresaId = (perfil as { empresa_id?: string } | null)?.empresa_id;
  let permMap: RolePermissionMap = { ...DEFAULT_ROLE_PERMISSIONS };
  if (empresaId) {
    const { data: perms } = await supabase
      .from('permissoes_papel').select('papel, permissao').eq('empresa_id', empresaId);
    if (perms && perms.length > 0) {
      permMap = buildPermissionMap(perms as { papel: string; permissao: string }[]);
    }
  }
  if (!canWith(permMap, roles, 'view_dashboard')) {
    const home = resolveHomeRoute(permMap, roles);
    if (home !== '/dashboard') redirect(home); // evita loop se nenhuma rota casar
  }

  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-CA');
  const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('en-CA');
  const seteDiasAtras = new Date(now.getTime() - 7 * 86400000).toLocaleDateString('en-CA');
  const hojeStr = now.toLocaleDateString('en-CA');

  const [faturamento, fatMesAnt, pedidosAbertos, clientesAtivos, alertasEstoque, recentePedidos, parcelasAbertas, creditoCli, fatDiario, topProdR] =
    await Promise.all([
      supabase.from('contas_receber').select('valor, valor_pago').eq('status', 'pago')
        .gte('data_pagamento', inicioMes),
      supabase.from('contas_receber').select('valor, valor_pago').eq('status', 'pago')
        .gte('data_pagamento', inicioMesAnterior).lte('data_pagamento', fimMesAnterior),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).in('status', ['aberto', 'em_andamento']),
      supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('v_produtos_abaixo_minimo').select('id, nome, estoque, estoque_minimo'),
      supabase.from('pedidos').select('*, clientes(nome)').order('created_at', { ascending: false }).limit(8),
      supabase.from('v_parcelas_cliente').select('data_vencimento, saldo, dias_atraso'),
      supabase.from('v_credito_cliente').select('status_efetivo'),
      supabase.from('contas_receber').select('data_pagamento, valor_pago').eq('status', 'pago')
        .gte('data_pagamento', seteDiasAtras),
      supabase.from('pedidos').select('pedido_itens(descricao, quantidade, total)')
        .eq('status', 'faturado').gte('created_at', inicioMes),
    ]);

  const totalMes = (faturamento.data || []).reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0);
  const mesAnterior = (fatMesAnt.data || []).reduce((s, p) => s + Number(p.valor_pago ?? p.valor), 0);

  // Faturamento diário (últimos 7 dias)
  const diaMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toLocaleDateString('en-CA');
    diaMap[d] = 0;
  }
  (fatDiario.data || []).forEach((r: { data_pagamento: string; valor_pago: number }) => {
    const d = String(r.data_pagamento).slice(0, 10);
    if (diaMap[d] !== undefined) diaMap[d] += Number(r.valor_pago || 0);
  });
  const faturamentoDiario = Object.entries(diaMap).map(([d, v]) => ({
    label: d.slice(8, 10) + '/' + d.slice(5, 7), value: v,
  }));

  // Top 5 produtos vendidos no mês
  const prodMap: Record<string, { nome: string; total: number; qtd: number }> = {};
  type PedWithItems = { pedido_itens?: { descricao: string; quantidade: number; total: number }[] };
  ((topProdR.data || []) as PedWithItems[]).forEach((p) => {
    (p.pedido_itens || []).forEach((it) => {
      if (!prodMap[it.descricao]) prodMap[it.descricao] = { nome: it.descricao, total: 0, qtd: 0 };
      prodMap[it.descricao].total += Number(it.total);
      prodMap[it.descricao].qtd += Number(it.quantidade);
    });
  });
  const topProdutos = Object.values(prodMap).sort((a, b) => b.total - a.total).slice(0, 5);

  const parcelas = (parcelasAbertas.data as { data_vencimento: string; saldo: number; dias_atraso: number }[]) || [];
  const crediario = {
    venceHoje: parcelas.filter((p) => p.data_vencimento === hojeStr).length,
    totalAtraso: parcelas.filter((p) => p.dias_atraso > 0).reduce((s, p) => s + Number(p.saldo), 0),
    inadimplentes: ((creditoCli.data as { status_efetivo: string }[]) || []).filter((c) => c.status_efetivo === 'inadimplente').length,
  };

  return (
    <DashboardUI
      totalMes={totalMes}
      pedidosAbertos={pedidosAbertos.count || 0}
      clientesAtivos={clientesAtivos.count || 0}
      alertas={alertasEstoque.data as Produto[] || []}
      pedidos={recentePedidos.data as Pedido[] || []}
      crediario={crediario}
      faturamentoDiario={faturamentoDiario}
      topProdutos={topProdutos}
      mesAnterior={mesAnterior}
    />
  );
}
