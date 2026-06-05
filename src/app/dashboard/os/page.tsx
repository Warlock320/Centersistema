'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Combobox } from '@/components/ui/Combobox';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/components/PermissionsProvider';
import { formatMoedaInput, parseMoedaInput } from '@/lib/format';
import {
  Plus, Trash2, Pencil, ChevronRight, Wrench, Package as PackageIcon,
  Play, CheckCircle, XCircle, Send, Bike,
} from 'lucide-react';
import type {
  OrdemServico, OrdemServicoStatus, OsItem, Cliente, Veiculo, Produto, Usuario,
} from '@/types/database.types';

const num = (v: unknown) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const brl = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABEL: Record<OrdemServicoStatus, string> = {
  aberta: 'Aberta', em_execucao: 'Em execução', concluida: 'Concluída', entregue: 'Entregue', cancelada: 'Cancelada',
};
const STATUS_COLOR: Record<OrdemServicoStatus, string> = {
  aberta: 'bg-blue-100 text-blue-700', em_execucao: 'bg-yellow-100 text-yellow-700',
  concluida: 'bg-purple-100 text-purple-700', entregue: 'bg-green-100 text-green-700', cancelada: 'bg-slate-100 text-slate-500',
};

interface ItemForm extends Partial<OsItem> { _key: number }

