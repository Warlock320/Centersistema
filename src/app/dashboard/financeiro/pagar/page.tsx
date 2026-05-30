'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Combobox } from '@/components/ui/Combobox';
import { usePermissions } from '@/components/PermissionsProvider';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import { Plus, CheckCircle, XCircle, Zap, FileClock, Layers, Repeat, Pencil } from 'lucide-react';
import type {
  ContaPagar, ContaPagarStatus, Fornecedor,
  PlanoContas, ContaBancaria, Unidade,
} from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

type TipoLancamento = 'avista' | 'prazo' | 'parcelado' | 'recorrente';

const TIPOS: { value: TipoLancamento; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'avista', label: 'À vista', desc: 'Pagamento imediato (ex: conta de água paga)', icon: Zap },
  { value: 'prazo', label: 'A prazo / Boleto', desc: 'Vence depois — fica pendente até pagar', icon: FileClock },
  { value: 'parcelado', label: 'Parcelado', desc: 'Gera N parcelas mensais', icon: Layers },
  { value: 'recorrente', label: 'Recorrente', desc: 'Gera os lançamentos dos próximos meses', icon: Repeat },
];

const STATUS_COLORS: Record<ContaPagarStatus, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-blue-100 text-blue-700',
  pago: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-500',
};
const STATUS_LABELS: Record<ContaPagarStatus, string> = {
  pendente: 'Pendente', aprovado: 'Aprovado', pago: 'Pago', cancelado: 'Cancelado',
};

