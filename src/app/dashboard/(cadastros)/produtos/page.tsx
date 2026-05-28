'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Plus, Pencil, AlertTriangle } from 'lucide-react';
import type { Produto, Categoria } from '@/types/database.types';

const EMPTY: Partial<Produto> = {
  codigo: '', nome: '', categoria: null, preco: 0,
  custo: 0, estoque: 0, estoque_minimo: 0,
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtered, setFiltered] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Produto | null>(null);
  const [form, setForm] = useState<Partial<Produto>>(EMPTY);

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(produtos.filter((p) =>
      p.nome.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)
    ));
  }, [search, produtos]);

  async function fetchData() {
    setLoading(true);
    const [prods, cats] = await Promise.all([
      supabase.from('produtos').select('*, categorias(nome)').eq('ativo', true).order('nome'),
      supabase.from('categorias').select('*').order('nome'),
    ]);
    setProdutos(prods.data as Produto[] || []);
    setFiltered(prods.data as Produto[] || []);
    setCategorias(cats.data as Categoria[] || []);
    setLoading(false);
  }

  function openForm(produto?: Produto) {
    setSelected(produto || null);
    setForm(produto ? { ...produto } : EMPTY);
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      preco: Number(form.preco),
      custo: Number(form.custo),
      estoque: Number(form.estoque),
      estoque_minimo: Number(form.estoque_minimo),
      categoria: form.categoria || null,
    };

    if (selected) {
      await supabase.from('produtos').update(payload).eq('id', selected.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      await supabase.from('produtos').insert({ ...payload, empresa_id: usr!.empresa_id });
    }

    setSaving(false);
    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Desativar este produto?')) return;
    await supabase.from('produtos').update({ ativo: false }).eq('id', id);
    fetchData();
  }

  const set = (key: keyof Produto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const catOptions = categorias.map((c) => ({ value: c.id, label: c.nome }));

  const columns: Column<Produto>[] = [
    { key: 'codigo', label: 'SKU', render: (r) => r.codigo ? <span className="font-mono text-xs text-slate-500">{r.codigo}</span> : <span className="text-slate-300">—</span> },
    { key: 'nome', label: 'Produto', render: (r) => (
      <div className="flex items-center gap-2">
        {r.estoque_minimo > 0 && r.estoque < r.estoque_minimo && (
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
        )}
        <span className="font-medium text-slate-900">{r.nome}</span>
      </div>
    )},
    { key: 'preco', label: 'Preço', render: (r) => Number(r.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { key: 'custo', label: 'Custo', render: (r) => Number(r.custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { key: 'estoque', label: 'Estoque', render: (r) => (
      <span className={`font-bold ${r.estoque_minimo > 0 && r.estoque < r.estoque_minimo ? 'text-red-600' : 'text-slate-900'}`}>
        {Number(r.estoque).toFixed(2)}
      </span>
    )},
    { key: 'estoque_minimo', label: 'Mín.', render: (r) => Number(r.estoque_minimo).toFixed(2) },
    { key: 'acoes', label: '', render: (r) => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(r); }}>
        <Pencil size={14} />
      </Button>
    )},
  ];

  const abaixoMinimo = produtos.filter((p) => p.estoque_minimo > 0 && p.estoque < p.estoque_minimo).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-slate-500 text-sm">
            {produtos.length} item(s)
            {abaixoMinimo > 0 && <span className="text-red-500 ml-2">• {abaixoMinimo} abaixo do mínimo</span>}
          </p>
        </div>
        <Button onClick={() => openForm()}>
          <Plus size={16} /> Novo Produto
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <input
            type="text"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <DataTable columns={columns} data={filtered} keyField="id" loading={loading} />
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Produto' : 'Novo Produto'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Código / SKU" value={form.codigo || ''} onChange={set('codigo')} placeholder="ABC-001" />
            <Select label="Categoria" value={form.categoria || ''} onChange={set('categoria')} options={catOptions} />
            <div className="col-span-2">
              <Input label="Nome do Produto *" value={form.nome || ''} onChange={set('nome')} required />
            </div>
            <Input label="Preço de Venda (R$) *" type="number" step="0.01" min="0" value={form.preco || 0} onChange={set('preco')} required />
            <Input label="Custo Unitário (R$)" type="number" step="0.0001" min="0" value={form.custo || 0} onChange={set('custo')} />
            <Input label="Estoque Atual" type="number" step="0.001" min="0" value={form.estoque || 0} onChange={set('estoque')} />
            <Input label="Estoque Mínimo" type="number" step="0.001" min="0" value={form.estoque_minimo || 0} onChange={set('estoque_minimo')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && (
              <Button type="button" variant="danger" size="sm" onClick={() => { handleDelete(selected.id); setShowForm(false); }}>
                Desativar
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
