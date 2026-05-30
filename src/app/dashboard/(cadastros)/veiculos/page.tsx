'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Combobox } from '@/components/ui/Combobox';
import { useToast } from '@/components/ui/Toast';
import { Plus, Pencil, Bike } from 'lucide-react';
import type { Veiculo, Cliente } from '@/types/database.types';

const EMPTY: Partial<Veiculo> = {
  cliente_id: null, marca: '', modelo: '', placa: '', ano: '', cor: '', km: null, chassi: '', observacoes: '',
};
const UPPER = ['marca', 'modelo', 'placa', 'cor', 'chassi'];

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtered, setFiltered] = useState<Veiculo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Veiculo | null>(null);
  const [form, setForm] = useState<Partial<Veiculo>>(EMPTY);

  const supabase = createClient();
  const toast = useToast();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(veiculos.filter((v) =>
      v.modelo.toLowerCase().includes(q) ||
      (v.placa || '').toLowerCase().includes(q) ||
      (v.marca || '').toLowerCase().includes(q) ||
      (v.clientes?.nome || '').toLowerCase().includes(q)
    ));
  }, [search, veiculos]);

  async function fetchData() {
    setLoading(true);
    const [veics, clis] = await Promise.all([
      supabase.from('veiculos').select('*, clientes(nome)').eq('ativo', true).order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nome, cpf_cnpj').eq('ativo', true).order('nome'),
    ]);
    setVeiculos(veics.data as Veiculo[] || []);
    setFiltered(veics.data as Veiculo[] || []);
    setClientes(clis.data as Cliente[] || []);
    setLoading(false);
  }

  function openForm(v?: Veiculo) {
    setSelected(v || null);
    setForm(v ? { ...v } : EMPTY);
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      cliente_id: form.cliente_id || null,
      marca: form.marca || null, modelo: form.modelo, placa: form.placa || null,
      ano: form.ano || null, cor: form.cor || null,
      km: form.km ? Number(form.km) : null, chassi: form.chassi || null, observacoes: form.observacoes || null,
    };
    let error;
    if (selected) {
      ({ error } = await supabase.from('veiculos').update(payload).eq('id', selected.id));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      ({ error } = await supabase.from('veiculos').insert({ ...payload, empresa_id: (usr as { empresa_id: string })!.empresa_id }));
    }
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success(selected ? 'Veículo atualizado!' : 'Veículo cadastrado!');
    setShowForm(false);
    fetchData();
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    await supabase.from('veiculos').update({ ativo: false }).eq('id', toDelete);
    setDeleting(false);
    setShowConfirm(false);
    setToDelete(null);
    setShowForm(false);
    toast.success('Veículo removido.');
    fetchData();
  }

  const set = (key: keyof Veiculo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = UPPER.includes(key) ? e.target.value.toUpperCase() : e.target.value;
    setForm((p) => ({ ...p, [key]: v }));
  };

  const columns: Column<Veiculo>[] = [
    { key: 'modelo', label: 'Veículo', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{[r.marca, r.modelo].filter(Boolean).join(' ')}</p>
        <p className="text-xs text-slate-400">{[r.ano, r.cor].filter(Boolean).join(' · ')}</p>
      </div>
    )},
    { key: 'placa', label: 'Placa', render: (r) => r.placa
      ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{r.placa}</span>
      : <span className="text-slate-300">—</span> },
    { key: 'cliente', label: 'Cliente', render: (r) => r.clientes?.nome || <span className="text-slate-300">—</span> },
    { key: 'km', label: 'KM', render: (r) => r.km != null ? r.km.toLocaleString('pt-BR') : <span className="text-slate-300">—</span> },
    { key: 'acoes', label: '', render: (r) => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(r); }}><Pencil size={14} /></Button>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Veículos</h1>
          <p className="text-slate-500 text-sm">{veiculos.length} veículo(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => openForm()}><Plus size={16} /> Novo Veículo</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <input type="text" placeholder="Buscar por modelo, placa, marca ou cliente..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <DataTable columns={columns} data={filtered} keyField="id" loading={loading}
          emptyMessage="Nenhum veículo cadastrado." />
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Veículo' : 'Novo Veículo'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Combobox label="Cliente (dono)" value={form.cliente_id || ''}
            onChange={(v) => setForm((p) => ({ ...p, cliente_id: v || null }))}
            options={clientes.map((c) => ({ value: c.id, label: c.nome, sublabel: c.cpf_cnpj || undefined }))}
            placeholder="Buscar cliente..." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Marca" value={form.marca || ''} onChange={set('marca')} placeholder="Ex: HONDA" />
            <Input label="Modelo *" value={form.modelo || ''} onChange={set('modelo')} required placeholder="Ex: BIZ 125" />
            <Input label="Placa" value={form.placa || ''} onChange={set('placa')} placeholder="ABC1D23" />
            <Input label="Ano" value={form.ano || ''} onChange={set('ano')} placeholder="2022" />
            <Input label="Cor" value={form.cor || ''} onChange={set('cor')} />
            <Input label="KM atual" type="number" value={form.km ?? ''} onChange={(e) => setForm((p) => ({ ...p, km: e.target.value ? Number(e.target.value) : null }))} />
            <div className="col-span-2">
              <Input label="Chassi" value={form.chassi || ''} onChange={set('chassi')} />
            </div>
          </div>
          <Textarea label="Observações" value={form.observacoes || ''} onChange={set('observacoes')} />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && (
              <Button type="button" variant="danger" size="sm" onClick={() => { setToDelete(selected.id); setShowConfirm(true); }}>Remover</Button>
            )}
          </div>
        </form>
      </Modal>

      <Confirm open={showConfirm} title="Remover veículo"
        message="O veículo será removido. As ordens de serviço vinculadas são preservadas."
        confirmLabel="Remover" loading={deleting}
        onConfirm={handleDelete} onCancel={() => { setShowConfirm(false); setToDelete(null); }} />
    </div>
  );
}
