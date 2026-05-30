'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import { Plus, CheckCircle, XCircle, CreditCard, Banknote, Smartphone, Landmark } from 'lucide-react';
import type {
  ContaReceber, ContaReceberStatus, Cliente, PlanoContas,
  ContaBancaria, Unidade, FormaPagamento,
} from '@/types/database.types';

function formatBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const FORMA_LABEL: Record<FormaPagamento, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', debito: 'Débito',
  credito_vista: 'Crédito à Vista', credito_parcelado: 'Crédito Parcelado',
  boleto: 'Boleto', transferencia: 'Transferência', outro: 'Outro',
};
const FORMA_ICON: Partial<Record<FormaPagamento, React.ElementType>> = {
  pix: Smartphone, dinheiro: Banknote, debito: CreditCard,
  credito_vista: CreditCard, credito_parcelado: CreditCard,
  boleto: Landmark, transferencia: Landmark,
};
// Formas que entram como recebido na hora
const A_VISTA: FormaPagamento[] = ['pix', 'dinheiro', 'debito', 'credito_vista'];

const STATUS_COLORS: Record<ContaReceberStatus, string> = {
  pendente: 'bg-yellow-100 text-yellow-700',
  pago: 'bg-green-100 text-green-700',
  cancelado: 'bg-slate-100 text-slate-500',
};

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [categorias, setCategorias] = useState<PlanoContas[]>([]);
  const [bancos, setBancos] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterUnidade, setFilterUnidade] = useState('');
  const [search, setSearch] = useState('');

  const [showVenda, setShowVenda] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [selected, setSelected] = useState<ContaReceber | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  // Form venda
  const [vData, setVData] = useState(new Date().toISOString().split('T')[0]);
  const [vUnidade, setVUnidade] = useState('');
  const [vCliente, setVCliente] = useState('');
  const [vCategoria, setVCategoria] = useState('');
  const [vValor, setVValor] = useState(0);
  const [vForma, setVForma] = useState<FormaPagamento>('pix');
  const [vParcelas, setVParcelas] = useState('2');
  const [vVencimento, setVVencimento] = useState('');
  const [vDescricao, setVDescricao] = useState('');

  // Baixa
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split('T')[0]);
  const [baixaBanco, setBaixaBanco] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [conts, clis, unis, cats, bks] = await Promise.all([
      supabase.from('contas_receber').select('*, clientes(nome)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('unidades').select('*').eq('ativo', true).order('padrao', { ascending: false }),
      supabase.from('plano_contas').select('*').eq('tipo', 'receita').eq('ativo', true).order('codigo'),
      supabase.from('v_saldo_bancario').select('*').eq('ativo', true).order('nome'),
    ]);
    setContas(conts.data as ContaReceber[] || []);
    setClientes(clis.data as Cliente[] || []);
    const uniList = unis.data as Unidade[] || [];
    setUnidades(uniList);
    setCategorias(cats.data as PlanoContas[] || []);
    setBancos(bks.data as ContaBancaria[] || []);
    setLoading(false);
  }

  function openVenda() {
    setVData(new Date().toISOString().split('T')[0]);
    const padrao = unidades.find((u) => u.padrao) || unidades[0];
    setVUnidade(padrao?.id || '');
    setVCliente(''); setVCategoria(''); setVValor(0); setVForma('pix');
    setVParcelas('2'); setVVencimento(''); setVDescricao('');
    setShowVenda(true);
  }

  async function handleRegistrarVenda(e: FormEvent) {
    e.preventDefault();
    if (vValor <= 0) { alert('Informe o valor da venda.'); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    const empresaId = (usr as { empresa_id: string })!.empresa_id;
    const cliente = clientes.find((c) => c.id === vCliente);
    const descricaoBase = vDescricao || `Venda${cliente ? ' - ' + cliente.nome : ''}`;

    const comum = {
      empresa_id: empresaId,
      unidade_id: vUnidade || null,
      cliente_id: vCliente || null,
      plano_contas_id: vCategoria || null,
      forma_pagamento: vForma,
      data_emissao: vData,
    };

    if (A_VISTA.includes(vForma)) {
      // Recebido na hora
      await supabase.from('contas_receber').insert({
        ...comum, descricao: descricaoBase, valor: vValor,
        data_vencimento: vData, data_pagamento: vData, valor_pago: vValor, status: 'pago',
      });
    } else if (vForma === 'credito_parcelado') {
      const parcelas = Math.max(2, parseInt(vParcelas) || 2);
      const grupo = crypto.randomUUID();
      const valorParcela = parseFloat((vValor / parcelas).toFixed(2));
      const base = new Date(vData);
      const rows = Array.from({ length: parcelas }, (_, i) => {
        const venc = new Date(base);
        venc.setMonth(venc.getMonth() + i + 1); // 1ª parcela ~30 dias depois
        return {
          ...comum,
          descricao: `${descricaoBase} (${i + 1}/${parcelas})`,
          valor: valorParcela,
          data_vencimento: venc.toISOString().split('T')[0],
          status: 'pendente' as const,
          numero_parcela: i + 1,
          total_parcelas: parcelas,
          grupo_parcelas: grupo,
        };
      });
      await supabase.from('contas_receber').insert(rows);
    } else {
      // Boleto / transferência a prazo: 1 lançamento pendente
      await supabase.from('contas_receber').insert({
        ...comum, descricao: descricaoBase, valor: vValor,
        data_vencimento: vVencimento || vData, status: 'pendente',
      });
    }

    setSaving(false);
    setShowVenda(false);
    fetchAll();
  }

  function openBaixa(c: ContaReceber) {
    setSelected(c);
    setBaixaData(new Date().toISOString().split('T')[0]);
    setBaixaBanco('');
    setShowBaixa(true);
  }

  async function handleBaixa(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setActing(true);
    await supabase.rpc('baixar_conta_receber', {
      p_id: selected.id,
      p_data_pagamento: baixaData,
      p_valor_pago: selected.valor,
      p_juros: 0,
      p_desconto: 0,
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
    await supabase.from('contas_receber').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', selected.id);
    setActing(false);
    setShowCancel(false);
    setSelected(null);
    fetchAll();
  }

  const filtered = contas.filter((c) => {
    const matchS = !filterStatus || c.status === filterStatus;
    const matchU = !filterUnidade || c.unidade_id === filterUnidade;
    const q = search.toLowerCase();
    const matchQ = !q || c.descricao.toLowerCase().includes(q) || (c.clientes?.nome || '').toLowerCase().includes(q);
    return matchS && matchU && matchQ;
  });

  const totais = filtered.reduce((acc, c) => {
    if (c.status === 'pago') acc.recebido += Number(c.valor_pago || c.valor);
    if (c.status === 'pendente') acc.aReceber += c.valor;
    return acc;
  }, { recebido: 0, aReceber: 0 });

  const formaOptions = (Object.keys(FORMA_LABEL) as FormaPagamento[])
    .filter((f) => f !== 'outro')
    .map((f) => ({ value: f, label: FORMA_LABEL[f] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas a Receber</h1>
          <p className="text-slate-500 text-sm">
            Recebido: <strong className="text-green-600">{formatBRL(totais.recebido)}</strong> · A receber: <strong className="text-yellow-600">{formatBRL(totais.aReceber)}</strong>
          </p>
        </div>
        <Button onClick={openVenda}><Plus size={16} /> Registrar Venda</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input type="text" placeholder="Buscar por cliente ou descrição..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-44 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todos os status</option>
            <option value="pago">Recebido</option>
            <option value="pendente">A receber</option>
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
                  {['Cliente / Descrição', 'Forma', 'Vencimento', 'Valor', 'Status', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const Icon = c.forma_pagamento ? FORMA_ICON[c.forma_pagamento] : null;
                  const isVencido = c.status === 'pendente' && new Date(c.data_vencimento) < new Date();
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-900">{c.clientes?.nome || '—'}</p>
                        <p className="text-xs text-slate-400">{c.descricao}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          {Icon && <Icon size={14} className="text-slate-400" />}
                          {c.forma_pagamento ? FORMA_LABEL[c.forma_pagamento] : '—'}
                        </span>
                      </td>
                      <td className={`px-6 py-3 ${isVencido ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {c.status === 'pago' && c.data_pagamento
                          ? new Date(c.data_pagamento).toLocaleDateString('pt-BR')
                          : new Date(c.data_vencimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-3 font-bold text-slate-900">{formatBRL(c.valor)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                          {c.status === 'pago' ? 'Recebido' : c.status === 'pendente' ? 'A receber' : 'Cancelado'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {c.status === 'pendente' && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="success" size="sm" onClick={() => openBaixa(c)}>
                              <CheckCircle size={13} /> Receber
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelected(c); setShowCancel(true); }}>
                              <XCircle size={13} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">Nenhum lançamento. Clique em &quot;Registrar Venda&quot;.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registrar Venda Modal */}
      <Modal open={showVenda} onClose={() => setShowVenda(false)} title="Registrar Venda" size="md">
        <form onSubmit={handleRegistrarVenda} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Data *" type="date" value={vData} onChange={(e) => setVData(e.target.value)} required />
            {unidades.length > 1 ? (
              <Select label="Empresa (CNPJ) *" value={vUnidade} onChange={(e) => setVUnidade(e.target.value)}
                options={unidades.map((u) => ({ value: u.id, label: u.nome_fantasia || u.razao_social }))} required />
            ) : <div />}
          </div>
          <Select label="Cliente" value={vCliente} onChange={(e) => setVCliente(e.target.value)}
            options={clientes.map((c) => ({ value: c.id, label: c.nome }))} />
          <Select label="Categoria (receita)" value={vCategoria} onChange={(e) => setVCategoria(e.target.value)}
            options={categorias.map((c) => ({ value: c.id, label: c.nome }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor Total (R$) *" inputMode="numeric"
              value={formatMoedaInput(vValor)} onChange={(e) => setVValor(parseMoedaInput(e.target.value))}
              placeholder="0,00" required />
            <Select label="Forma de Pagamento *" value={vForma} onChange={(e) => setVForma(e.target.value as FormaPagamento)}
              options={formaOptions} required />
          </div>

          {/* Campos condicionais por forma */}
          {vForma === 'credito_parcelado' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <Input label="Número de Parcelas" type="number" min="2" max="24"
                value={vParcelas} onChange={(e) => setVParcelas(e.target.value)} />
              {vValor > 0 && (
                <p className="text-sm text-blue-700">
                  {vParcelas}x de {formatBRL(vValor / (parseInt(vParcelas) || 2))} — recebimento mensal a partir de ~30 dias
                </p>
              )}
            </div>
          )}
          {(vForma === 'boleto' || vForma === 'transferencia') && (
            <Input label="Data de Vencimento" type="date" value={vVencimento} onChange={(e) => setVVencimento(e.target.value)} />
          )}
          {A_VISTA.includes(vForma) && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Pagamento à vista — entra automaticamente como <strong>Recebido</strong> na data informada.
            </div>
          )}

          <Input label="Descrição (opcional)" value={vDescricao} onChange={(e) => setVDescricao(e.target.value)}
            placeholder="Ex: Scooter modelo X / troca de óleo" />

          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">Registrar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowVenda(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Baixa Modal */}
      <Modal open={showBaixa} onClose={() => setShowBaixa(false)} title="Confirmar Recebimento" size="sm">
        <form onSubmit={handleBaixa} className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            {selected?.descricao}<br />Valor: <strong>{formatBRL(selected?.valor || 0)}</strong>
          </div>
          <Input label="Data do Recebimento *" type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} required />
          <Select label="Conta de Destino" value={baixaBanco} onChange={(e) => setBaixaBanco(e.target.value)}
            options={bancos.map((b) => ({ value: b.id, label: `${b.nome}${b.saldo_atual !== undefined ? ` — ${formatBRL(b.saldo_atual)}` : ''}` }))} />
          <div className="flex gap-3">
            <Button type="submit" variant="success" loading={acting} className="flex-1">Confirmar Recebimento</Button>
            <Button type="button" variant="secondary" onClick={() => setShowBaixa(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      <Confirm open={showCancel} title="Cancelar recebimento"
        message="Este recebimento será cancelado."
        confirmLabel="Confirmar" loading={acting}
        onConfirm={handleCancel} onCancel={() => setShowCancel(false)} />
    </div>
  );
}
