import { createClient } from '@/lib/supabase/server';
import { DEMO_MODE } from '@/lib/demo';
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle,
  ArrowDownCircle, ArrowUpCircle, Clock
} from 'lucide-react';
import Link from 'next/link';
import type { KpisFinanceiros, ContaReceber, ContaPagar } from '@/types/database.types';

function KpiCard({ title, value, sub, icon: Icon, color, href }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string; href?: string;
}) {
  const content = (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getCobrancaLabel(conta: ContaReceber) {
  const diff = Math.floor(
    (new Date().getTime() - new Date(conta.data_vencimento).getTime()) / 86400000
  );
  if (diff <= -5) return { label: `Vence em ${Math.abs(diff)}d`, color: 'bg-blue-100 text-blue-700' };
  if (diff <= 0) return { label: diff === 0 ? 'Vence hoje' : `${Math.abs(diff)}d`, color: 'bg-yellow-100 text-yellow-700' };
  if (diff <= 3) return { label: `${diff}d — Leve`, color: 'bg-orange-100 text-orange-700' };
  if (diff <= 15) return { label: `${diff}d — Médio`, color: 'bg-red-100 text-red-700' };
  return { label: `${diff}d — CRÍTICO`, color: 'bg-red-200 text-red-800 font-bold' };
}

async function getData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
  if (!usr) return null;

  const [kpisRes, proximosRec, proximosPag, vencidosRec] = await Promise.all([
    supabase.rpc('get_kpis_financeiros', { p_empresa_id: (usr as { empresa_id: string }).empresa_id }),
    supabase.from('contas_receber').select('*, clientes(nome)').eq('status', 'pendente')
      .gte('data_vencimento', new Date().toISOString().split('T')[0])
      .lte('data_vencimento', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .order('data_vencimento').limit(5),
    supabase.from('contas_pagar').select('*, fornecedores(nome)').in('status', ['pendente', 'aprovado'])
      .gte('data_vencimento', new Date().toISOString().split('T')[0])
      .lte('data_vencimento', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .order('data_vencimento').limit(5),
    supabase.from('contas_receber').select('*, clientes(nome)').eq('status', 'pendente')
      .lt('data_vencimento', new Date().toISOString().split('T')[0])
      .order('data_vencimento').limit(8),
  ]);

  return {
    kpis: kpisRes.data as KpisFinanceiros | null,
    proximosRec: proximosRec.data as ContaReceber[] || [],
    proximosPag: proximosPag.data as ContaPagar[] || [],
    vencidosRec: vencidosRec.data as ContaReceber[] || [],
  };
}

const EMPTY_KPIS: KpisFinanceiros = {
  receber_mes: 0, pagar_mes: 0, recebido_mes: 0, pago_mes: 0,
  vencidos_rec: 0, vencidos_pag: 0, saldo_total: 0,
};

export default async function FinanceiroDashboardPage() {
  const raw = DEMO_MODE ? null : await getData();
  const kpis = raw?.kpis ?? EMPTY_KPIS;
  const proximosRec = raw?.proximosRec ?? [];
  const proximosPag = raw?.proximosPag ?? [];
  const vencidosRec = raw?.vencidosRec ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visão Financeira</h1>
        <p className="text-slate-500 text-sm capitalize">
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Saldo em Caixa" value={formatBRL(kpis.saldo_total)}
          sub="Soma de todas as contas" icon={Wallet} color="bg-blue-600"
          href="/dashboard/financeiro/bancos" />
        <KpiCard title="A Receber no Mês" value={formatBRL(kpis.receber_mes)}
          sub={`Recebido: ${formatBRL(kpis.recebido_mes)}`} icon={ArrowDownCircle} color="bg-green-500"
          href="/dashboard/financeiro/receber" />
        <KpiCard title="A Pagar no Mês" value={formatBRL(kpis.pagar_mes)}
          sub={`Pago: ${formatBRL(kpis.pago_mes)}`} icon={ArrowUpCircle} color="bg-orange-500"
          href="/dashboard/financeiro/pagar" />
        <KpiCard title="Vencidos" value={formatBRL(kpis.vencidos_rec + kpis.vencidos_pag)}
          sub={`Rec: ${formatBRL(kpis.vencidos_rec)} · Pag: ${formatBRL(kpis.vencidos_pag)}`}
          icon={AlertCircle} color={(kpis.vencidos_rec + kpis.vencidos_pag) > 0 ? 'bg-red-500' : 'bg-slate-400'} />
      </div>

      {/* Resultado do mês */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-2">Resultado do Mês</p>
          {(() => {
            const resultado = kpis.recebido_mes - kpis.pago_mes;
            const isPositivo = resultado >= 0;
            const Icon = isPositivo ? TrendingUp : TrendingDown;
            return (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPositivo ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Icon size={20} className={isPositivo ? 'text-green-600' : 'text-red-600'} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${isPositivo ? 'text-green-700' : 'text-red-700'}`}>
                    {isPositivo ? '+' : ''}{formatBRL(resultado)}
                  </p>
                  <p className="text-xs text-slate-400">{isPositivo ? 'Positivo' : 'Negativo'} — realizado</p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Previsão */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-2">Projeção do Mês</p>
          {(() => {
            const projecao = (kpis.receber_mes + kpis.recebido_mes) - (kpis.pagar_mes + kpis.pago_mes);
            const isPositivo = projecao >= 0;
            return (
              <div>
                <p className={`text-2xl font-bold ${isPositivo ? 'text-green-700' : 'text-red-700'}`}>
                  {isPositivo ? '+' : ''}{formatBRL(projecao)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Receitas: {formatBRL(kpis.receber_mes + kpis.recebido_mes)} · Despesas: {formatBRL(kpis.pagar_mes + kpis.pago_mes)}
                </p>
              </div>
            );
          })()}
        </div>

        {/* Inadimplência */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
            <AlertCircle size={14} className="text-red-500" /> Inadimplência
          </p>
          <p className={`text-2xl font-bold ${kpis.vencidos_rec > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {formatBRL(kpis.vencidos_rec)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {vencidosRec.length > 0
              ? `${vencidosRec.length} cobrança(s) em atraso`
              : 'Nenhuma inadimplência'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Cobranças vencidas */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" /> Cobranças Vencidas
            </h2>
            <Link href="/dashboard/financeiro/receber?status=pendente" className="text-xs text-blue-600 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {vencidosRec.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhuma cobrança vencida</div>
            ) : vencidosRec.map((c) => {
              const { label, color } = getCobrancaLabel(c);
              return (
                <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.clientes?.nome || c.descricao}</p>
                    <p className="text-xs text-slate-400">{new Date(c.data_vencimento).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                    <span className="text-sm font-bold text-slate-800">{formatBRL(c.valor)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Próximos 7 dias */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" /> Vencimentos — Próximos 7 dias
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {proximosRec.length === 0 && proximosPag.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum vencimento nos próximos 7 dias</div>
            ) : (
              <>
                {proximosRec.map((c) => (
                  <div key={c.id} className="px-6 py-3 flex items-center gap-3">
                    <ArrowDownCircle size={14} className="text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.clientes?.nome || c.descricao}</p>
                      <p className="text-xs text-slate-400">{new Date(c.data_vencimento).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className="text-sm font-bold text-green-700">{formatBRL(c.valor)}</span>
                  </div>
                ))}
                {proximosPag.map((c) => (
                  <div key={c.id} className="px-6 py-3 flex items-center gap-3">
                    <ArrowUpCircle size={14} className="text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(c as ContaPagar & { fornecedores?: { nome: string } }).fornecedores?.nome || c.descricao}</p>
                      <p className="text-xs text-slate-400">{new Date(c.data_vencimento).toLocaleDateString('pt-BR')} · {c.status === 'aprovado' ? 'Aprovado' : 'Pendente'}</p>
                    </div>
                    <span className="text-sm font-bold text-red-700">{formatBRL(c.valor)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
