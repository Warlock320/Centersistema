import { createClient } from '@/lib/supabase/server';
import { DollarSign, ShoppingCart, Users, AlertTriangle, TrendingUp, Package } from 'lucide-react';
import type { Produto, Pedido } from '@/types/database.types';
import { DEMO_MODE } from '@/lib/demo';
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

function DashboardUI({
  totalMes, pedidosAbertos, clientesAtivos, alertas, pedidos,
}: {
  totalMes: number;
  pedidosAbertos: number;
  clientesAtivos: number;
  alertas: Produto[];
  pedidos: Pedido[];
}) {
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

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
    return <DashboardUI totalMes={0} pedidosAbertos={0} clientesAtivos={0} alertas={[]} pedidos={[]} />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [faturamento, pedidosAbertos, clientesAtivos, alertasEstoque, recentePedidos] =
    await Promise.all([
      supabase.from('pedidos').select('total').eq('status', 'faturado')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).in('status', ['aberto', 'em_andamento']),
      supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('v_produtos_abaixo_minimo').select('id, nome, estoque, estoque_minimo'),
      supabase.from('pedidos').select('*, clientes(nome)').order('created_at', { ascending: false }).limit(8),
    ]);

  const totalMes = (faturamento.data || []).reduce((s, p) => s + Number(p.total), 0);

  return (
    <DashboardUI
      totalMes={totalMes}
      pedidosAbertos={pedidosAbertos.count || 0}
      clientesAtivos={clientesAtivos.count || 0}
      alertas={alertasEstoque.data as Produto[] || []}
      pedidos={recentePedidos.data as Pedido[] || []}
    />
  );
}
