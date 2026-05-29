'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Plus, Pencil, Landmark, Wallet, ArrowDownCircle, ArrowUpCircle, Scale } from 'lucide-react';
import type { ContaBancaria, ContaReceber, ContaPagar } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const TIPO_OPTIONS = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'caixa', label: 'Caixa (dinheiro)' },
  { value: 'investimento', label: 'Investimento' },
  { value: 'outro', label: 'Outro' },
];

const EMPTY: Partial<ContaBancaria> = {
  nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: 0,
};

interface Movimento {
  id: string;
  data: string;
  descricao: string;
  tipo: 'entrada' | 'saida';
  valor: number;
}

export default function BancosPage() {
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showConcil, setShowConcil] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selected, setSelected] = useState<ContaBancaria | null>(null);
  const [form, setForm] = useState<Partial<ContaBancaria>>(EMPTY);

  // Conciliação
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [saldoExtrato, setSaldoExtrato] = useState('');
  const [loadingConcil, setLoadingConcil] = useState(false);

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('v_saldo_bancario').select('*').order('nome');
    setContas(data as ContaBancaria[] || []);
    setLoading(false);
  }

  function openForm(c?: ContaBancaria) {
    setSelected(c || null);
    setForm(c ? { ...c } : EMPTY);
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nome: form.nome, banco: form.banco, agencia: form.agencia, conta: form.conta,
      tipo: form.tipo, saldo_inicial: Number(form.saldo_inicial) || 0,
    };
    if (selected) {
      await supabase.from('contas_bancarias').update(payload).eq('id', selected.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      await supabase.from('contas_bancarias').insert({ ...payload, empresa_id: (usr as { empresa_id: string })!.empresa_id });
    }
    setSaving(false);
    setShowForm(false);
    fetchData();
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    await supabase.from('contas_bancarias').update({ ativo: false }).eq('id', toDelete);
    setDeleting(false);
    setShowConfirm(false);
    setToDelete(null);
    setShowForm(false);
    fetchData();
  }

  async function openConciliacao(c: ContaBancaria) {
    setSelected(c);
    setSaldoExtrato('');
    setShowConcil(true);
    setLoadingConcil(true);

    const [recRes, pagRes] = await Promise.all([
      supabase.from('contas_receber').select('id, descricao, data_pagamento, valor_pago, valor')
        .eq('conta_bancaria_id', c.id).eq('status', 'pago')
        .order('data_pagamento', { ascending: false }).limit(50),
      supabase.from('contas_pagar').select('id, descricao, data_pagamento, valor_pago, valor')
        .eq('conta_bancaria_id', c.id).eq('status', 'pago')
        .order('data_pagamento', { ascending: false }).limit(50),
    ]);

    const movs: Movimento[] = [
      ...(recRes.data as ContaReceber[] || []).map((r) => ({
        id: r.id, data: r.data_pagamento || '', descricao: r.descricao,
        tipo: 'entrada' as const, valor: Number(r.valor_pago || r.valor),
      })),
      ...(pagRes.data as ContaPagar[] || []).map((p) => ({
        id: p.id, data: p.data_pagamento || '', descricao: p.descricao,
        tipo: 'saida' as const, valor: Number(p.valor_pago || p.valor),
      })),
    ].sort((a, b) => (b.data > a.data ? 1 : -1));

    setMovimentos(movs);
    setLoadingConcil(false);
  }

  const set = (key: keyof ContaBancaria) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual ?? c.saldo_inicial), 0);
  const saldoSistema = Number(selected?.saldo_atual ?? selected?.saldo_inicial ?? 0);
  const diferenca = saldoExtrato !== '' ? parseFloat(saldoExtrato) - saldoSistema : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas Bancárias</h1>
          <p className="text-slate-500 text-sm">
            {contas.length} conta(s) · Saldo total: <strong className="text-slate-700">{formatBRL(saldoTotal)}</strong>
          </p>
        </div>
        <Button onClick={() => openForm()}><Plus size={16} /> Nova Conta</Button>
      </div>

      {/* Cards de contas */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : contas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
          <Landmark size={40} className="mx-auto mb-3 opacity-30" />
          <p>Nenhuma conta bancária cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {contas.map((c) => {
            const saldo = Number(c.saldo_atual ?? c.saldo_inicial);
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.tipo === 'caixa' ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {c.tipo === 'caixa'
                        ? <Wallet size={18} className="text-green-600" />
                        : <Landmark size={18} className="text-blue-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{c.nome}</p>
                      <p className="text-xs text-slate-400 capitalize">{c.tipo}{c.banco ? ` · ${c.banco}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => openForm(c)} className="text-slate-400 hover:text-slate-600 p-1">
                    <Pencil size={14} />
                  </button>
                </div>
                <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{formatBRL(saldo)}</p>
                {(c.agencia || c.conta) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {c.agencia && `Ag. ${c.agencia}`}{c.conta && ` · CC ${c.conta}`}
                  </p>
                )}
                <Button variant="secondary" size="sm" className="w-full mt-3" onClick={() => openConciliacao(c)}>
                  <Scale size={13} /> Conciliar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Conta' : 'Nova Conta Bancária'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nome da Conta *" value={form.nome || ''} onChange={set('nome')} required placeholder="Ex: Bradesco Principal" />
          <Select label="Tipo" value={form.tipo || 'corrente'} onChange={set('tipo')} options={TIPO_OPTIONS} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Banco" value={form.banco || ''} onChange={set('banco')} placeholder="237" />
            <Input label="Agência" value={form.agencia || ''} onChange={set('agencia')} />
            <Input label="Conta" value={form.conta || ''} onChange={set('conta')} />
          </div>
          <Input label="Saldo Inicial (R$)" type="number" step="0.01" value={form.saldo_inicial || 0} onChange={set('saldo_inicial')} />
          <p className="text-xs text-slate-400">O saldo atual é calculado automaticamente somando recebimentos e pagamentos baixados nesta conta.</p>
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && (
              <Button type="button" variant="danger" size="sm" onClick={() => { setToDelete(selected.id); setShowConfirm(true); }}>
                Desativar
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Conciliação Modal */}
      <Modal open={showConcil} onClose={() => setShowConcil(false)} title={`Conciliação — ${selected?.nome}`} size="lg">
        <div className="space-y-5">
          {/* Comparativo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Saldo no Sistema</p>
              <p className="text-xl font-bold text-slate-900">{formatBRL(saldoSistema)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <label className="text-xs text-slate-400 mb-1 block">Saldo no Extrato (banco)</label>
              <input type="number" step="0.01" value={saldoExtrato} onChange={(e) => setSaldoExtrato(e.target.value)}
                placeholder="0,00"
                className="w-full text-xl font-bold text-slate-900 bg-transparent border-b border-slate-300 focus:outline-none focus:border-blue-500" />
            </div>
            <div className={`rounded-lg p-4 ${diferenca === null ? 'bg-slate-50' : diferenca === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className="text-xs text-slate-400 mb-1">Diferença</p>
              <p className={`text-xl font-bold ${diferenca === null ? 'text-slate-400' : diferenca === 0 ? 'text-green-700' : 'text-red-600'}`}>
                {diferenca === null ? '—' : formatBRL(diferenca)}
              </p>
              {diferenca === 0 && <p className="text-xs text-green-600 mt-0.5">✓ Conciliado</p>}
              {diferenca !== null && diferenca !== 0 && <p className="text-xs text-red-500 mt-0.5">Verifique lançamentos</p>}
            </div>
          </div>

          {/* Movimentos */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-2 text-sm">Movimentações baixadas nesta conta</h3>
            {loadingConcil ? (
              <p className="text-center py-6 text-slate-400 text-sm">Carregando movimentos...</p>
            ) : movimentos.length === 0 ? (
              <p className="text-center py-6 text-slate-400 text-sm">Nenhuma movimentação registrada nesta conta</p>
            ) : (
              <div className="border border-slate-100 rounded-lg max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-slate-500">Data</th>
                      <th className="px-4 py-2 text-left text-xs text-slate-500">Descrição</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentos.map((m) => (
                      <tr key={`${m.tipo}-${m.id}`} className="border-t border-slate-50">
                        <td className="px-4 py-2 text-slate-500">{m.data ? new Date(m.data).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-2">
                            {m.tipo === 'entrada'
                              ? <ArrowDownCircle size={13} className="text-green-500 shrink-0" />
                              : <ArrowUpCircle size={13} className="text-red-500 shrink-0" />}
                            {m.descricao}
                          </span>
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {m.tipo === 'entrada' ? '+' : '−'} {formatBRL(m.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Confirm open={showConfirm} title="Desativar conta bancária"
        message="A conta será desativada. O histórico de movimentações é preservado."
        confirmLabel="Desativar" loading={deleting}
        onConfirm={handleDelete} onCancel={() => { setShowConfirm(false); setToDelete(null); }} />
    </div>
  );
}
