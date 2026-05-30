'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import {
  Plus, Minus, Lock, Unlock, ArrowDownCircle, ArrowUpCircle,
  Smartphone, Banknote, CreditCard, Landmark, Wallet,
} from 'lucide-react';
import type { Caixa, MovimentoCaixa, Unidade } from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const FORMAS = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'debito', label: 'Débito', icon: CreditCard },
  { value: 'credito', label: 'Crédito', icon: CreditCard },
  { value: 'transferencia', label: 'Transferência', icon: Landmark },
];

export default function CaixaPage() {
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [movimentos, setMovimentos] = useState<MovimentoCaixa[]>([]);
  const [historico, setHistorico] = useState<Caixa[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAbrir, setShowAbrir] = useState(false);
  const [showMov, setShowMov] = useState(false);
  const [showFechar, setShowFechar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Abertura
  const [aSaldo, setASaldo] = useState(0);
  const [aUnidade, setAUnidade] = useState('');

  // Movimento
  const [mTipo, setMTipo] = useState<'entrada' | 'saida'>('entrada');
  const [mForma, setMForma] = useState('dinheiro');
  const [mValor, setMValor] = useState(0);
  const [mDescricao, setMDescricao] = useState('');

  // Fechamento
  const [fSaldoInformado, setFSaldoInformado] = useState(0);
  const [fObs, setFObs] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [aberto, hist, unis] = await Promise.all([
      supabase.from('caixas').select('*').eq('status', 'aberto').order('aberto_em', { ascending: false }).limit(1),
      supabase.from('caixas').select('*').eq('status', 'fechado').order('fechado_em', { ascending: false }).limit(15),
      supabase.from('unidades').select('*').eq('ativo', true).order('padrao', { ascending: false }),
    ]);
    const atual = (aberto.data as Caixa[] || [])[0] || null;
    setCaixa(atual);
    setHistorico(hist.data as Caixa[] || []);
    setUnidades(unis.data as Unidade[] || []);

    if (atual) {
      const { data } = await supabase.from('movimentos_caixa').select('*').eq('caixa_id', atual.id).order('created_at', { ascending: false });
      setMovimentos(data as MovimentoCaixa[] || []);
    } else {
      setMovimentos([]);
    }
    setLoading(false);
  }

  async function handleAbrir(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    await supabase.from('caixas').insert({
      empresa_id: (usr as { empresa_id: string })!.empresa_id,
      unidade_id: aUnidade || null,
      usuario_id: user!.id,
      saldo_inicial: aSaldo,
      status: 'aberto',
    });
    setSaving(false);
    setShowAbrir(false);
    setASaldo(0);
    fetchAll();
  }

  async function handleMovimento(e: FormEvent) {
    e.preventDefault();
    if (!caixa || mValor <= 0) return;
    setSaving(true);
    await supabase.from('movimentos_caixa').insert({
      empresa_id: caixa.empresa_id,
      caixa_id: caixa.id,
      tipo: mTipo,
      forma_pagamento: mForma,
      valor: mValor,
      descricao: mDescricao || null,
    });
    setSaving(false);
    setShowMov(false);
    setMValor(0); setMDescricao('');
    fetchAll();
  }

  async function handleFechar(e: FormEvent) {
    e.preventDefault();
    if (!caixa) return;
    setSaving(true);
    await supabase.rpc('fechar_caixa', {
      p_caixa_id: caixa.id,
      p_saldo_informado: fSaldoInformado,
      p_observacao: fObs || null,
    });
    setSaving(false);
    setShowFechar(false);
    setFSaldoInformado(0); setFObs('');
    fetchAll();
  }

  function openMov(tipo: 'entrada' | 'saida') {
    setMTipo(tipo);
    setMForma('dinheiro');
    setMValor(0);
    setMDescricao('');
    setShowMov(true);
  }

  // Totais do caixa aberto
  const totaisPorForma: Record<string, { entrada: number; saida: number }> = {};
  FORMAS.forEach((f) => { totaisPorForma[f.value] = { entrada: 0, saida: 0 }; });
  movimentos.forEach((m) => {
    const k = m.forma_pagamento || 'dinheiro';
    if (!totaisPorForma[k]) totaisPorForma[k] = { entrada: 0, saida: 0 };
    totaisPorForma[k][m.tipo] += Number(m.valor);
  });
  const totalEntradas = movimentos.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.valor), 0);
  const totalSaidas = movimentos.filter((m) => m.tipo === 'saida').reduce((s, m) => s + Number(m.valor), 0);
  const saldoInicial = Number(caixa?.saldo_inicial || 0);
  const entradasDinheiro = totaisPorForma['dinheiro']?.entrada || 0;
  const saidasDinheiro = totaisPorForma['dinheiro']?.saida || 0;
  const saldoDinheiro = saldoInicial + entradasDinheiro - saidasDinheiro;
  const saldoGeral = saldoInicial + totalEntradas - totalSaidas;

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Caixa Diário</h1>
          <p className="text-slate-500 text-sm">
            {caixa ? `Caixa aberto desde ${new Date(caixa.aberto_em).toLocaleString('pt-BR')}` : 'Nenhum caixa aberto'}
          </p>
        </div>
        {!caixa ? (
          <Button onClick={() => { setASaldo(0); setAUnidade(unidades.find((u) => u.padrao)?.id || ''); setShowAbrir(true); }}>
            <Unlock size={16} /> Abrir Caixa
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="success" size="sm" onClick={() => openMov('entrada')}><Plus size={14} /> Entrada</Button>
            <Button variant="danger" size="sm" onClick={() => openMov('saida')}><Minus size={14} /> Saída</Button>
            <Button variant="secondary" size="sm" onClick={() => { setFSaldoInformado(saldoDinheiro); setShowFechar(true); }}>
              <Lock size={14} /> Fechar
            </Button>
          </div>
        )}
      </div>

      {!caixa ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center text-slate-400">
          <Wallet size={40} className="mx-auto mb-3 opacity-30" />
          <p>Abra o caixa para começar a registrar as movimentações do dia.</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400">Saldo Inicial</p>
              <p className="text-xl font-bold text-slate-900">{formatBRL(saldoInicial)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 flex items-center gap-1"><ArrowDownCircle size={12} className="text-green-500" /> Entradas</p>
              <p className="text-xl font-bold text-green-600">{formatBRL(totalEntradas)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <p className="text-xs text-slate-400 flex items-center gap-1"><ArrowUpCircle size={12} className="text-red-500" /> Saídas</p>
              <p className="text-xl font-bold text-red-600">{formatBRL(totalSaidas)}</p>
            </div>
            <div className="bg-blue-600 rounded-xl p-4 shadow-sm text-white">
              <p className="text-xs text-blue-100">Dinheiro na Gaveta</p>
              <p className="text-xl font-bold">{formatBRL(saldoDinheiro)}</p>
            </div>
          </div>

          {/* Entradas por forma */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">Entradas por forma de pagamento</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {FORMAS.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.value} className="text-center p-3 bg-slate-50 rounded-lg">
                    <Icon size={18} className="mx-auto text-slate-400 mb-1" />
                    <p className="text-xs text-slate-500">{f.label}</p>
                    <p className="text-sm font-bold text-slate-800">{formatBRL(totaisPorForma[f.value]?.entrada || 0)}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500 mr-2">Saldo geral (todas as formas):</span>
              <span className="font-bold text-slate-900">{formatBRL(saldoGeral)}</span>
            </div>
          </div>

          {/* Movimentos */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Movimentações ({movimentos.length})</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {movimentos.length === 0 ? (
                <p className="px-6 py-8 text-center text-slate-400 text-sm">Nenhuma movimentação ainda</p>
              ) : movimentos.map((m) => (
                <div key={m.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {m.tipo === 'entrada'
                      ? <ArrowDownCircle size={16} className="text-green-500" />
                      : <ArrowUpCircle size={16} className="text-red-500" />}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{m.descricao || (m.tipo === 'entrada' ? 'Entrada' : 'Saída')}</p>
                      <p className="text-xs text-slate-400 capitalize">{m.forma_pagamento} · {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.tipo === 'entrada' ? '+' : '−'} {formatBRL(Number(m.valor))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Histórico de caixas fechados */}
      {historico.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Caixas Anteriores</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Abertura', 'Fechamento', 'Esperado', 'Conferido', 'Diferença'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => {
                  const dif = Number(c.saldo_informado || 0) - Number(c.saldo_calculado || 0);
                  return (
                    <tr key={c.id} className="border-b border-slate-50">
                      <td className="px-6 py-3 text-slate-500">{new Date(c.aberto_em).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-3 text-slate-500">{c.fechado_em ? new Date(c.fechado_em).toLocaleString('pt-BR') : '—'}</td>
                      <td className="px-6 py-3">{formatBRL(Number(c.saldo_calculado || 0))}</td>
                      <td className="px-6 py-3">{formatBRL(Number(c.saldo_informado || 0))}</td>
                      <td className={`px-6 py-3 font-medium ${dif === 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dif === 0 ? 'OK' : formatBRL(dif)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Abrir Caixa */}
      <Modal open={showAbrir} onClose={() => setShowAbrir(false)} title="Abrir Caixa" size="sm">
        <form onSubmit={handleAbrir} className="space-y-4">
          {unidades.length > 1 && (
            <Select label="Empresa (CNPJ)" value={aUnidade} onChange={(e) => setAUnidade(e.target.value)}
              options={unidades.map((u) => ({ value: u.id, label: u.nome_fantasia || u.razao_social }))} />
          )}
          <Input label="Dinheiro inicial (troco) R$" inputMode="numeric"
            value={formatMoedaInput(aSaldo)} onChange={(e) => setASaldo(parseMoedaInput(e.target.value))} placeholder="0,00" />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><Unlock size={14} /> Abrir Caixa</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAbrir(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Movimento */}
      <Modal open={showMov} onClose={() => setShowMov(false)} title={mTipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'} size="sm">
        <form onSubmit={handleMovimento} className="space-y-4">
          <Select label="Forma" value={mForma} onChange={(e) => setMForma(e.target.value)}
            options={FORMAS.map((f) => ({ value: f.value, label: f.label }))} />
          <Input label="Valor (R$) *" inputMode="numeric"
            value={formatMoedaInput(mValor)} onChange={(e) => setMValor(parseMoedaInput(e.target.value))} placeholder="0,00" required />
          <Input label="Descrição" value={mDescricao} onChange={(e) => setMDescricao(e.target.value)}
            placeholder={mTipo === 'entrada' ? 'Ex: Venda balcão' : 'Ex: Compra material / troco retirado'} />
          <div className="flex gap-3">
            <Button type="submit" variant={mTipo === 'entrada' ? 'success' : 'danger'} loading={saving} className="flex-1">
              {mTipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Saída'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowMov(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Fechar Caixa */}
      <Modal open={showFechar} onClose={() => setShowFechar(false)} title="Fechar Caixa" size="sm">
        <form onSubmit={handleFechar} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Saldo inicial</span><span>{formatBRL(saldoInicial)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">+ Entradas em dinheiro</span><span className="text-green-600">{formatBRL(entradasDinheiro)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">− Saídas em dinheiro</span><span className="text-red-600">{formatBRL(saidasDinheiro)}</span></div>
            <div className="flex justify-between font-bold border-t border-slate-200 pt-1 mt-1"><span>Dinheiro esperado</span><span>{formatBRL(saldoDinheiro)}</span></div>
          </div>
          <Input label="Dinheiro conferido na gaveta R$ *" inputMode="numeric"
            value={formatMoedaInput(fSaldoInformado)} onChange={(e) => setFSaldoInformado(parseMoedaInput(e.target.value))} placeholder="0,00" required />
          {(() => {
            const dif = fSaldoInformado - saldoDinheiro;
            if (fSaldoInformado === 0) return null;
            return (
              <div className={`p-2 rounded-lg text-sm text-center ${dif === 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {dif === 0 ? '✓ Caixa bate certinho' : `Diferença de ${formatBRL(dif)} (${dif > 0 ? 'sobra' : 'falta'})`}
              </div>
            );
          })()}
          <Input label="Observação" value={fObs} onChange={(e) => setFObs(e.target.value)} />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1"><Lock size={14} /> Fechar Caixa</Button>
            <Button type="button" variant="secondary" onClick={() => setShowFechar(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
