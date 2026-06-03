'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  CreditCard, AlertTriangle, CalendarClock, TrendingUp, Phone, MessageCircle, Search,
} from 'lucide-react';
import type { ParcelaCliente, CreditoCliente } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function soDigitos(s: string | null) { return (s || '').replace(/\D/g, ''); }
function waLink(tel: string | null, celular: string | null) {
  const d = soDigitos(celular) || soDigitos(tel);
  if (!d) return null;
  return `https://wa.me/55${d}`;
}

type Aba = 'cobranca' | 'inadimplencia' | 'credito';

const FAIXA_LABEL: Record<string, string> = {
  '1_30': '1 a 30 dias', '31_60': '31 a 60 dias', '61_90': '61 a 90 dias', '90_mais': '90+ dias',
};

export default function CrediarioPage() {
  const [aba, setAba] = useState<Aba>('cobranca');
  const [parcelas, setParcelas] = useState<ParcelaCliente[]>([]);
  const [creditos, setCreditos] = useState<CreditoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: parc }, { data: cred }] = await Promise.all([
      supabase.from('v_parcelas_cliente').select('*').order('data_vencimento'),
      supabase.from('v_credito_cliente').select('*'),
    ]);
    setParcelas((parc as ParcelaCliente[]) || []);
    setCreditos((cred as CreditoCliente[]) || []);
    setLoading(false);
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const emDias = (d: number) => { const x = new Date(hoje); x.setDate(x.getDate() + d); return x; };
  const dataDe = (s: string) => { const d = new Date(s + 'T00:00:00'); return d; };

  const q = busca.toLowerCase();
  const filtraBusca = (p: ParcelaCliente) => !q || p.cliente_nome.toLowerCase().includes(q) || soDigitos(p.cpf_cnpj).includes(soDigitos(busca)) || soDigitos(p.telefone).includes(soDigitos(busca)) || soDigitos(p.celular).includes(soDigitos(busca));

  // Cobrança: vencendo hoje / 7 / 15 / vencidos
  const venceHoje = parcelas.filter((p) => dataDe(p.data_vencimento).getTime() === hoje.getTime() && filtraBusca(p));
  const vence7 = parcelas.filter((p) => { const d = dataDe(p.data_vencimento); return d > hoje && d <= emDias(7) && filtraBusca(p); });
  const vence15 = parcelas.filter((p) => { const d = dataDe(p.data_vencimento); return d > emDias(7) && d <= emDias(15) && filtraBusca(p); });
  const vencidos = parcelas.filter((p) => p.dias_atraso > 0 && filtraBusca(p));

  // Inadimplência: aging das vencidas
  const faixas: Record<string, ParcelaCliente[]> = { '1_30': [], '31_60': [], '61_90': [], '90_mais': [] };
  vencidos.forEach((p) => { if (faixas[p.faixa_atraso]) faixas[p.faixa_atraso].push(p); });

  // Crédito: clientes com limite ou utilização, mais "cheios" primeiro
  const credClientes = creditos
    .filter((c) => (Number(c.limite_credito) > 0 || Number(c.limite_utilizado) > 0) && (!q || c.nome.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.pct_utilizado) - Number(a.pct_utilizado));

  const totVencido = vencidos.reduce((s, p) => s + Number(p.saldo), 0);
  const inadimplentes = creditos.filter((c) => c.status_efetivo === 'inadimplente').length;

  function ParcelaRow({ p }: { p: ParcelaCliente }) {
    const wa = waLink(p.telefone, p.celular);
    return (
      <div className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
        <div>
          <p className="font-medium text-slate-900">{p.cliente_nome}</p>
          <p className="text-xs text-slate-400">{p.descricao} · vence {dataDe(p.data_vencimento).toLocaleDateString('pt-BR')}{p.dias_atraso > 0 && <span className="text-red-500"> · {p.dias_atraso}d atraso</span>}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900">{formatBRL(Number(p.saldo))}</span>
          {wa
            ? <a href={wa} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700" title="WhatsApp"><MessageCircle size={16} /></a>
            : <span className="text-slate-200"><Phone size={16} /></span>}
        </div>
      </div>
    );
  }

  function Lista({ titulo, itens, cor }: { titulo: string; itens: ParcelaCliente[]; cor: string }) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">{titulo} ({itens.length})</h2>
          <span className={`text-sm font-bold ${cor}`}>{formatBRL(itens.reduce((s, p) => s + Number(p.saldo), 0))}</span>
        </div>
        <div className="divide-y divide-slate-50">
          {itens.length === 0 ? <p className="px-6 py-6 text-center text-slate-400 text-sm">Nada aqui.</p>
            : itens.map((p) => <ParcelaRow key={p.id} p={p} />)}
        </div>
      </div>
    );
  }

  const abas: { id: Aba; label: string; icon: React.ElementType }[] = [
    { id: 'cobranca', label: 'Cobrança', icon: CalendarClock },
    { id: 'inadimplencia', label: 'Inadimplência', icon: AlertTriangle },
    { id: 'credito', label: 'Crédito', icon: TrendingUp },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><CreditCard size={22} /> Crediário</h1>
        <p className="text-slate-500 text-sm">
          {vencidos.length} parcela(s) vencida(s) · {formatBRL(totVencido)} em atraso · {inadimplentes} inadimplente(s)
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-slate-200">
        {abas.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${aba === a.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon size={15} /> {a.label}
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou telefone..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : aba === 'cobranca' ? (
        <div className="space-y-4">
          <Lista titulo="Vence hoje" itens={venceHoje} cor="text-blue-600" />
          <Lista titulo="Vence em até 7 dias" itens={vence7} cor="text-slate-700" />
          <Lista titulo="Vence em 8 a 15 dias" itens={vence15} cor="text-slate-700" />
          <Lista titulo="Vencidos" itens={vencidos} cor="text-red-600" />
        </div>
      ) : aba === 'inadimplencia' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['1_30', '31_60', '61_90', '90_mais'] as const).map((f) => (
              <div key={f} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <p className="text-xs text-slate-400">{FAIXA_LABEL[f]}</p>
                <p className="text-lg font-bold text-slate-900">{formatBRL(faixas[f].reduce((s, p) => s + Number(p.saldo), 0))}</p>
                <p className="text-[11px] text-slate-400">{faixas[f].length} parcela(s)</p>
              </div>
            ))}
          </div>
          {(['1_30', '31_60', '61_90', '90_mais'] as const).map((f) => (
            faixas[f].length > 0 && <Lista key={f} titulo={FAIXA_LABEL[f]} itens={faixas[f]} cor="text-red-600" />
          ))}
          {vencidos.length === 0 && <div className="bg-white rounded-xl border border-slate-100 py-12 text-center text-slate-400">Nenhuma parcela vencida. 🎉</div>}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Cliente', 'Status', 'Limite', 'Utilizado', 'Disponível', '% Uso', 'Score'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {credClientes.map((c) => {
                const pct = Number(c.pct_utilizado);
                const ef = c.status_efetivo;
                const cor = ef === 'bloqueado' ? 'bg-red-100 text-red-700' : ef === 'inadimplente' ? 'bg-orange-100 text-orange-700'
                  : ef === 'atraso' ? 'bg-yellow-100 text-yellow-700' : ef === 'em_analise' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
                const lbl = ef === 'atraso' ? 'Em atraso' : ef === 'inadimplente' ? 'Inadimplente' : ef === 'bloqueado' ? 'Bloqueado' : ef === 'em_analise' ? 'Em análise' : 'Ativo';
                return (
                  <tr key={c.cliente_id} className="border-b border-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{c.nome}</td>
                    <td className="px-6 py-3"><span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${cor}`}>{lbl}</span></td>
                    <td className="px-6 py-3">{formatBRL(Number(c.limite_credito))}</td>
                    <td className="px-6 py-3">{formatBRL(Number(c.limite_utilizado))}</td>
                    <td className="px-6 py-3 font-medium">{formatBRL(Number(c.limite_disponivel))}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-amber-500 text-xs" title={`Score ${c.score_pontos}`}>{'★'.repeat(c.score_estrelas)}{'☆'.repeat(5 - c.score_estrelas)}</td>
                  </tr>
                );
              })}
              {credClientes.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-slate-400">Nenhum cliente com crédito configurado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Recebimentos são feitos no <Link href="/dashboard/financeiro/caixa" className="text-blue-600 hover:underline">Caixa</Link> ou em <Link href="/dashboard/financeiro/receber" className="text-blue-600 hover:underline">Contas a Receber</Link> (com baixa parcial).
      </p>
    </div>
  );
}
