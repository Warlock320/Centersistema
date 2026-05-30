'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Wallet, AlertCircle, DollarSign,
  ArrowDownCircle, ArrowUpCircle, CalendarClock,
} from 'lucide-react';
import type { ContaReceber, ContaPagar, ContaBancaria, Unidade } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function hojeLocal() { return new Date().toLocaleDateString('en-CA'); }
function mesAtual() { return new Date().toLocaleDateString('en-CA').slice(0, 7); }

export default function FinanceiroDashboardPage() {
  const [receber, setReceber] = useState<ContaReceber[]>([]);
  const [pagar, setPagar] = useState<ContaPagar[]>([]);
  const [bancos, setBancos] = useState<ContaBancaria[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [rec, pag, bks, unis] = await Promise.all([
      supabase.from('contas_receber').select('*'),
      supabase.from('contas_pagar').select('*'),
      supabase.from('v_saldo_bancario').select('*').eq('ativo', true),
      supabase.from('unidades').select('*').eq('ativo', true).order('padrao', { ascending: false }),
    ]);
    setReceber(rec.data as ContaReceber[] || []);
    setPagar(pag.data as ContaPagar[] || []);
    setBancos(bks.data as ContaBancaria[] || []);
    setUnidades(unis.data as Unidade[] || []);
    setLoading(false);
  }

  const u = filtroUnidade;
  const recF = receber.filter((c) => !u || c.unidade_id === u);
  const pagF = pagar.filter((c) => !u || c.unidade_id === u);
  const bancosF = bancos.filter((b) => !u || b.unidade_id === u);

  const hoje = hojeLocal();
  const mes = mesAtual();
  const em30 = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA');

  // HOJE
  const recebidoHoje = recF.filter((c) => c.status === 'pago' && c.data_pagamento === hoje).reduce((s, c) => s + Number(c.valor_pago || c.valor), 0);
  const pagoHoje = pagF.filter((c) => c.status === 'pago' && c.data_pagamento === hoje).reduce((s, c) => s + Number(c.valor_pago || c.valor), 0);

  // MÊS
  const receitaMes = recF.filter((c) => c.status === 'pago' && (c.data_pagamento || '').slice(0, 7) === mes).reduce((s, c) => s + Number(c.valor_pago || c.valor), 0);
  const despesaMes = pagF.filter((c) => c.status === 'pago' && (c.data_pagamento || '').slice(0, 7) === mes).reduce((s, c) => s + Number(c.valor_pago || c.valor), 0);
  const lucroMes = receitaMes - despesaMes;

  // PRÓXIMOS 30 DIAS (pendentes)
  const aReceber30 = recF.filter((c) => c.status === 'pendente' && c.data_vencimento >= hoje && c.data_vencimento <= em30).reduce((s, c) => s + c.valor, 0);
  const aPagar30 = pagF.filter((c) => (c.status === 'pendente' || c.status === 'aprovado') && c.data_vencimento >= hoje && c.data_vencimento <= em30).reduce((s, c) => s + c.valor, 0);

  // Vencidos
  const vencidosRec = recF.filter((c) => c.status === 'pendente' && c.data_vencimento < hoje).reduce((s, c) => s + c.valor, 0);
  const vencidosPag = pagF.filter((c) => (c.status === 'pendente' || c.status === 'aprovado') && c.data_vencimento < hoje).reduce((s, c) => s + c.valor, 0);

  const saldoCaixa = bancosF.reduce((s, b) => s + Number(b.saldo_atual ?? b.saldo_inicial), 0);

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Financeira</h1>
          <p className="text-slate-500 text-sm capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
        {unidades.length > 1 && (
          <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todas as empresas</option>
            {unidades.map((un) => <option key={un.id} value={un.id}>{un.nome_fantasia || un.razao_social}</option>)}
          </select>
        )}
      </div>

      {/* HOJE */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Hoje</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card title="Recebido hoje" value={formatBRL(recebidoHoje)} icon={ArrowDownCircle} color="bg-green-500" />
          <Card title="Pago hoje" value={formatBRL(pagoHoje)} icon={ArrowUpCircle} color="bg-red-500" />
          <Card title="Saldo do dia" value={formatBRL(recebidoHoje - pagoHoje)} icon={DollarSign}
            color={recebidoHoje - pagoHoje >= 0 ? 'bg-blue-600' : 'bg-orange-500'} />
        </div>
      </div>

      {/* MÊS */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
          Mês — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card title="Receita" value={formatBRL(receitaMes)} icon={TrendingUp} color="bg-green-500" />
          <Card title="Despesa" value={formatBRL(despesaMes)} icon={TrendingDown} color="bg-red-500" />
          <div className={`rounded-xl p-5 shadow-sm text-white ${lucroMes >= 0 ? 'bg-blue-600' : 'bg-orange-500'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-white/80">Lucro do mês</p>
              <DollarSign size={18} className="text-white/90" />
            </div>
            <p className="text-2xl font-bold">{lucroMes >= 0 ? '' : '−'}{formatBRL(Math.abs(lucroMes))}</p>
            <p className="text-xs text-white/70 mt-1">{lucroMes >= 0 ? 'Resultado positivo' : 'Resultado negativo'}</p>
          </div>
        </div>
      </div>

      {/* PRÓXIMOS 30 DIAS */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Próximos 30 dias</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card title="A receber" value={formatBRL(aReceber30)} icon={CalendarClock} color="bg-emerald-500" href="/dashboard/financeiro/receber" />
          <Card title="A pagar" value={formatBRL(aPagar30)} icon={CalendarClock} color="bg-amber-500" href="/dashboard/financeiro/pagar" />
          <Card title="Saldo em Caixa/Bancos" value={formatBRL(saldoCaixa)} icon={Wallet} color="bg-slate-700" href="/dashboard/financeiro/bancos" />
        </div>
      </div>

      {/* Vencidos */}
      {(vencidosRec > 0 || vencidosPag > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vencidosRec > 0 && (
            <Link href="/dashboard/financeiro/receber" className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors">
              <AlertCircle size={20} className="text-yellow-600 shrink-0" />
              <div><p className="text-sm font-medium text-yellow-800">A receber vencido</p><p className="text-lg font-bold text-yellow-700">{formatBRL(vencidosRec)}</p></div>
            </Link>
          )}
          {vencidosPag > 0 && (
            <Link href="/dashboard/financeiro/pagar" className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
              <AlertCircle size={20} className="text-red-600 shrink-0" />
              <div><p className="text-sm font-medium text-red-800">A pagar vencido</p><p className="text-lg font-bold text-red-700">{formatBRL(vencidosPag)}</p></div>
            </Link>
          )}
        </div>
      )}

      {/* Saldo por conta */}
      {bancosF.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Wallet size={18} className="text-blue-500" /> Saldo por Conta</h2>
            <Link href="/dashboard/financeiro/bancos" className="text-xs text-blue-600 hover:underline">Conciliar</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {bancosF.map((b) => (
              <div key={b.id} className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-700">{b.nome}</span>
                <span className="font-bold text-slate-900">{formatBRL(Number(b.saldo_atual ?? b.saldo_inicial))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, value, icon: Icon, color, href }: {
  title: string; value: string; icon: React.ElementType; color: string; href?: string;
}) {
  const content = (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-slate-500">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
