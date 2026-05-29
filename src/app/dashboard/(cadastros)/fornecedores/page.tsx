'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Plus, Pencil, Truck, Copy } from 'lucide-react';
import type { Fornecedor } from '@/types/database.types';

const EMPTY: Partial<Fornecedor> = {
  nome: '', razao_social: '', cnpj_cpf: '', tipo: 'juridica',
  email: '', telefone: '', endereco: '', cidade: '', estado: '', cep: '',
  banco: '', agencia: '', conta: '', tipo_conta: null, pix_chave: '', pix_tipo: null,
  prazo_padrao: 30, observacoes: '',
};

const PIX_OPTIONS = [
  { value: 'cpf', label: 'CPF' }, { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' }, { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [filtered, setFiltered] = useState<Fornecedor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<Partial<Fornecedor>>(EMPTY);
  const [saveMsg, setSaveMsg] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(fornecedores.filter((f) =>
      f.nome.toLowerCase().includes(q) ||
      (f.cnpj_cpf || '').includes(q) ||
      (f.email || '').toLowerCase().includes(q)
    ));
  }, [search, fornecedores]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('fornecedores').select('*').eq('ativo', true).order('nome');
    setFornecedores(data as Fornecedor[] || []);
    setFiltered(data as Fornecedor[] || []);
    setLoading(false);
  }

  function openForm(f?: Fornecedor) {
    setSelected(f || null);
    setForm(f ? { ...f } : EMPTY);
    setSaveMsg('');
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, prazo_padrao: Number(form.prazo_padrao) || 30 };
    if (selected) {
      await supabase.from('fornecedores').update(payload).eq('id', selected.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      await supabase.from('fornecedores').insert({ ...payload, empresa_id: (usr as { empresa_id: string })!.empresa_id });
    }
    setSaving(false);
    setSaveMsg('Salvo!');
    fetchData();
    setTimeout(() => { setSaveMsg(''); setShowForm(false); }, 800);
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    await supabase.from('fornecedores').update({ ativo: false }).eq('id', toDelete);
    setDeleting(false);
    setShowConfirm(false);
    setToDelete(null);
    setShowForm(false);
    fetchData();
  }

  const set = (key: keyof Fornecedor) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const columns: Column<Fornecedor>[] = [
    { key: 'nome', label: 'Fornecedor', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{r.nome}</p>
        {r.razao_social && r.razao_social !== r.nome && (
          <p className="text-xs text-slate-400">{r.razao_social}</p>
        )}
      </div>
    )},
    { key: 'cnpj_cpf', label: 'CNPJ / CPF', render: (r) => r.cnpj_cpf || <span className="text-slate-300">—</span> },
    { key: 'telefone', label: 'Contato', render: (r) => (
      <div>
        {r.telefone && <p className="text-sm">{r.telefone}</p>}
        {r.email && <p className="text-xs text-slate-400">{r.email}</p>}
      </div>
    )},
    { key: 'pix_chave', label: 'PIX', render: (r) => r.pix_chave
      ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-mono">{r.pix_chave}</span>
      : <span className="text-slate-300">—</span> },
    { key: 'prazo_padrao', label: 'Prazo Padrão', render: (r) => `${r.prazo_padrao}d` },
    { key: 'acoes', label: '', render: (r) => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(r); }}>
        <Pencil size={14} />
      </Button>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-slate-500 text-sm">{fornecedores.length} fornecedor(es) ativo(s)</p>
        </div>
        <Button onClick={() => openForm()}><Plus size={16} /> Novo Fornecedor</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <input type="text" placeholder="Buscar por nome, CNPJ ou e-mail..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <DataTable columns={columns} data={filtered} keyField="id" loading={loading}
          emptyMessage="Nenhum fornecedor cadastrado." />
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)}
        title={selected ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Dados básicos */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2"><Truck size={12} /> Identificação</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nome Fantasia *" value={form.nome || ''} onChange={set('nome')} required />
              <Input label="Razão Social" value={form.razao_social || ''} onChange={set('razao_social')} />
              <Select label="Tipo" value={form.tipo || 'juridica'} onChange={set('tipo')}
                options={[{ value: 'juridica', label: 'Pessoa Jurídica' }, { value: 'fisica', label: 'Pessoa Física' }]} />
              <Input label="CNPJ / CPF" value={form.cnpj_cpf || ''} onChange={set('cnpj_cpf')} />
              <Input label="E-mail" type="email" value={form.email || ''} onChange={set('email')} />
              <Input label="Telefone" value={form.telefone || ''} onChange={set('telefone')} />
              <Input label="Prazo Padrão (dias)" type="number" min={1} value={form.prazo_padrao || 30} onChange={set('prazo_padrao')} />
            </div>
          </div>

          {/* Dados bancários */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Dados Bancários</p>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Banco" value={form.banco || ''} onChange={set('banco')} placeholder="Ex: Bradesco 237" />
              <Input label="Agência" value={form.agencia || ''} onChange={set('agencia')} />
              <Input label="Conta" value={form.conta || ''} onChange={set('conta')} />
              <Select label="Tipo de Conta" value={form.tipo_conta || ''} onChange={set('tipo_conta')}
                options={[{ value: 'corrente', label: 'Corrente' }, { value: 'poupanca', label: 'Poupança' }, { value: 'pagamento', label: 'Pagamento' }]} />
              <Select label="Tipo da Chave PIX" value={form.pix_tipo || ''} onChange={set('pix_tipo')} options={PIX_OPTIONS} />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input label="Chave PIX" value={form.pix_chave || ''} onChange={set('pix_chave')} />
                </div>
                {form.pix_chave && (
                  <button type="button" onClick={() => navigator.clipboard?.writeText(form.pix_chave || '')}
                    className="mb-0.5 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Copiar PIX">
                    <Copy size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Endereço</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input label="Endereço" value={form.endereco || ''} onChange={set('endereco')} />
              </div>
              <Input label="CEP" value={form.cep || ''} onChange={set('cep')} />
              <Input label="Cidade" value={form.cidade || ''} onChange={set('cidade')} />
              <Input label="Estado (UF)" value={form.estado || ''} onChange={set('estado')} maxLength={2} />
            </div>
          </div>

          <Textarea label="Observações" value={form.observacoes || ''} onChange={set('observacoes')} />

          {saveMsg && <p className="text-sm text-green-600 font-medium">{saveMsg}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && (
              <Button type="button" variant="danger" size="sm"
                onClick={() => { setToDelete(selected.id); setShowConfirm(true); }}>
                Desativar
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <Confirm open={showConfirm} title="Desativar fornecedor"
        message="O fornecedor será desativado. Lançamentos existentes são preservados."
        confirmLabel="Desativar" loading={deleting}
        onConfirm={handleDelete} onCancel={() => { setShowConfirm(false); setToDelete(null); }} />
    </div>
  );
}
