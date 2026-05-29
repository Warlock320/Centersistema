'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Plus, CheckCircle, ThumbsUp, XCircle } from 'lucide-react';
import type {
  ContaPagar, ContaPagarStatus, Fornecedor,
  PlanoContas, CentroCusto, ContaBancaria, Usuario
} from '@/types/database.types';
import { can, resolveRoles } from '@/lib/permissions';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

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
  const [planos, setPlanos] = useState<PlanoContas[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [bancos, setBancos] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pendente');
  const [search, setSearch] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [selected, setSelected] = useState<ContaPagar | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const [formFornId, setFormFornId] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formEmissao, setFormEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [formVencimento, setFormVencimento] = useState('');
  const [formPlano, setFormPlano] = useState('');
  const [formCentro, setFormCentro] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formParcelas, setFormParcelas] = useState('1');

  const [baixaData, setBaixaData] = useState(new Date().toISOString().split('T')[0]);
  const [baixaValor, setBaixaValor] = useState('');
  const [baixaJuros, setBaixaJuros] = useState('0');
  const [baixaDesconto, setBaixaDesconto] = useState('0');
  const [baixaBanco, setBaixaBanco] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: usr } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
      setUsuario(usr as Usuario);
    }
    setLoading(true);
    const [contsData, fornsData, planosData, centrosData, bancosData] = await Promise.all([
      supabase.from('contas_pagar').select('*, fornecedores(nome)').order('data_vencimento'),
      supabase.from('fornecedores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('plano_contas').select('*').eq('tipo', 'despesa').eq('ativo', true).order('codigo'),
      supabase.from('centros_custo').select('*').eq('ativo', true).order('nome'),
      supabase.from('v_saldo_bancario').select('*').eq('ativo', true).order('nome'),
    ]);
    setContas(contsData.data as ContaPagar[] || []);
    setFornecedores(fornsData.data as Fornecedor[] || []);
    setPlanos(planosData.data as PlanoContas[] || []);
    setCentros(centrosData.data as CentroCusto[] || []);
    setBancos(bancosData.data as ContaBancaria[] || []);
    setLoading(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    const empresaId = (usr as { empresa_id: string })!.empresa_id;

    const parcelas = Math.max(1, parseInt(formParcelas) || 1);
    const valorParcela = parseFloat(formValor) / parcelas;
    const grupoId = parcelas > 1 ? crypto.randomUUID() : null;
    const baseDate = new Date(formVencimento);

    const rows = Array.from({ length: parcelas }, (_, i) => {
      const venc = new Date(baseDate);
      venc.setMonth(venc.getMonth() + i);
      return {
        empresa_id: empresaId,
        fornecedor_id: formFornId || null,
        plano_contas_id: formPlano || null,
        centro_custo_id: formCentro || null,
        descricao: parcelas > 1 ? `${formDescricao} (${i + 1}/${parcelas})` : formDescricao,
        valor: parseFloat(valorParcela.toFixed(2)),
        data_emissao: formEmissao,
        data_vencimento: venc.toISOString().split('T')[0],
        numero_parcela: i + 1,
        total_parcelas: parcelas,
        grupo_parcelas: grupoId,
        observacoes: formObs || null,
      };
    });

    await supabase.from('contas_pagar').insert(rows);
    setSaving(false);
    setShowForm(false);
    resetForm();
    fetchAll();
  }

  async function handleAprovar(c: ContaPagar) {
    setActing(true);
    await supabase.rpc('aprovar_conta_pagar', { p_id: c.id });
    setActing(false);
    fetchAll();
  }

  async function handleBaixa(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setActing(true);
    await supabase.rpc('baixar_conta_pagar', {
      p_id: selected.id,
      p_data_pagamento: baixaData,
      p_valor_pago: parseFloat(baixaValor),
      p_juros: parseFloat(baixaJuros) || 0,
      p_desconto: parseFloat(baixaDesconto) || 0,
      p_conta_bancaria: baixaBanco || null,
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

  function resetForm() {
    setFormFornId(''); setFormDescricao(''); setFormValor('');
    setFormVencimento(''); setFormPlano(''); setFormCentro('');
    setFormObs(''); setFormParcelas('1');
  }

  function openBaixa(c: ContaPagar) {
    setSelected(c);
    setBaixaValor(String(c.valor));
    setBaixaData(new Date().toISOString().split('T')[0]);
    setBaixaJuros('0'); setBaixaDesconto('0'); setBaixaBanco('');
    setShowBaixa(true);
  }

  const filtered = contas.filter((c) => {
    const matchS = !filterStatus || c.status === filterStatus;
    const q = search.toLowerCase();
    const matchQ = !q || c.descricao.toLowerCase().includes(q) || ((c as ContaPagar & { fornecedores?: { nome: string } }).fornecedores?.nome || '').toLowerCase().includes(q);
    return matchS && matchQ;
  });

  const roles = resolveRoles(usuario || {});
  const podeAprovar = can(roles, 'approve_contas_pagar'); // admin, gestor, financeiro
  const podePagar = can(roles, 'edit_financeiro');        // admin, financeiro
  const totais = filtered.reduce((acc, c) => {
    if (c.status === 'pendente' || c.status === 'aprovado') acc.pendente += c.valor;
    if (c.status === 'pago') acc.pago += Number(c.valor_pago || c.valor);
    return acc;
  }, { pendente: 0, pago: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas a Pagar</h1>
          <p className="text-slate-500 text-sm">
            {filtered.length} lançamento(s) · A pagar: {formatBRL(totais.pendente)} · Pago: {formatBRL(totais.pago)}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16} /> Novo Lançamento</Button>
      </div>

      {!podeAprovar && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          Você pode visualizar e registrar lançamentos. A aprovação e o pagamento são feitos pelo financeiro ou gestor.
        </div>
      )}
      {podeAprovar && !podePagar && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          Você pode aprovar lançamentos, mas o pagamento (baixa) é feito pelo financeiro.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input type="text" placeholder="Buscar por descrição ou fornecedor..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="aprovado">Aprovado</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
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
                        <p className="text-xs text-slate-400">{c.descricao}
                          {c.total_parcelas > 1 && ` (${c.numero_parcela}/${c.total_parcelas})`}
                        </p>
                      </td>
                      <td className={`px-6 py-3 ${isVencido ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                        {isVencido && <span className="ml-1 text-xs text-red-500">vencido</span>}
                      </td>
                      <td className="px-6 py-3 font-bold text-slate-900">{formatBRL(c.valor)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1 justify-end">
                          {c.status === 'pendente' && podeAprovar && (
                            <Button variant="secondary" size="sm" onClick={() => handleAprovar(c)} loading={acting}>
                              <ThumbsUp size={13} /> Aprovar
                            </Button>
                          )}
                          {c.status === 'aprovado' && podePagar && (
                            <Button variant="success" size="sm" onClick={() => openBaixa(c)}>
                              <CheckCircle size={13} /> Pagar
                            </Button>
                          )}
                          {(c.status === 'pendente' || c.status === 'aprovado') && podePagar && (
                            <Button variant="ghost" size="sm" onClick={() => { setSelected(c); setShowCancel(true); }}>
                              <XCircle size={13} />
                            </Button>
                          )}
                          {c.status === 'pago' && (
                            <span className="text-xs text-slate-400">
                              {c.data_pagamento && new Date(c.data_pagamento).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400">Nenhum lançamento encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Novo Lançamento Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Nova Conta a Pagar" size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Select label="Fornecedor" value={formFornId} onChange={(e) => setFormFornId(e.target.value)}
            options={fornecedores.map((f) => ({ value: f.id, label: f.nome }))} />
          <Input label="Descrição *" value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} required
            placeholder="Ex: Fatura de energia elétrica" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor Total (R$) *" type="number" step="0.01" min="0.01"
              value={formValor} onChange={(e) => setFormValor(e.target.value)} required />
            <Input label="Nº de Parcelas" type="number" min="1" max="60"
              value={formParcelas} onChange={(e) => setFormParcelas(e.target.value)} />
            <Input label="Data de Emissão" type="date" value={formEmissao} onChange={(e) => setFormEmissao(e.target.value)} />
            <Input label="1ª Data de Vencimento *" type="date" value={formVencimento}
              onChange={(e) => setFormVencimento(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Plano de Contas" value={formPlano} onChange={(e) => setFormPlano(e.target.value)}
              options={planos.map((p) => ({ value: p.id, label: `${p.codigo} - ${p.nome}` }))} />
            <Select label="Centro de Custo" value={formCentro} onChange={(e) => setFormCentro(e.target.value)}
              options={centros.map((c) => ({ value: c.id, label: c.nome }))} />
          </div>
          <Textarea label="Observações" value={formObs} onChange={(e) => setFormObs(e.target.value)} />
          {parseInt(formParcelas) > 1 && formValor && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
              {formParcelas}x de {formatBRL(parseFloat(formValor) / parseInt(formParcelas))}
            </div>
          )}
          <p className="text-xs text-slate-400">* Lançamento criado como "Pendente". Um admin deve aprovar antes do pagamento.</p>
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Baixa Modal */}
      <Modal open={showBaixa} onClose={() => setShowBaixa(false)}
        title={`Registrar Pagamento — ${(selected as ContaPagar & { fornecedores?: { nome: string } })?.fornecedores?.nome || selected?.descricao}`} size="md">
        <form onSubmit={handleBaixa} className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
            Valor original: <strong>{formatBRL(selected?.valor || 0)}</strong>
            {selected?.data_vencimento && (
              <span className="ml-2 text-slate-500">Vencimento: {new Date(selected.data_vencimento).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data do Pagamento *" type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} required />
            <Input label="Valor Pago (R$) *" type="number" step="0.01" min="0.01" value={baixaValor} onChange={(e) => setBaixaValor(e.target.value)} required />
            <Input label="Juros / Multa (R$)" type="number" step="0.01" min="0" value={baixaJuros} onChange={(e) => setBaixaJuros(e.target.value)} />
            <Input label="Desconto (R$)" type="number" step="0.01" min="0" value={baixaDesconto} onChange={(e) => setBaixaDesconto(e.target.value)} />
          </div>
          <Select label="Conta de Débito" value={baixaBanco} onChange={(e) => setBaixaBanco(e.target.value)}
            options={bancos.map((b) => ({ value: b.id, label: `${b.nome}${b.saldo_atual !== undefined ? ` — ${formatBRL(b.saldo_atual)}` : ''}` }))} />
          <div className="flex gap-3">
            <Button type="submit" variant="success" loading={acting} className="flex-1">Confirmar Pagamento</Button>
            <Button type="button" variant="secondary" onClick={() => setShowBaixa(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      <Confirm open={showCancel} title="Cancelar lançamento"
        message="Esta conta a pagar será cancelada e não será mais processada."
        confirmLabel="Sim, cancelar" loading={acting}
        onConfirm={handleCancel} onCancel={() => setShowCancel(false)} />
    </div>
  );
}
