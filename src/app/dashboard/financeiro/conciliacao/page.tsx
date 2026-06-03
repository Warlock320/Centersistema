'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/components/PermissionsProvider';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import { Scale, CheckCircle2, Circle, ArrowDownCircle, ArrowUpCircle, Lock } from 'lucide-react';
import type { ContaBancaria } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Linha unificada (recebimento ou pagamento) já liquidada
interface Lancamento {
  id: string;
  origem: 'receber' | 'pagar';
  descricao: string;
  data: string;          // data_pagamento
  valor: number;         // valor_pago || valor
  conciliado: boolean;
}

export default function ConciliacaoPage() {
  const [bancos, setBancos] = useState<ContaBancaria[]>([]);
  const [bancoId, setBancoId] = useState('');
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [saldoExtrato, setSaldoExtrato] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const supabase = createClient();
  const toast = useToast();
  const { can } = usePermissions();
  const podeConciliar = can('edit_financeiro');

  useEffect(() => {
    supabase.from('v_saldo_bancario').select('*').eq('ativo', true).order('nome').then(({ data }) => {
      const bs = (data as ContaBancaria[]) || [];
      setBancos(bs);
      if (bs.length > 0) setBancoId((b) => b || bs[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => { if (bancoId) fetchLancamentos(); }, [bancoId]);

  async function fetchLancamentos() {
    setLoading(true);
    setSel(new Set());
    const [rec, pag] = await Promise.all([
      supabase.from('contas_receber')
        .select('id, descricao, data_pagamento, valor, valor_pago, conciliado')
        .eq('status', 'pago').eq('conta_bancaria_id', bancoId),
      supabase.from('contas_pagar')
        .select('id, descricao, data_pagamento, valor, valor_pago, conciliado')
        .eq('status', 'pago').eq('conta_bancaria_id', bancoId),
    ]);
    type Row = { id: string; descricao: string; data_pagamento: string | null; valor: number; valor_pago: number | null; conciliado: boolean };
    const recRows: Lancamento[] = (rec.data as Row[] || []).map((r) => ({
      id: r.id, origem: 'receber', descricao: r.descricao, data: r.data_pagamento || '',
      valor: Number(r.valor_pago ?? r.valor), conciliado: r.conciliado,
    }));
    const pagRows: Lancamento[] = (pag.data as Row[] || []).map((r) => ({
      id: r.id, origem: 'pagar', descricao: r.descricao, data: r.data_pagamento || '',
      valor: Number(r.valor_pago ?? r.valor), conciliado: r.conciliado,
    }));
    setLancamentos([...recRows, ...pagRows].sort((a, b) => (a.data < b.data ? 1 : -1)));
    setLoading(false);
  }

  function toggle(id: string) {
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function conciliarSelecionados() {
    if (sel.size === 0) return;
    setActing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const ids = [...sel];
    const update = { conciliado: true, conciliado_em: new Date().toISOString(), conciliado_por: user?.id || null };
    const alvos = lancamentos.filter((l) => sel.has(l.id));
    const recIds = alvos.filter((l) => l.origem === 'receber').map((l) => l.id);
    const pagIds = alvos.filter((l) => l.origem === 'pagar').map((l) => l.id);
    const ops = [];
    if (recIds.length) ops.push(supabase.from('contas_receber').update(update).in('id', recIds));
    if (pagIds.length) ops.push(supabase.from('contas_pagar').update(update).in('id', pagIds));
    const results = await Promise.all(ops);
    setActing(false);
    const err = results.find((r) => r.error);
    if (err?.error) toast.error('Erro ao conciliar: ' + err.error.message);
    else toast.success(`${ids.length} lançamento(s) conciliado(s)!`);
    fetchLancamentos();
  }

  // Saldo do sistema = saldo_atual da conta (do v_saldo_bancario)
  const banco = bancos.find((b) => b.id === bancoId);
  const saldoSistema = Number(banco?.saldo_atual ?? banco?.saldo_inicial ?? 0);
  const diferenca = saldoExtrato - saldoSistema;

  const naoConciliados = lancamentos.filter((l) => !l.conciliado);
  const conciliados = lancamentos.filter((l) => l.conciliado);
  const totalConciliado = conciliados.reduce((s, l) => s + (l.origem === 'receber' ? l.valor : -l.valor), 0);

  if (!podeConciliar) {
    return <div className="py-16 text-center text-slate-400">Você não tem permissão para acessar a conciliação.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Scale size={22} /> Conciliação Bancária</h1>
        <p className="text-slate-500 text-sm">Confira os lançamentos liquidados contra o extrato da conta.</p>
      </div>

      {/* Seleção de conta + extrato */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 grid sm:grid-cols-3 gap-4">
        <Select label="Conta bancária" value={bancoId} onChange={(e) => setBancoId(e.target.value)}
          options={bancos.map((b) => ({ value: b.id, label: b.nome }))} />
        <Input label="Saldo do extrato (informado) R$" inputMode="numeric"
          value={formatMoedaInput(saldoExtrato)} onChange={(e) => setSaldoExtrato(parseMoedaInput(e.target.value))} placeholder="0,00" />
        <div className="flex flex-col justify-end">
          <p className="text-xs text-slate-400">Saldo do sistema: <span className="font-medium text-slate-700">{formatBRL(saldoSistema)}</span></p>
          <p className={`text-sm font-bold ${diferenca === 0 ? 'text-green-600' : 'text-red-600'}`}>
            Diferença: {diferenca === 0 ? 'OK' : formatBRL(diferenca)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : (
        <>
          {/* Não conciliados */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">A conciliar ({naoConciliados.length})</h2>
              {sel.size > 0 && (
                <Button size="sm" loading={acting} onClick={conciliarSelecionados}>
                  <Lock size={14} /> Conciliar {sel.size} selecionado(s)
                </Button>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {naoConciliados.length === 0 ? (
                <p className="px-6 py-8 text-center text-slate-400 text-sm">Nada a conciliar nesta conta.</p>
              ) : naoConciliados.map((l) => (
                <button key={l.id} type="button" onClick={() => toggle(l.id)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-slate-50 text-left">
                  <div className="flex items-center gap-3">
                    {sel.has(l.id) ? <CheckCircle2 size={18} className="text-blue-600" /> : <Circle size={18} className="text-slate-300" />}
                    {l.origem === 'receber' ? <ArrowDownCircle size={16} className="text-green-500" /> : <ArrowUpCircle size={16} className="text-red-500" />}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{l.descricao}</p>
                      <p className="text-xs text-slate-400">{l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '—'}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${l.origem === 'receber' ? 'text-green-600' : 'text-red-600'}`}>
                    {l.origem === 'receber' ? '+' : '−'} {formatBRL(l.valor)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Conciliados */}
          {conciliados.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Conciliados ({conciliados.length})</h2>
                <span className="text-sm text-slate-500">Saldo conciliado: <strong className={totalConciliado >= 0 ? 'text-green-600' : 'text-red-600'}>{formatBRL(totalConciliado)}</strong></span>
              </div>
              <div className="divide-y divide-slate-50">
                {conciliados.map((l) => (
                  <div key={l.id} className="px-6 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={16} className="text-green-500" />
                      <div>
                        <p className="text-sm text-slate-700">{l.descricao}</p>
                        <p className="text-xs text-slate-400">{l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '—'}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${l.origem === 'receber' ? 'text-green-600' : 'text-red-600'}`}>
                      {l.origem === 'receber' ? '+' : '−'} {formatBRL(l.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
