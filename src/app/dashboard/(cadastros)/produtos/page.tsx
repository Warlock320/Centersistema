'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Plus, Pencil, AlertTriangle, Tag, PackageX, TrendingDown, TrendingUp } from 'lucide-react';
import type { Produto, Categoria } from '@/types/database.types';

const EMPTY: Partial<Produto> = { codigo: '', nome: '', categoria: null, preco: 0, custo: 0, estoque: 0, estoque_minimo: 0 };

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtered, setFiltered] = useState<Produto[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [prodToDelete, setProdToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selected, setSelected] = useState<Produto | null>(null);
  const [form, setForm] = useState<Partial<Produto>>(EMPTY);
  const [saveMsg, setSaveMsg] = useState('');

  // Estado para gerenciar categorias
  const [novaCategoria, setNovaCategoria] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(produtos.filter((p) =>
      (p.nome.toLowerCase().includes(q) || (p.codigo || '').toLowerCase().includes(q)) &&
      (!filterCat || p.categoria === filterCat)
    ));
  }, [search, filterCat, produtos]);

  async function fetchData() {
    setLoading(true);
    const [prods, cats] = await Promise.all([
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
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
    setSaveMsg('');
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
      await supabase.from('produtos').insert({ ...payload, empresa_id: (usr as { empresa_id: string })!.empresa_id });
    }

    setSaving(false);
    setSaveMsg('Produto salvo!');
    fetchData();
    setTimeout(() => { setSaveMsg(''); setShowForm(false); }, 1000);
  }

  async function handleDelete() {
    if (!prodToDelete) return;
    setDeleting(true);
    await supabase.from('produtos').update({ ativo: false }).eq('id', prodToDelete);
    setDeleting(false);
    setShowConfirm(false);
    setProdToDelete(null);
    setShowForm(false);
    fetchData();
  }

  async function handleSaveCategoria(e: FormEvent) {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    setSavingCat(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    await supabase.from('categorias').insert({ nome: novaCategoria.trim(), empresa_id: (usr as { empresa_id: string })!.empresa_id });
    setNovaCategoria('');
    setSavingCat(false);
    const { data } = await supabase.from('categorias').select('*').order('nome');
    setCategorias(data as Categoria[] || []);
  }

  async function handleDeleteCategoria(id: string) {
    await supabase.from('categorias').delete().eq('id', id);
    const { data } = await supabase.from('categorias').select('*').order('nome');
    setCategorias(data as Categoria[] || []);
  }

  const set = (key: keyof Produto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const catOptions = categorias.map((c) => ({ value: c.id, label: c.nome }));
  const abaixoMinimo = produtos.filter((p) => p.estoque_minimo > 0 && p.estoque < p.estoque_minimo).length;

  const columns: Column<Produto>[] = [
    { key: 'codigo', label: 'SKU', render: (r) => r.codigo
      ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{r.codigo}</span>
      : <span className="text-slate-300">—</span> },
    { key: 'nome', label: 'Produto', render: (r) => (
      <div className="flex items-center gap-2">
        {r.estoque_minimo > 0 && r.estoque < r.estoque_minimo && (
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
        )}
        <span className="font-medium text-slate-900">{r.nome}</span>
      </div>
    )},
    { key: 'preco', label: 'Preço Venda', render: (r) => (
      <span className="font-medium text-green-700">
        {Number(r.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span>
    )},
    { key: 'custo', label: 'Custo', render: (r) => Number(r.custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { key: 'estoque', label: 'Estoque', render: (r) => {
      const low = r.estoque_minimo > 0 && r.estoque < r.estoque_minimo;
      return (
        <div className="flex items-center gap-1.5">
          {low
            ? <TrendingDown size={14} className="text-red-500" />
            : <TrendingUp size={14} className="text-green-500" />}
          <span className={`font-bold ${low ? 'text-red-600' : 'text-slate-800'}`}>
            {Number(r.estoque).toFixed(2)}
          </span>
        </div>
      );
    }},
    { key: 'estoque_minimo', label: 'Mín.', render: (r) => <span className="text-slate-400">{Number(r.estoque_minimo).toFixed(2)}</span> },
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
          <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
          <p className="text-slate-500 text-sm">
            {produtos.length} item(s)
            {abaixoMinimo > 0 && (
              <span className="ml-2 text-red-500 font-medium">· {abaixoMinimo} abaixo do estoque mínimo</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowCategorias(true)}>
            <Tag size={16} /> Categorias
          </Button>
          <Button onClick={() => openForm()}>
            <Plus size={16} /> Novo Produto
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 max-w-xs px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <DataTable columns={columns} data={filtered} keyField="id" loading={loading}
          emptyMessage="Nenhum produto cadastrado. Clique em 'Novo Produto' para começar." />
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Produto' : 'Novo Produto'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Código / SKU" value={form.codigo || ''} onChange={set('codigo')} placeholder="ABC-001" />
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Select label="Categoria" value={form.categoria || ''} onChange={set('categoria')} options={catOptions} />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCategorias(true)}
                className="mb-0.5 shrink-0" title="Gerenciar categorias">
                <Tag size={14} />
              </Button>
            </div>
            <div className="col-span-2">
              <Input label="Nome do Produto *" value={form.nome || ''} onChange={set('nome')} required placeholder="Ex: Filtro de Óleo Toyota" />
            </div>
            <Input label="Preço de Venda (R$) *" type="number" step="0.01" min="0"
              value={form.preco || 0} onChange={set('preco')} required />
            <Input label="Custo Unitário (R$)" type="number" step="0.0001" min="0"
              value={form.custo || 0} onChange={set('custo')} />
            <Input label="Estoque Atual" type="number" step="0.001" min="0"
              value={form.estoque || 0} onChange={set('estoque')} />
            <Input label="Estoque Mínimo (alerta)" type="number" step="0.001" min="0"
              value={form.estoque_minimo || 0} onChange={set('estoque_minimo')} />
          </div>

          {form.preco && form.custo && Number(form.custo) > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Margem: {(((Number(form.preco) - Number(form.custo)) / Number(form.custo)) * 100).toFixed(1)}%
              · Lucro unitário: {(Number(form.preco) - Number(form.custo)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          )}

          {saveMsg && <p className="text-sm text-green-600 font-medium">{saveMsg}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && (
              <Button type="button" variant="danger" size="sm"
                onClick={() => { setProdToDelete(selected.id); setShowConfirm(true); }}>
                <PackageX size={14} /> Desativar
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Categorias Modal */}
      <Modal open={showCategorias} onClose={() => setShowCategorias(false)} title="Gerenciar Categorias" size="sm">
        <div className="space-y-4">
          <form onSubmit={handleSaveCategoria} className="flex gap-2">
            <input
              type="text"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              placeholder="Nome da categoria..."
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button type="submit" loading={savingCat} size="sm">
              <Plus size={14} /> Criar
            </Button>
          </form>

          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {categorias.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nenhuma categoria criada</p>
            ) : categorias.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-800 flex items-center gap-2">
                  <Tag size={14} className="text-slate-400" /> {cat.nome}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCategoria(cat.id)}
                  className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Confirm
        open={showConfirm}
        title="Desativar produto"
        message="O produto será desativado. Histórico de movimentações e itens em orçamentos/pedidos são preservados."
        confirmLabel="Sim, desativar"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowConfirm(false); setProdToDelete(null); }}
      />
    </div>
  );
}
