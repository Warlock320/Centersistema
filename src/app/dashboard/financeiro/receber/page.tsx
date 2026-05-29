'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Plus, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  ContaReceber, ContaReceberStatus, Cliente,
  PlanoContas, CentroCusto, ContaBancaria, HistoricoCobranca
} from '@/types/database.types';

type CobrancaRua = 'ok' | 'preventiva' | 'vencimento' | 'leve' | 'medio' | 'grave';

function getRua(conta: ContaReceber): CobrancaRua {
  if (conta.status !== 'pendente') return 'ok';
  const diff = Math.floor((Date.now() - new Date(conta.data_vencimento).getTime()) / 86400000);
  if (diff < -5) return 'ok';
  if (diff <= -1) return 'preventiva';
  if (diff === 0) return 'vencimento';
  if (diff <= 3) return 'leve';
  if (diff <= 15) return 'medio';
  return 'grave';
}

const RUA_CONFIG: Record<CobrancaRua, { label: string; bg: string; text: string }> = {
  ok: { label: 'Em dia', bg: 'bg-slate-100', text: 'text-slate-500' },
  preventiva: { label: 'Preventiva', bg: 'bg-blue-100', text: 'text-blue-700' },
  vencimento: { label: 'Vence hoje', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  leve: { label: 'Atraso leve', bg: 'bg-orange-100', text: 'text-orange-700' },
  medio: { label: 'Atraso médio', bg: 'bg-red-100', text: 'text-red-700' },
  grave: { label: 'CRÍTICO', bg: 'bg-red-200', text: 'text-red-800' },
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_COLORS: Record<ContaReceberStatus, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  pago: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-500',
};

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [planos, setPlanos] = useState<PlanoContas[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [bancos, setBancos] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pendente');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showCobranca, setShowCobranca] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [selected, setSelected] = useState<ContaReceber | null>(null);
  const [historico, setHistorico] = useState<HistoricoCobranca[]>([]);

  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  // Form state
  const [formClienteId, setFormClienteId] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formEmissao, setFormEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [formVencimento, setFormVencimento] = useState('');
  const [formPlano, setFormPlano] = useState('');
  const [formCentro, setFormCentro] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formParcelas, setFormParcelas] = useState('1');

  // Baixa state
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split('T')[0]);
  const [baixaValor, setBaixaValor] = useState('');
  const [baixaJuros, setBaixaJuros] = useState('0');
  const [baixaDesconto, setBaixaDesconto] = useState('0');
  const [baixaBanco, setBaixaBanco] = useState('');

  // Cobrança state
  const [cobrancaTipo, setCobrancaTipo] = useState('leve');
  const [cobrancaCanal, setCobrancaCanal] = useState('whatsapp');
  const [cobrancaObs, setCobrancaObs] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [contsData, clisData, planosData, centrosData, bancosData] = await Promise.all([
      supabase.from('contas_receber').select('*, clientes(nome)').order('data_vencimento'),
      supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('plano_contas').select('*').eq('tipo', 'receita').eq('ativo', true).order('codigo'),
      supabase.from('centros_custo').select('*').eq('ativo', true).order('nome'),
      supabase.from('v_saldo_bancario').select('*').eq('ativo', true).order('nome'),
    ]);
    setContas(contsData.data as ContaReceber[] || []);
    setClientes(clisData.data as Cliente[] || []);
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
        cliente_id: formClienteId || null,
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

    await supabase.from('contas_receber').insert(rows);
    setSaving(false);
    setShowForm(false);
    resetForm();
    fetchAll();
  }

  async function handleBaixa(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setActing(true);
    await supabase.rpc('baixar_conta_receber', {
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

  async function handleRegistrarCobranca(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setActing(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('historico_cobrancas').insert({
      empresa_id: selected.empresa_id,
      conta_receber_id: selected.id,
      usuario_id: user?.id,
      tipo: cobrancaTipo,
      canal: cobrancaCanal,
      observacao: cobrancaObs || null,
    });
    setActing(false);
    setShowCobranca(false);
    setCobrancaObs('');
  }

  async function handleCancel() {
    if (!selected) return;
    setActing(true);
    await supabase.from('contas_receber').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', selected.id);
    setActing(false);
    setShowCancel(false);
    setSelected(null);
    fetchAll();
  }

  async function openHistorico(conta: ContaReceber) {
    setSelected(conta);
    const { data } = await supabase.from('historico_cobrancas').select('*').eq('conta_receber_id', conta.id).order('created_at', { ascending: false });
    setHistorico(data as HistoricoCobranca[] || []);
    setShowHistorico(true);
  }

  function resetForm() {
    setFormClienteId(''); setFormDescricao(''); setFormValor('');
    setFormVencimento(''); setFormPlano(''); setFormCentro('');
    setFormObs(''); setFormParcelas('1');
  }

  function openBaixa(c: ContaReceber) {
    setSelected(c);
    setBaixaValor(String(c.valor));
    setBaixaData(new Date().toISOString().split('T')[0]);
    setBaixaJuros('0'); setBaixaDesconto('0'); setBaixaBanco('');
    setShowBaixa(true);
  }

  const filtered = contas.filter((c) => {
    const matchS = !filterStatus || c.status === filterStatus;
    const q = search.toLowerCase();
    const matchQ = !q || c.descricao.toLowerCase().includes(q) || (c.clientes?.nome || '').toLowerCase().includes(q);
    return matchS && matchQ;
  });

  const totais = filtered.reduce((acc, c) => {
    acc.total += c.valor;
    if (c.status === 'pendente') acc.pendente += c.valor;
    if (c.status === 'pago') acc.pago += Number(c.valor_pago || c.valor);
    return acc;
  }, { total: 0, pendente: 0, pago: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas a Receber</h1>
          <p className="text-slate-500 text-sm">
            {filtered.length} lançamento(s) · Pendente: {formatBRL(totais.pendente)} · Recebido: {formatBRL(totais.pago)}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16} /> Novo Lançamento</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input type="text" placeholder="Buscar por descrição ou cliente..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
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
                  {['Cliente / Descrição', 'Vencimento', 'Valor', 'Status', 'Régua', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const rua = getRua(c);
                  const ruaCfg = RUA_CONFIG[rua];
                  const isVencido = rua !== 'ok' && c.status === 'pendente';
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-900">{c.clientes?.nome || '—'}</p>
                        <p className="text-xs text-slate-400">{c.descricao}
                          {c.total_parcelas > 1 && ` (${c.numero_parcela}/${c.total_parcelas})`}
                        </p>
                      </td>
                      <td className={`px-6 py-3 ${isVencido ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-3 font-bold text-slate-900">{formatBRL(c.valor)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                          {c.status === 'pendente' ? 'Pendente' : c.status === 'pago' ? 'Pago' : 'Cancelado'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {c.status === 'pendente' && (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ruaCfg.bg} ${ruaCfg.text}`}>
                            {ruaCfg.label}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1 justify-end">
                          {c.status === 'pendente' && (
                            <>
                              <Button variant="success" size="sm" onClick={() => openBaixa(c)}>
                                <CheckCircle size={13} /> Baixar
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setSelected(c); setShowCobranca(true); }}
                                title="Registrar cobrança">
                                <MessageSquare size={13} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openHistorico(c)}
                                title="Ver histórico de cobranças">
                                <ChevronDown size={13} />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setSelected(c); setShowCancel(true); }}>
                                <XCircle size={13} />
                              </Button>
                            </>
                          )}
                          {c.status === 'pago' && (
                            <div className="text-xs text-slate-400">
                              {c.data_pagamento && new Date(c.data_pagamento).toLocaleDateString('pt-BR')}
                              {c.valor_pago && c.valor_pago !== c.valor && (
                                <span className="ml-1 text-green-600">{formatBRL(c.valor_pago)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">Nenhum lançamento encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Novo Lançamento Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Nova Conta a Receber" size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Select label="Cliente" value={formClienteId} onChange={(e) => setFormClienteId(e.target.value)}
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))} />
          <Input label="Descrição *" value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} required
            placeholder="Ex: Referente ao Pedido #123" />
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
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              {formParcelas}x de {formatBRL(parseFloat(formValor) / parseInt(formParcelas))}
            </div>
          )}
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Baixa Modal */}
      <Modal open={showBaixa} onClose={() => setShowBaixa(false)} title={`Dar Baixa — ${selected?.clientes?.nome || selected?.descricao}`} size="md">
        <form onSubmit={handleBaixa} className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            Valor original: <strong>{formatBRL(selected?.valor || 0)}</strong>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data de Pagamento *" type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} required />
            <Input label="Valor Recebido (R$) *" type="number" step="0.01" min="0.01" value={baixaValor} onChange={(e) => setBaixaValor(e.target.value)} required />
            <Input label="Juros / Multa (R$)" type="number" step="0.01" min="0" value={baixaJuros} onChange={(e) => setBaixaJuros(e.target.value)} />
            <Input label="Desconto (R$)" type="number" step="0.01" min="0" value={baixaDesconto} onChange={(e) => setBaixaDesconto(e.target.value)} />
          </div>
          <Select label="Conta de Destino" value={baixaBanco} onChange={(e) => setBaixaBanco(e.target.value)}
            options={bancos.map((b) => ({ value: b.id, label: `${b.nome}${b.saldo_atual !== undefined ? ` — ${formatBRL(b.saldo_atual)}` : ''}` }))} />
          <div className="flex gap-3">
            <Button type="submit" variant="success" loading={acting} className="flex-1">Confirmar Recebimento</Button>
            <Button type="button" variant="secondary" onClick={() => setShowBaixa(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Cobrança Modal */}
      <Modal open={showCobranca} onClose={() => setShowCobranca(false)} title="Registrar Ação de Cobrança" size="md">
        <form onSubmit={handleRegistrarCobranca} className="space-y-4">
          <p className="text-sm text-slate-600">Cliente: <strong>{selected?.clientes?.nome}</strong></p>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo de Cobrança" value={cobrancaTipo} onChange={(e) => setCobrancaTipo(e.target.value)}
              options={[
                { value: 'preventiva', label: 'Preventiva (antes do venc.)' },
                { value: 'vencimento', label: 'No dia do vencimento' },
                { value: 'leve', label: 'Leve (1-3d)' },
                { value: 'medio', label: 'Médio (4-15d)' },
                { value: 'grave', label: 'Grave (15d+)' },
                { value: 'renegociacao', label: 'Renegociação' },
                { value: 'outro', label: 'Outro' },
              ]} />
            <Select label="Canal" value={cobrancaCanal} onChange={(e) => setCobrancaCanal(e.target.value)}
              options={[
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'email', label: 'E-mail' },
                { value: 'telefone', label: 'Telefone' },
                { value: 'carta', label: 'Carta/Correio' },
                { value: 'sistema', label: 'Sistema' },
              ]} />
          </div>
          <Textarea label="Observações" value={cobrancaObs} onChange={(e) => setCobrancaObs(e.target.value)}
            placeholder="Descreva o resultado do contato..." />
          <div className="flex gap-3">
            <Button type="submit" loading={acting} className="flex-1">Registrar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCobranca(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Histórico Modal */}
      <Modal open={showHistorico} onClose={() => setShowHistorico(false)} title={`Histórico de Cobranças — ${selected?.clientes?.nome}`} size="md">
        <div className="space-y-3">
          {historico.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">Nenhuma cobrança registrada</p>
          ) : historico.map((h) => (
            <div key={h.id} className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-600 capitalize">{h.tipo.replace('_', ' ')} · {h.canal}</span>
                <span className="text-xs text-slate-400">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              {h.observacao && <p className="text-sm text-slate-700">{h.observacao}</p>}
            </div>
          ))}
        </div>
      </Modal>

      <Confirm open={showCancel} title="Cancelar cobrança"
        message="Esta conta a receber será cancelada. O valor não será mais cobrado."
        confirmLabel="Confirmar cancelamento" loading={acting}
        onConfirm={handleCancel} onCancel={() => setShowCancel(false)} />
    </div>
  );
}