export default function OrdemServicoPage() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [selected, setSelected] = useState<OrdemServico | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  // Form
  const [fCliente, setFCliente] = useState('');
  const [fVeiculo, setFVeiculo] = useState('');
  const [fTecnico, setFTecnico] = useState('');
  const [fKm, setFKm] = useState('');
  const [fProblema, setFProblema] = useState('');
  const [fDiagnostico, setFDiagnostico] = useState('');
  const [fObs, setFObs] = useState('');
  const [fDesconto, setFDesconto] = useState(0);
  const [itens, setItens] = useState<ItemForm[]>([]);

  const supabase = createClient();
  const toast = useToast();
  const { can } = usePermissions();
  const podeEditar = can('edit_os');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [os, clis, veics, prods, users] = await Promise.all([
      supabase.from('ordens_servico').select('*, clientes(nome), veiculos(modelo, placa, marca)').order('numero', { ascending: false }),
      supabase.from('clientes').select('id, nome, cpf_cnpj').eq('ativo', true).order('nome'),
      supabase.from('veiculos').select('*, clientes(nome)').eq('ativo', true).order('modelo'),
      supabase.from('produtos').select('id, nome, codigo, ref, preco, estoque, codigos_auxiliares, aplicacoes, localizacao').eq('ativo', true).order('nome'),
      supabase.from('usuarios').select('id, nome, roles, role').eq('ativo', true).order('nome'),
    ]);
    setOrdens(os.data as OrdemServico[] || []);
    setClientes(clis.data as Cliente[] || []);
    setVeiculos(veics.data as Veiculo[] || []);
    setProdutos(prods.data as Produto[] || []);
    setTecnicos(users.data as Usuario[] || []);
    setLoading(false);
  }

  function resetForm() {
    setEditandoId(null);
    setFCliente(''); setFVeiculo(''); setFTecnico(''); setFKm('');
    setFProblema(''); setFDiagnostico(''); setFObs(''); setFDesconto(0);
    setItens([]);
  }

  function openNovo() { resetForm(); setShowForm(true); }

  async function openEditar(os: OrdemServico) {
    const { data } = await supabase.from('ordens_servico').select('*, os_itens(*)').eq('id', os.id).single();
    const full = data as OrdemServico;
    setEditandoId(full.id);
    setFCliente(full.cliente_id);
    setFVeiculo(full.veiculo_id || '');
    setFTecnico(full.tecnico_id || '');
    setFKm(full.km_entrada != null ? String(full.km_entrada) : '');
    setFProblema(full.descricao_problema || '');
    setFDiagnostico(full.diagnostico || '');
    setFObs(full.observacoes || '');
    setFDesconto(Number(full.desconto) || 0);
    const its = (full.os_itens || []).sort((a, b) => a.ordem - b.ordem).map((it, i) => ({ ...it, _key: i }));
    setItens(its);
    setShowDetail(false);
    setShowForm(true);
  }

  async function openDetail(os: OrdemServico) {
    const { data } = await supabase.from('ordens_servico').select('*, clientes(*), veiculos(*), os_itens(*)').eq('id', os.id).single();
    setSelected(data as OrdemServico);
    setShowDetail(true);
  }

  // ── Itens ──────────────────────────────────────────────────────────────────
  function addItem(tipo: 'peca' | 'servico') {
    setItens((p) => [...p, { _key: Date.now() + Math.random(), tipo, descricao: '', quantidade: 1, preco_unitario: 0, total: 0, produto_id: null }]);
  }
  function removeItem(key: number) { setItens((p) => p.filter((i) => i._key !== key)); }
  function updItem(key: number, patch: Partial<ItemForm>) {
    setItens((p) => p.map((i) => {
      if (i._key !== key) return i;
      const merged = { ...i, ...patch };
      merged.total = parseFloat((num(merged.quantidade) * num(merged.preco_unitario)).toFixed(2));
      return merged;
    }));
  }
  function setItemProduto(key: number, prodId: string) {
    const prod = produtos.find((p) => p.id === prodId);
    if (!prod) { updItem(key, { produto_id: null }); return; }
    updItem(key, { produto_id: prodId, descricao: prod.nome, preco_unitario: prod.preco });
  }

  const totalPecas = itens.filter((i) => i.tipo === 'peca').reduce((s, i) => s + num(i.total), 0);
  const totalServicos = itens.filter((i) => i.tipo === 'servico').reduce((s, i) => s + num(i.total), 0);
  const totalGeral = totalPecas + totalServicos - num(fDesconto);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!fCliente) { toast.error('Selecione o cliente.'); return; }
    if (itens.length === 0) { toast.error('Adicione ao menos uma peça ou serviço.'); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    const empresaId = (usr as { empresa_id: string })!.empresa_id;

    const cab = {
      cliente_id: fCliente,
      veiculo_id: fVeiculo || null,
      tecnico_id: fTecnico || null,
      km_entrada: fKm ? parseInt(fKm) : null,
      descricao_problema: fProblema || null,
      diagnostico: fDiagnostico || null,
      observacoes: fObs || null,
      total_pecas: totalPecas,
      total_servicos: totalServicos,
      desconto: num(fDesconto),
      total: totalGeral,
    };

    let osId = editandoId;
    if (editandoId) {
      const { error } = await supabase.from('ordens_servico').update({ ...cab, updated_at: new Date().toISOString() }).eq('id', editandoId);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      await supabase.from('os_itens').delete().eq('os_id', editandoId);
    } else {
      const { data, error } = await supabase.from('ordens_servico').insert({ ...cab, empresa_id: empresaId }).select('id').single();
      if (error || !data) { toast.error('Erro: ' + (error?.message || '')); setSaving(false); return; }
      osId = (data as { id: string }).id;
    }

    if (osId) {
      await supabase.from('os_itens').insert(itens.map((it, i) => ({
        os_id: osId, tipo: it.tipo, produto_id: it.produto_id || null,
        descricao: it.descricao || '', quantidade: num(it.quantidade) || 1,
        preco_unitario: num(it.preco_unitario), total: num(it.total), ordem: i,
      })));
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    toast.success(editandoId ? 'OS atualizada!' : 'OS aberta!');
    fetchData();
  }

  async function mudarStatus(novo: OrdemServicoStatus) {
    if (!selected) return;
    setActing(true);
    const patch: Record<string, unknown> = { status: novo, updated_at: new Date().toISOString() };
    if (novo === 'concluida') patch.data_conclusao = new Date().toISOString();
    const { error } = await supabase.from('ordens_servico').update(patch).eq('id', selected.id);
    setActing(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Status atualizado!');
    setShowDetail(false);
    setSelected(null);
    fetchData();
  }

  async function faturar() {
    if (!selected) return;
    setActing(true);
    const { error } = await supabase.rpc('faturar_os', { p_os_id: selected.id });
    setActing(false);
    if (error) { toast.error('Erro ao faturar: ' + error.message); return; }
    toast.success('OS entregue! Estoque baixado e conta a receber gerada.');
    setShowDetail(false);
    setSelected(null);
    fetchData();
  }

  async function cancelar() {
    if (!selected) return;
    setActing(true);
    await supabase.from('ordens_servico').update({ status: 'cancelada', updated_at: new Date().toISOString() }).eq('id', selected.id);
    setActing(false);
    setShowCancel(false);
    setShowDetail(false);
    setSelected(null);
    toast.success('OS cancelada.');
    fetchData();
  }

  const filtered = ordens.filter((o) => {
    const q = search.toLowerCase();
    const matchQ = !q || o.clientes?.nome.toLowerCase().includes(q) || String(o.numero).includes(q) ||
      (o.veiculos?.placa || '').toLowerCase().includes(q) || (o.veiculos?.modelo || '').toLowerCase().includes(q);
    const matchS = !filterStatus || o.status === filterStatus;
    return matchQ && matchS;
  });

  const veicOptions = veiculos
    .filter((v) => !fCliente || v.cliente_id === fCliente)
    .map((v) => ({ value: v.id, label: [v.marca, v.modelo].filter(Boolean).join(' '), sublabel: v.placa || undefined, keywords: v.placa || '' }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ordens de Serviço</h1>
          <p className="text-slate-500 text-sm">{ordens.length} OS · serviços técnicos e mão de obra</p>
        </div>
        {podeEditar && <Button onClick={openNovo}><Plus size={16} /> Nova OS</Button>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input type="text" placeholder="Buscar por nº, cliente ou placa..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['#', 'Cliente', 'Veículo', 'Status', 'Total', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(o)}>
                  <td className="px-6 py-3 font-mono text-slate-500">#{o.numero}</td>
                  <td className="px-6 py-3 font-medium text-slate-900">{o.clientes?.nome}</td>
                  <td className="px-6 py-3 text-slate-600">
                    {o.veiculos ? (
                      <span className="flex items-center gap-1.5"><Bike size={13} className="text-slate-400" />{[o.veiculos.marca, o.veiculos.modelo].filter(Boolean).join(' ')}{o.veiculos.placa ? ` · ${o.veiculos.placa}` : ''}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                  <td className="px-6 py-3 font-medium">{brl(o.total)}</td>
                  <td className="px-6 py-3"><ChevronRight size={16} className="text-slate-300" /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">Nenhuma OS encontrada.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editandoId ? 'Editar OS' : 'Nova Ordem de Serviço'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Combobox label="Cliente *" value={fCliente} onChange={(v) => { setFCliente(v); setFVeiculo(''); }}
              options={clientes.map((c) => ({ value: c.id, label: c.nome, sublabel: c.cpf_cnpj || undefined }))}
              placeholder="Buscar cliente..." />
            <Combobox label="Veículo" value={fVeiculo} onChange={setFVeiculo} options={veicOptions}
              placeholder={fCliente ? 'Veículo do cliente...' : 'Selecione o cliente primeiro'} />
            <Select label="Técnico responsável" value={fTecnico} onChange={(e) => setFTecnico(e.target.value)}
              options={tecnicos.map((t) => ({ value: t.id, label: t.nome }))} />
            <Input label="KM de entrada" type="number" value={fKm} onChange={(e) => setFKm(e.target.value)} />
          </div>

          <Textarea label="Problema relatado" value={fProblema} onChange={(e) => setFProblema(e.target.value)}
            placeholder="O que o cliente relatou" />

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Peças e Serviços</label>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => addItem('peca')}><PackageIcon size={13} /> Peça</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => addItem('servico')}><Wrench size={13} /> Serviço</Button>
              </div>
            </div>

            {itens.length === 0 ? (
              <p className="text-sm text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">Adicione peças (do estoque) e serviços (mão de obra)</p>
            ) : (
              <div className="space-y-2">
                {itens.map((item) => (
                  <div key={item._key} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.tipo === 'peca' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {item.tipo === 'peca' ? 'PEÇA' : 'SERVIÇO'}
                      </span>
                      <div className="flex-1" />
                      <button type="button" onClick={() => removeItem(item._key)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={15} /></button>
                    </div>
                    {item.tipo === 'peca' ? (
                      <Combobox value={item.produto_id || ''} onChange={(v) => setItemProduto(item._key, v)}
                        placeholder="Buscar peça no estoque..."
                        options={produtos.map((p) => ({
                          value: p.id, label: p.nome,
                          sublabel: `${p.codigo ? `[${p.codigo}] ` : ''}${brl(p.preco)} · est: ${Number(p.estoque).toFixed(0)}`,
                          keywords: `${p.codigo || ''} ${p.ref || ''} ${(p.codigos_auxiliares || []).join(' ')} ${(p.aplicacoes || []).join(' ')} ${p.localizacao || ''}`,
                        }))} />
                    ) : (
                      <input value={item.descricao || ''} onChange={(e) => updItem(item._key, { descricao: e.target.value })}
                        placeholder="Descrição do serviço (ex: troca de óleo, revisão)"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-0.5">Qtd</label>
                        <input type="text" inputMode="decimal" value={item.quantidade ?? ''}
                          onChange={(e) => updItem(item._key, { quantidade: e.target.value.replace(/[^\d.,]/g, '') as unknown as number })}
                          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-0.5">Valor un. (R$)</label>
                        <input type="text" inputMode="numeric" value={formatMoedaInput(num(item.preco_unitario))}
                          onChange={(e) => updItem(item._key, { preco_unitario: parseMoedaInput(e.target.value) })}
                          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-0.5">Total</label>
                        <div className="w-full text-sm font-semibold px-2 py-2 bg-slate-50 rounded-lg text-right">{brl(num(item.total))}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totais */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Peças</span><span>{brl(totalPecas)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Serviços</span><span>{brl(totalServicos)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Desconto (R$)</span>
              <input type="text" inputMode="numeric" value={formatMoedaInput(num(fDesconto))}
                onChange={(e) => setFDesconto(parseMoedaInput(e.target.value))}
                className="w-28 text-sm text-right border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-1"><span>Total</span><span>{brl(totalGeral)}</span></div>
          </div>

          <Textarea label="Diagnóstico / Observações" value={fDiagnostico} onChange={(e) => setFDiagnostico(e.target.value)}
            placeholder="Diagnóstico técnico, peças trocadas, recomendações" />

          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">{editandoId ? 'Salvar Alterações' : 'Abrir OS'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Detalhe Modal */}
      {selected && (
        <Modal open={showDetail} onClose={() => setShowDetail(false)} title={`OS #${selected.numero}`} size="xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              {selected.status === 'entregue' && <span className="text-xs text-green-600">✓ Estoque baixado · conta a receber gerada</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-slate-50 rounded-lg p-3">
              <div><span className="text-xs text-slate-400 block">Cliente</span><p className="font-medium">{selected.clientes?.nome}</p></div>
              <div><span className="text-xs text-slate-400 block">Veículo</span><p className="font-medium">{selected.veiculos ? `${[selected.veiculos.marca, selected.veiculos.modelo].filter(Boolean).join(' ')}${selected.veiculos.placa ? ` · ${selected.veiculos.placa}` : ''}` : '—'}</p></div>
              <div><span className="text-xs text-slate-400 block">KM</span><p className="font-medium">{selected.km_entrada ?? '—'}</p></div>
              <div><span className="text-xs text-slate-400 block">Entrada</span><p className="font-medium">{new Date(selected.data_entrada).toLocaleDateString('pt-BR')}</p></div>
            </div>

            {selected.descricao_problema && (
              <div className="text-sm"><span className="text-xs text-slate-400 block mb-0.5">Problema relatado</span><p className="text-slate-700">{selected.descricao_problema}</p></div>
            )}

            <table className="w-full text-sm border border-slate-100 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>{['Tipo', 'Descrição', 'Qtd', 'Valor', 'Total'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs text-slate-500 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {(selected.os_itens || []).sort((a, b) => a.ordem - b.ordem).map((it) => (
                  <tr key={it.id} className="border-t border-slate-50">
                    <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${it.tipo === 'peca' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{it.tipo === 'peca' ? 'Peça' : 'Serviço'}</span></td>
                    <td className="px-3 py-2">{it.descricao}</td>
                    <td className="px-3 py-2">{Number(it.quantidade).toFixed(0)}</td>
                    <td className="px-3 py-2">{brl(it.preco_unitario)}</td>
                    <td className="px-3 py-2 font-medium">{brl(it.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr><td colSpan={4} className="px-3 py-2 text-right text-slate-500">Peças: {brl(selected.total_pecas)} · Serviços: {brl(selected.total_servicos)}{Number(selected.desconto) > 0 ? ` · Desc: ${brl(selected.desconto)}` : ''}</td>
                  <td className="px-3 py-2 font-bold text-lg">{brl(selected.total)}</td></tr>
              </tfoot>
            </table>

            {selected.diagnostico && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800"><strong>Diagnóstico:</strong> {selected.diagnostico}</div>
            )}

            {/* Ações */}
            {podeEditar && (
              <div className="flex gap-2 flex-wrap items-center">
                {selected.status === 'aberta' && <Button onClick={() => mudarStatus('em_execucao')} loading={acting}><Play size={14} /> Iniciar Execução</Button>}
                {selected.status === 'em_execucao' && <Button onClick={() => mudarStatus('concluida')} loading={acting}><CheckCircle size={14} /> Concluir Serviço</Button>}
                {selected.status === 'concluida' && <Button variant="success" onClick={faturar} loading={acting}><Send size={14} /> Faturar e Entregar</Button>}
                {['aberta', 'em_execucao', 'concluida'].includes(selected.status) && (
                  <Button variant="secondary" onClick={() => openEditar(selected)}><Pencil size={14} /> Editar</Button>
                )}
                {['aberta', 'em_execucao'].includes(selected.status) && (
                  <Button variant="danger" size="sm" onClick={() => setShowCancel(true)}><XCircle size={14} /> Cancelar</Button>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      <Confirm open={showCancel} title="Cancelar OS" message="A ordem de serviço será cancelada."
        confirmLabel="Confirmar" loading={acting} onConfirm={cancelar} onCancel={() => setShowCancel(false)} />
    </div>
  );
}