export default function ContasPagarPage() {
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [categorias, setCategorias] = useState<PlanoContas[]>([]);
  const [bancos, setBancos] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterUnidade, setFilterUnidade] = useState('');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [selected, setSelected] = useState<ContaPagar | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  // Form
  const [tipo, setTipo] = useState<TipoLancamento>('prazo');
  const [fUnidade, setFUnidade] = useState('');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fCategoria, setFCategoria] = useState('');
  const [fDescricao, setFDescricao] = useState('');
  const [fValor, setFValor] = useState(0);
  const [fVencimento, setFVencimento] = useState('');
  const [fPagamento, setFPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [fParcelas, setFParcelas] = useState('2');
  const [fDiaVenc, setFDiaVenc] = useState('10');
  const [fMeses, setFMeses] = useState('12');

  // Baixa
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split('T')[0]);
  const [baixaBanco, setBaixaBanco] = useState('');

  const supabase = createClient();
  const { can } = usePermissions();
  const podePagar = can('edit_financeiro');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [conts, forns, unis, cats, bks] = await Promise.all([
      supabase.from('contas_pagar').select('*, fornecedores(nome)').order('data_vencimento'),
      supabase.from('fornecedores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('unidades').select('*').eq('ativo', true).order('padrao', { ascending: false }),
      supabase.from('plano_contas').select('*').eq('tipo', 'despesa').eq('ativo', true).order('codigo'),
      supabase.from('v_saldo_bancario').select('*').eq('ativo', true).order('nome'),
    ]);
    setContas(conts.data as ContaPagar[] || []);
    setFornecedores(forns.data as Fornecedor[] || []);
    setUnidades(unis.data as Unidade[] || []);
    setCategorias(cats.data as PlanoContas[] || []);
    setBancos(bks.data as ContaBancaria[] || []);
    setLoading(false);
  }

  function openForm() {
    setEditandoId(null);
    setTipo('prazo');
    const padrao = unidades.find((u) => u.padrao) || unidades[0];
    setFUnidade(padrao?.id || '');
    setFFornecedor(''); setFCategoria(''); setFDescricao(''); setFValor(0);
    setFVencimento(''); setFPagamento(new Date().toISOString().split('T')[0]);
    setFParcelas('2'); setFDiaVenc('10'); setFMeses('12');
    setShowForm(true);
  }

  function openEditar(c: ContaPagar) {
    setEditandoId(c.id);
    setTipo('prazo');
    setFUnidade(c.unidade_id || '');
    setFFornecedor(c.fornecedor_id || '');
    setFCategoria(c.plano_contas_id || '');
    setFDescricao(c.descricao);
    setFValor(Number(c.valor));
    setFVencimento(c.data_vencimento);
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (fValor <= 0) { alert('Informe o valor.'); return; }
    setSaving(true);

    // Edição de um lançamento existente
    if (editandoId) {
      await supabase.from('contas_pagar').update({
        unidade_id: fUnidade || null,
        fornecedor_id: fFornecedor || null,
        plano_contas_id: fCategoria || null,
        descricao: fDescricao || 'Despesa',
        valor: fValor,
        data_vencimento: fVencimento,
        updated_at: new Date().toISOString(),
      }).eq('id', editandoId);
      setSaving(false);
      setShowForm(false);
      fetchAll();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    const empresaId = (usr as { empresa_id: string })!.empresa_id;

    const comum = {
      empresa_id: empresaId,
      unidade_id: fUnidade || null,
      fornecedor_id: fFornecedor || null,
      plano_contas_id: fCategoria || null,
      descricao: fDescricao || 'Despesa',
    };

    if (tipo === 'avista') {
      await supabase.from('contas_pagar').insert({
        ...comum, valor: fValor, data_vencimento: fPagamento,
        data_pagamento: fPagamento, valor_pago: fValor, status: 'pago',
      });
    } else if (tipo === 'prazo') {
      await supabase.from('contas_pagar').insert({
        ...comum, valor: fValor, data_vencimento: fVencimento || fPagamento, status: 'pendente',
      });
    } else if (tipo === 'parcelado') {
      const parcelas = Math.max(2, parseInt(fParcelas) || 2);
      const grupo = crypto.randomUUID();
      const valorParcela = parseFloat((fValor / parcelas).toFixed(2));
      const base = new Date(fVencimento || new Date().toISOString().split('T')[0]);
      const rows = Array.from({ length: parcelas }, (_, i) => {
        const venc = new Date(base);
        venc.setMonth(venc.getMonth() + i);
        return {
          ...comum, descricao: `${comum.descricao} (${i + 1}/${parcelas})`,
          valor: valorParcela, data_vencimento: venc.toISOString().split('T')[0],
          status: 'pendente' as const, numero_parcela: i + 1, total_parcelas: parcelas, grupo_parcelas: grupo,
        };
      });
      await supabase.from('contas_pagar').insert(rows);
    } else {
      // recorrente: gera N meses no dia de vencimento
      const meses = Math.max(1, parseInt(fMeses) || 12);
      const dia = Math.min(28, Math.max(1, parseInt(fDiaVenc) || 10));
      const grupo = crypto.randomUUID();
      const hoje = new Date();
      const rows = Array.from({ length: meses }, (_, i) => {
        const venc = new Date(hoje.getFullYear(), hoje.getMonth() + i, dia);
        return {
          ...comum, descricao: `${comum.descricao} (recorrente)`,
          valor: fValor, data_vencimento: venc.toISOString().split('T')[0],
          status: 'pendente' as const, grupo_parcelas: grupo,
        };
      });
      await supabase.from('contas_pagar').insert(rows);
    }

    setSaving(false);
    setShowForm(false);
    fetchAll();
  }

  function openBaixa(c: ContaPagar) {
    setSelected(c);
    setBaixaData(new Date().toISOString().split('T')[0]);
    setBaixaBanco('');
    setShowBaixa(true);
  }

  async function handleBaixa(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setActing(true);
    await supabase.rpc('baixar_conta_pagar', {
      p_id: selected.id, p_data_pagamento: baixaData, p_valor_pago: selected.valor,
      p_juros: 0, p_desconto: 0, p_conta_bancaria: baixaBanco || null,
    });
    setActing(false);
    setShowBaixa(false);
    setSelected(null);
    fetchAll();
  }

  async function handleCancel() {
    if (!selected) return;
    setActing(true);
    await supabase.from('contas_pagar').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', selected.id);
    setActing(false);
    setShowCancel(false);
    setSelected(null);
    fetchAll();
  }

  const filtered = contas.filter((c) => {
    const matchS = !filterStatus || c.status === filterStatus;
    const matchU = !filterUnidade || c.unidade_id === filterUnidade;
    const q = search.toLowerCase();
    const forn = (c as ContaPagar & { fornecedores?: { nome: string } }).fornecedores?.nome || '';
    const matchQ = !q || c.descricao.toLowerCase().includes(q) || forn.toLowerCase().includes(q);
    return matchS && matchU && matchQ;
  });

  const totais = filtered.reduce((acc, c) => {
    if (c.status === 'pago') acc.pago += Number(c.valor_pago || c.valor);
    else if (c.status !== 'cancelado') acc.aPagar += c.valor;
    return acc;
  }, { pago: 0, aPagar: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas a Pagar</h1>
          <p className="text-slate-500 text-sm">
            A pagar: <strong className="text-red-600">{formatBRL(totais.aPagar)}</strong> · Pago: <strong className="text-green-600">{formatBRL(totais.pago)}</strong>
          </p>
        </div>
        <Button onClick={openForm}><Plus size={16} /> Nova Despesa</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input type="text" placeholder="Buscar por descrição ou fornecedor..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-44 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
          {unidades.length > 1 && (
            <select value={filterUnidade} onChange={(e) => setFilterUnidade(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Todas as empresas</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome_fantasia || u.razao_social}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Fornecedor / Descrição', 'Vencimento', 'Valor', 'Status', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const forn = (c as ContaPagar & { fornecedores?: { nome: string } }).fornecedores;
                  const isVencido = c.status !== 'pago' && c.status !== 'cancelado' && new Date(c.data_vencimento) < new Date();
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-900">{forn?.nome || '—'}</p>
                        <p className="text-xs text-slate-400">{c.descricao}</p>
                      </td>
                      <td className={`px-6 py-3 ${isVencido ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                        {isVencido && <span className="ml-1 text-xs">vencido</span>}
                      </td>
                      <td className="px-6 py-3 font-bold text-slate-900">{formatBRL(c.valor)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {(c.status === 'pendente' || c.status === 'aprovado') && podePagar && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="success" size="sm" onClick={() => openBaixa(c)}>
                              <CheckCircle size={13} /> Pagar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditar(c)} title="Editar">
                              <Pencil size={13} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelected(c); setShowCancel(true); }}>
                              <XCircle size={13} />
                            </Button>
                          </div>
                        )}
                        {c.status === 'pago' && c.data_pagamento && (
                          <span className="text-xs text-slate-400">{new Date(c.data_pagamento).toLocaleDateString('pt-BR')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400">Nenhum lançamento. Clique em &quot;Nova Despesa&quot;.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nova/Editar Despesa Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editandoId ? 'Editar Despesa' : 'Nova Despesa'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Tipo (oculto na edição) */}
          {!editandoId && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIPOS.map((t) => {
                  const Icon = t.icon;
                  const active = tipo === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${active ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
                      <p className="text-sm font-medium text-slate-800 mt-1">{t.label}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 -mt-2">{TIPOS.find((t) => t.value === tipo)?.desc}</p>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            {unidades.length > 1 && (
              <Select label="Empresa (CNPJ) *" value={fUnidade} onChange={(e) => setFUnidade(e.target.value)}
                options={unidades.map((u) => ({ value: u.id, label: u.nome_fantasia || u.razao_social }))} required />
            )}
            <Combobox label="Fornecedor" value={fFornecedor} onChange={setFFornecedor}
              options={fornecedores.map((f) => ({ value: f.id, label: f.nome }))}
              placeholder="Buscar fornecedor..." />
            <Combobox label="Categoria (despesa)" value={fCategoria} onChange={setFCategoria}
              options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
              placeholder="Buscar categoria..." />
          </div>

          <Input label="Descrição *" value={fDescricao} onChange={(e) => setFDescricao(e.target.value)}
            placeholder="Ex: Conta de água / Boleto fornecedor X" required />

          <div className="grid grid-cols-2 gap-4">
            <Input label={tipo === 'parcelado' ? 'Valor Total (R$) *' : 'Valor (R$) *'} inputMode="numeric"
              value={formatMoedaInput(fValor)} onChange={(e) => setFValor(parseMoedaInput(e.target.value))}
              placeholder="0,00" required />

            {tipo === 'avista' && (
              <Input label="Data do Pagamento *" type="date" value={fPagamento} onChange={(e) => setFPagamento(e.target.value)} required />
            )}
            {tipo === 'prazo' && (
              <Input label="Data de Vencimento *" type="date" value={fVencimento} onChange={(e) => setFVencimento(e.target.value)} required />
            )}
            {tipo === 'parcelado' && (
              <Input label="1º Vencimento *" type="date" value={fVencimento} onChange={(e) => setFVencimento(e.target.value)} required />
            )}
          </div>

          {tipo === 'parcelado' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <Input label="Número de Parcelas" type="number" min="2" max="36" value={fParcelas} onChange={(e) => setFParcelas(e.target.value)} />
              {fValor > 0 && <p className="text-sm text-blue-700">{fParcelas}x de {formatBRL(fValor / (parseInt(fParcelas) || 2))} (mensais)</p>}
            </div>
          )}
          {tipo === 'recorrente' && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg grid grid-cols-2 gap-3">
              <Input label="Dia do vencimento" type="number" min="1" max="28" value={fDiaVenc} onChange={(e) => setFDiaVenc(e.target.value)} />
              <Input label="Gerar quantos meses" type="number" min="1" max="36" value={fMeses} onChange={(e) => setFMeses(e.target.value)} />
              <p className="col-span-2 text-sm text-purple-700">
                {fValor > 0 && `${fMeses} lançamentos de ${formatBRL(fValor)}, todo dia ${fDiaVenc}`}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">
              {tipo === 'avista' ? 'Registrar pagamento' : 'Lançar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Baixa Modal */}
      <Modal open={showBaixa} onClose={() => setShowBaixa(false)} title="Registrar Pagamento" size="sm">
        <form onSubmit={handleBaixa} className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
            {selected?.descricao}<br />Valor: <strong>{formatBRL(selected?.valor || 0)}</strong>
          </div>
          <Input label="Data do Pagamento *" type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} required />
          <Select label="Conta de Débito" value={baixaBanco} onChange={(e) => setBaixaBanco(e.target.value)}
            options={bancos.map((b) => ({ value: b.id, label: `${b.nome}${b.saldo_atual !== undefined ? ` — ${formatBRL(b.saldo_atual)}` : ''}` }))} />
          <div className="flex gap-3">
            <Button type="submit" variant="success" loading={acting} className="flex-1">Confirmar Pagamento</Button>
            <Button type="button" variant="secondary" onClick={() => setShowBaixa(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      <Confirm open={showCancel} title="Cancelar lançamento"
        message="Este lançamento será cancelado."
        confirmLabel="Confirmar" loading={acting}
        onConfirm={handleCancel} onCancel={() => setShowCancel(false)} />
    </div>
  );
}
