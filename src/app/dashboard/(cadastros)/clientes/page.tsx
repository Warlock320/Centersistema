'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Plus, History, Pencil, UserX, Search, Loader2 } from 'lucide-react';
import type { Cliente, Orcamento, Pedido } from '@/types/database.types';
import { buscarCNPJ, isCNPJ, formatCpfCnpj, buscarCEP, isCEP, formatCEP } from '@/lib/brasilapi';

const EMPTY: Partial<Cliente> = {
  nome: '', tipo: 'juridica', cpf_cnpj: '', razao_social: '', inscricao_estadual: '',
  email: '', telefone: '', endereco: '', cidade: '', estado: '', cep: '', observacoes: '',
};

const statusOrc: Record<string, string> = {
  criado: 'bg-slate-100 text-slate-700', orcamento_enviado: 'bg-blue-100 text-blue-700',
  aguardando_aprovacao: 'bg-yellow-100 text-yellow-700', aprovado: 'bg-green-100 text-green-700',
  aguardando_pecas: 'bg-orange-100 text-orange-700', enviado: 'bg-teal-100 text-teal-700', cancelado: 'bg-red-100 text-red-700',
};
const statusPed: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-700', em_andamento: 'bg-yellow-100 text-yellow-700',
  faturado: 'bg-green-100 text-green-700', cancelado: 'bg-red-100 text-red-700',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtered, setFiltered] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showFicha, setShowFicha] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selected, setSelected] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>(EMPTY);
  const [ficha, setFicha] = useState<{ ltv: number; orcamentos: Orcamento[]; pedidos: Pedido[] } | null>(null);
  const [saveMsg, setSaveMsg] = useState('');

  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState('');

  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [cepMsg, setCepMsg] = useState('');
  const [numero, setNumero] = useState('');

  const supabase = createClient();

  async function handleBuscarCEP() {
    setCepMsg('');
    if (!isCEP(form.cep || '')) { setCepMsg('Informe um CEP com 8 dígitos.'); return; }
    setBuscandoCEP(true);
    try {
      const d = await buscarCEP(form.cep || '');
      const endereco = [d.logradouro, d.bairro].filter(Boolean).join(' - ');
      setForm((p) => ({ ...p, endereco, cidade: d.cidade, estado: d.uf, cep: d.cep }));
      setNumero('');
      setCepMsg('Endereço preenchido! Informe o número.');
    } catch (err) {
      setCepMsg(err instanceof Error ? err.message : 'Erro ao consultar CEP');
    } finally {
      setBuscandoCEP(false);
    }
  }

  async function handleBuscarCNPJ() {
    setCnpjMsg('');
    if (!isCNPJ(form.cpf_cnpj || '')) { setCnpjMsg('Informe um CNPJ com 14 dígitos.'); return; }
    setBuscandoCNPJ(true);
    try {
      const d = await buscarCNPJ(form.cpf_cnpj || '');
      setForm((p) => ({
        ...p,
        nome: p.nome || d.nomeFantasia,
        razao_social: d.razaoSocial,
        email: p.email || d.email,
        telefone: p.telefone || d.telefone,
        endereco: d.enderecoCompleto,
        cidade: d.municipio,
        estado: d.uf,
        cep: d.cep,
      }));
      setCnpjMsg(d.situacao ? `Encontrado · situação: ${d.situacao}` : 'Dados preenchidos!');
    } catch (err) {
      setCnpjMsg(err instanceof Error ? err.message : 'Erro ao consultar CNPJ');
    } finally {
      setBuscandoCNPJ(false);
    }
  }

  useEffect(() => { fetchClientes(); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(clientes.filter((c) =>
      c.nome.toLowerCase().includes(q) ||
      (c.cpf_cnpj || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.telefone || '').includes(q)
    ));
  }, [search, clientes]);

  async function fetchClientes() {
    setLoading(true);
    const { data } = await supabase.from('clientes').select('*').eq('ativo', true).order('nome');
    setClientes(data as Cliente[] || []);
    setFiltered(data as Cliente[] || []);
    setLoading(false);
  }

  async function openFicha(cliente: Cliente) {
    setSelected(cliente);
    setShowFicha(true);
    setFicha(null);
    const [ltv, orcs, peds] = await Promise.all([
      supabase.from('v_clientes_ltv').select('ltv').eq('id', cliente.id).single(),
      supabase.from('orcamentos').select('*, orcamento_itens(*)').eq('cliente_id', cliente.id).order('numero', { ascending: false }).limit(10),
      supabase.from('pedidos').select('*').eq('cliente_id', cliente.id).order('numero', { ascending: false }).limit(10),
    ]);
    setFicha({
      ltv: Number(ltv.data?.ltv || 0),
      orcamentos: orcs.data as Orcamento[] || [],
      pedidos: peds.data as Pedido[] || [],
    });
  }

  function openForm(cliente?: Cliente) {
    setSelected(cliente || null);
    setForm(cliente ? { ...cliente } : EMPTY);
    setSaveMsg('');
    setCnpjMsg('');
    setCepMsg('');
    setNumero('');
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    // Se o número foi informado pela busca de CEP, anexa ao endereço
    const enderecoFinal = numero.trim() && form.endereco
      ? `${form.endereco}, Nº ${numero.trim()}`
      : form.endereco;
    const payload = { ...form, endereco: enderecoFinal };
    if (selected) {
      await supabase.from('clientes').update(payload).eq('id', selected.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      await supabase.from('clientes').insert({ ...payload, empresa_id: (usr as { empresa_id: string })!.empresa_id });
    }
    setSaving(false);
    setSaveMsg('Salvo com sucesso!');
    fetchClientes();
    setTimeout(() => { setSaveMsg(''); setShowForm(false); }, 1000);
  }

  async function handleDelete() {
    if (!clienteToDelete) return;
    setDeleting(true);
    await supabase.from('clientes').update({ ativo: false }).eq('id', clienteToDelete);
    setDeleting(false);
    setShowConfirm(false);
    setClienteToDelete(null);
    setShowForm(false);
    fetchClientes();
  }

  const set = (key: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const columns: Column<Cliente>[] = [
    { key: 'nome', label: 'Nome', render: (r) => <span className="font-medium text-slate-900">{r.nome}</span> },
    { key: 'tipo', label: 'Tipo', render: (r) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.tipo === 'juridica' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
        {r.tipo === 'juridica' ? 'PJ' : 'PF'}
      </span>
    )},
    { key: 'cpf_cnpj', label: 'CPF / CNPJ', render: (r) => r.cpf_cnpj || <span className="text-slate-300">—</span> },
    { key: 'telefone', label: 'Telefone', render: (r) => r.telefone || <span className="text-slate-300">—</span> },
    { key: 'cidade', label: 'Localização', render: (r) => r.cidade ? `${r.cidade}/${r.estado}` : <span className="text-slate-300">—</span> },
    {
      key: 'acoes', label: '',
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openFicha(r); }}>
            <History size={14} /> Ficha 360°
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(r); }}>
            <Pencil size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm">{clientes.length} cliente(s) ativo(s)</p>
        </div>
        <Button onClick={() => openForm()}>
          <Plus size={16} /> Novo Cliente
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <DataTable columns={columns} data={filtered} keyField="id" loading={loading}
          emptyMessage="Nenhum cliente cadastrado. Clique em 'Novo Cliente' para começar." />
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo de Pessoa" value={form.tipo || 'juridica'} onChange={(e) => { set('tipo')(e); setCnpjMsg(''); }}
              options={[{ value: 'juridica', label: 'Pessoa Jurídica (PJ)' }, { value: 'fisica', label: 'Pessoa Física (PF)' }]} />

            {/* CPF/CNPJ com busca BrasilAPI quando PJ */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">{form.tipo === 'fisica' ? 'CPF' : 'CNPJ'}</label>
              <div className="flex gap-2">
                <input
                  value={form.cpf_cnpj || ''}
                  onChange={(e) => setForm((p) => ({ ...p, cpf_cnpj: formatCpfCnpj(e.target.value) }))}
                  placeholder={form.tipo === 'fisica' ? '000.000.000-00' : '00.000.000/0001-00'}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {form.tipo === 'juridica' && (
                  <Button type="button" variant="secondary" size="sm" onClick={handleBuscarCNPJ}
                    disabled={buscandoCNPJ || !isCNPJ(form.cpf_cnpj || '')} title="Buscar dados na Receita (BrasilAPI)">
                    {buscandoCNPJ ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </Button>
                )}
              </div>
              {cnpjMsg && <p className={`text-xs mt-1 ${cnpjMsg.includes('Erro') || cnpjMsg.includes('Informe') || cnpjMsg.includes('não') ? 'text-red-500' : 'text-green-600'}`}>{cnpjMsg}</p>}
            </div>

            <div className="col-span-2">
              <Input label={form.tipo === 'juridica' ? 'Nome Fantasia *' : 'Nome *'} value={form.nome || ''} onChange={set('nome')} required
                placeholder={form.tipo === 'juridica' ? 'Nome fantasia' : 'Nome completo'} />
            </div>

            {form.tipo === 'juridica' && (
              <>
                <div className="col-span-2">
                  <Input label="Razão Social" value={form.razao_social || ''} onChange={set('razao_social')} placeholder="Preenchido pela consulta do CNPJ" />
                </div>
                <Input label="Inscrição Estadual (IE)" value={form.inscricao_estadual || ''} onChange={set('inscricao_estadual')} placeholder="Isento ou número da IE" />
              </>
            )}

            <Input label="E-mail" type="email" value={form.email || ''} onChange={set('email')} />
            <Input label="Telefone / WhatsApp" value={form.telefone || ''} onChange={set('telefone')} placeholder="(11) 99999-9999" />

            {/* CEP com busca automática de endereço */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">CEP</label>
              <div className="flex gap-2">
                <input
                  value={form.cep || ''}
                  onChange={(e) => setForm((p) => ({ ...p, cep: formatCEP(e.target.value) }))}
                  placeholder="00000-000"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleBuscarCEP}
                  disabled={buscandoCEP || !isCEP(form.cep || '')} title="Buscar endereço pelo CEP">
                  {buscandoCEP ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </Button>
              </div>
              {cepMsg && <p className={`text-xs mt-1 ${cepMsg.includes('Erro') || cepMsg.includes('Informe') || cepMsg.includes('não') ? 'text-red-500' : 'text-green-600'}`}>{cepMsg}</p>}
            </div>
            <Input label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Nº (ex: 123)" />

            <div className="col-span-2">
              <Input label="Endereço (rua / bairro)" value={form.endereco || ''} onChange={set('endereco')} placeholder="Preenchido pela busca de CEP" />
            </div>
            <Input label="Cidade" value={form.cidade || ''} onChange={set('cidade')} />
            <Input label="Estado (UF)" value={form.estado || ''} onChange={set('estado')} maxLength={2} placeholder="SP" />
          </div>
          <Textarea label="Observações" value={form.observacoes || ''} onChange={set('observacoes')} placeholder="Informações adicionais..." />

          {saveMsg && <p className="text-sm text-green-600 font-medium">{saveMsg}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && (
              <Button type="button" variant="danger" size="sm"
                onClick={() => { setClienteToDelete(selected.id); setShowConfirm(true); }}>
                <UserX size={14} /> Desativar
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Ficha 360° Modal */}
      <Modal open={showFicha} onClose={() => setShowFicha(false)} title={`Ficha 360° — ${selected?.nome}`} size="xl">
        {!ficha ? (
          <div className="flex justify-center py-12 text-slate-400">Carregando histórico...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Lifetime Value (LTV)</p>
                <p className="text-3xl font-bold text-blue-800">
                  {ficha.ltv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-blue-500">Total em pedidos faturados</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-700">{selected?.nome}</p>
                <p className="text-sm text-blue-600">{selected?.telefone || '—'}</p>
                <p className="text-sm text-blue-600">{selected?.email || '—'}</p>
                {selected?.cidade && <p className="text-xs text-blue-400">{selected.cidade}/{selected.estado}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  Orçamentos
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{ficha.orcamentos.length}</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {ficha.orcamentos.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhum orçamento</p>
                  ) : ficha.orcamentos.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">#{o.numero}</p>
                        <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusOrc[o.status] || 'bg-slate-100 text-slate-600'}`}>
                          {o.status.replace('_', ' ')}
                        </span>
                        <p className="text-sm font-medium text-slate-700 mt-1">
                          {Number(o.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  Pedidos
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{ficha.pedidos.length}</span>
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {ficha.pedidos.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhum pedido</p>
                  ) : ficha.pedidos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">#{p.numero}</p>
                        <p className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusPed[p.status] || 'bg-slate-100 text-slate-600'}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                        <p className="text-sm font-medium text-slate-700 mt-1">
                          {Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Confirm
        open={showConfirm}
        title="Desativar cliente"
        message="O cliente será desativado e não aparecerá mais nas listas. Orçamentos e pedidos anteriores são preservados."
        confirmLabel="Sim, desativar"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowConfirm(false); setClienteToDelete(null); }}
      />
    </div>
  );
}
