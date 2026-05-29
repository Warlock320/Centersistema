'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Plus, Pencil, AlertTriangle, Tag, PackageX, X, MapPin, DollarSign, Trash2 } from 'lucide-react';
import type { Produto, Categoria, Fornecedor, TabelaPreco, PrecoProduto } from '@/types/database.types';

const EMPTY: Partial<Produto> = {
  codigo: '', ref: '', nome: '', categoria: null, fornecedor_id: null,
  localizacao: '', codigos_auxiliares: [], preco: 0, custo: 0, estoque: 0, estoque_minimo: 0,
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
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
  const [codigosAux, setCodigosAux] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState('');

  const [novaCategoria, setNovaCategoria] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // Tabelas de preço
  const [tabelas, setTabelas] = useState<TabelaPreco[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // tabela_id -> preço override (string)
  const [showTabelas, setShowTabelas] = useState(false);
  const [novaTabelaNome, setNovaTabelaNome] = useState('');
  const [novaTabelaAjuste, setNovaTabelaAjuste] = useState('0');
  const [savingTab, setSavingTab] = useState(false);

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(produtos.filter((p) => {
      const matchQ = !q ||
        p.nome.toLowerCase().includes(q) ||
        (p.codigo || '').toLowerCase().includes(q) ||
        (p.ref || '').toLowerCase().includes(q) ||
        (p.codigos_auxiliares || []).some((c) => c.toLowerCase().includes(q));
      return matchQ && (!filterCat || p.categoria === filterCat);
    }));
  }, [search, filterCat, produtos]);

  async function fetchData() {
    setLoading(true);
    const [prods, cats, forns, tabs] = await Promise.all([
      supabase.from('produtos').select('*, fornecedores(nome)').eq('ativo', true).order('nome'),
      supabase.from('categorias').select('*').order('nome'),
      supabase.from('fornecedores').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('tabelas_preco').select('*').eq('ativo', true).order('padrao', { ascending: false }).order('nome'),
    ]);
    setProdutos(prods.data as Produto[] || []);
    setFiltered(prods.data as Produto[] || []);
    setCategorias(cats.data as Categoria[] || []);
    setFornecedores(forns.data as Fornecedor[] || []);
    setTabelas(tabs.data as TabelaPreco[] || []);
    setLoading(false);
  }

  async function openForm(produto?: Produto) {
    setSelected(produto || null);
    setForm(produto ? { ...produto } : EMPTY);
    setCodigosAux(produto?.codigos_auxiliares || []);
    setSaveMsg('');
    setOverrides({});
    if (produto) {
      const { data } = await supabase.from('precos_produto').select('tabela_preco_id, preco').eq('produto_id', produto.id);
      const map: Record<string, string> = {};
      (data as PrecoProduto[] || []).forEach((pp) => { map[pp.tabela_preco_id] = String(pp.preco); });
      setOverrides(map);
    }
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      codigo: form.codigo || null,
      ref: form.ref || null,
      nome: form.nome,
      categoria: form.categoria || null,
      fornecedor_id: form.fornecedor_id || null,
      localizacao: form.localizacao || null,
      codigos_auxiliares: codigosAux.map((c) => c.trim()).filter(Boolean),
      preco: Number(form.preco),
      custo: Number(form.custo),
      estoque: Number(form.estoque),
      estoque_minimo: Number(form.estoque_minimo),
    };

    let produtoId = selected?.id;
    let empresaId = selected?.empresa_id;

    if (selected) {
      await supabase.from('produtos').update(payload).eq('id', selected.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      empresaId = (usr as { empresa_id: string })!.empresa_id;
      const { data: novo } = await supabase.from('produtos').insert({ ...payload, empresa_id: empresaId }).select('id').single();
      produtoId = (novo as { id: string } | null)?.id;
    }

    // Salva overrides de preço por tabela
    if (produtoId && empresaId) {
      for (const tab of tabelas) {
        const raw = overrides[tab.id];
        const val = raw !== undefined && raw !== '' ? Number(raw) : null;
        if (val && val > 0) {
          await supabase.from('precos_produto').upsert(
            { empresa_id: empresaId, produto_id: produtoId, tabela_preco_id: tab.id, preco: val },
            { onConflict: 'produto_id,tabela_preco_id' }
          );
        } else {
          await supabase.from('precos_produto').delete().eq('produto_id', produtoId).eq('tabela_preco_id', tab.id);
        }
      }
    }

    setSaving(false);
    setSaveMsg('Produto salvo!');
    fetchData();
    setTimeout(() => { setSaveMsg(''); setShowForm(false); }, 900);
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

  // ── Tabelas de preço ──────────────────────────────────────────────
  async function reloadTabelas() {
    const { data } = await supabase.from('tabelas_preco').select('*').eq('ativo', true).order('padrao', { ascending: false }).order('nome');
    setTabelas(data as TabelaPreco[] || []);
  }

  async function handleSaveTabela(e: FormEvent) {
    e.preventDefault();
    if (!novaTabelaNome.trim()) return;
    setSavingTab(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
    await supabase.from('tabelas_preco').insert({
      nome: novaTabelaNome.trim(),
      ajuste_percentual: Number(novaTabelaAjuste) || 0,
      empresa_id: (usr as { empresa_id: string })!.empresa_id,
    });
    setNovaTabelaNome(''); setNovaTabelaAjuste('0');
    setSavingTab(false);
    reloadTabelas();
  }

  async function handleDeleteTabela(t: TabelaPreco) {
    if (t.padrao) { alert('A tabela padrão não pode ser removida.'); return; }
    await supabase.from('tabelas_preco').update({ ativo: false }).eq('id', t.id);
    reloadTabelas();
  }

  const set = (key: keyof Produto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  // Códigos auxiliares dinâmicos
  const addCodAux = () => setCodigosAux((p) => [...p, '']);
  const setCodAux = (i: number, v: string) => setCodigosAux((p) => p.map((c, j) => (j === i ? v : c)));
  const removeCodAux = (i: number) => setCodigosAux((p) => p.filter((_, j) => j !== i));

  const catOptions = categorias.map((c) => ({ value: c.id, label: c.nome }));
  const fornOptions = fornecedores.map((f) => ({ value: f.id, label: f.nome }));
  const abaixoMinimo = produtos.filter((p) => p.estoque_minimo > 0 && p.estoque < p.estoque_minimo).length;

  const columns: Column<Produto>[] = [
    { key: 'codigo', label: 'Código', render: (r) => r.codigo
      ? <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{r.codigo}</span>
      : <span className="text-slate-300">—</span> },
    { key: 'nome', label: 'Produto', render: (r) => (
      <div>
        <div className="flex items-center gap-2">
          {r.estoque_minimo > 0 && r.estoque < r.estoque_minimo && (
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
          )}
          <span className="font-medium text-slate-900">{r.nome}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {r.ref && <span className="text-xs text-slate-400">Ref: {r.ref}</span>}
          {r.localizacao && (
            <span className="text-xs text-slate-400 flex items-center gap-0.5">
              <MapPin size={10} /> {r.localizacao}
            </span>
          )}
        </div>
      </div>
    )},
    { key: 'fornecedor', label: 'Fornecedor', render: (r) => r.fornecedores?.nome || <span className="text-slate-300">—</span> },
    { key: 'preco', label: 'Preço', render: (r) => (
      <span className="font-medium text-green-700">
        {Number(r.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span>
    )},
    { key: 'estoque', label: 'Estoque', render: (r) => {
      const low = r.estoque_minimo > 0 && r.estoque < r.estoque_minimo;
      return <span className={`font-bold ${low ? 'text-red-600' : 'text-slate-800'}`}>{Number(r.estoque).toFixed(0)}</span>;
    }},
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
            {abaixoMinimo > 0 && <span className="ml-2 text-red-500 font-medium">· {abaixoMinimo} abaixo do mínimo</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowTabelas(true)}><DollarSign size={16} /> Tabelas de Preço</Button>
          <Button variant="secondary" onClick={() => setShowCategorias(true)}><Tag size={16} /> Categorias</Button>
          <Button onClick={() => openForm()}><Plus size={16} /> Novo Produto</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex gap-3 flex-wrap">
          <input type="text" placeholder="Buscar por nome, código, ref ou código auxiliar..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <DataTable columns={columns} data={filtered} keyField="id" loading={loading}
          emptyMessage="Nenhum produto cadastrado. Clique em 'Novo Produto' para começar." />
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Produto' : 'Novo Produto'} size="lg">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Identificação */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Identificação</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Código" value={form.codigo || ''} onChange={set('codigo')} placeholder="SKU interno" />
              <Input label="Referência (ref)" value={form.ref || ''} onChange={set('ref')} placeholder="Ref. do fabricante" />
              <div className="col-span-2">
                <Input label="Nome do Produto *" value={form.nome || ''} onChange={set('nome')} required placeholder="Ex: Filtro de Óleo Toyota Corolla" />
              </div>
              <Input label="Localização" value={form.localizacao || ''} onChange={set('localizacao')} placeholder="Ex: Prateleira A-12" />
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select label="Categoria" value={form.categoria || ''} onChange={set('categoria')} options={catOptions} />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCategorias(true)} className="mb-0.5 shrink-0">
                  <Tag size={14} />
                </Button>
              </div>
            </div>
          </div>

          {/* Códigos auxiliares */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Códigos Auxiliares</p>
              <Button type="button" variant="ghost" size="sm" onClick={addCodAux}>
                <Plus size={13} /> Adicionar código
              </Button>
            </div>
            {codigosAux.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum código auxiliar. Use para EAN, código de barras, equivalências, etc.</p>
            ) : (
              <div className="space-y-2">
                {codigosAux.map((cod, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={cod} onChange={(e) => setCodAux(i, e.target.value)}
                      placeholder={`Código auxiliar ${i + 1}`}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <button type="button" onClick={() => removeCodAux(i)}
                      className="px-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comercial */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Preço e Fornecedor</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Preço Base de Venda (R$) *" type="number" step="0.01" min="0" value={form.preco || 0} onChange={set('preco')} required />
              <Select label="Fornecedor" value={form.fornecedor_id || ''} onChange={set('fornecedor_id')} options={fornOptions} />
              <Input label="Custo Unitário (R$)" type="number" step="0.0001" min="0" value={form.custo || 0} onChange={set('custo')} />
            </div>
          </div>

          {/* Preços por tabela */}
          {tabelas.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Preços por Tabela</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowTabelas(true)}>
                  <DollarSign size={13} /> Gerenciar tabelas
                </Button>
              </div>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-50">
                {tabelas.map((t) => {
                  const base = Number(form.preco) || 0;
                  const sugerido = base * (1 + Number(t.ajuste_percentual) / 100);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700">{t.nome}</span>
                        {t.padrao && <span className="ml-2 text-xs text-blue-500">padrão</span>}
                        <span className="ml-2 text-xs text-slate-400">
                          {Number(t.ajuste_percentual) === 0 ? 'preço base' : `${t.ajuste_percentual > 0 ? '+' : ''}${t.ajuste_percentual}% · sugerido ${sugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                        </span>
                      </div>
                      <div className="w-40">
                        <input
                          type="number" step="0.01" min="0"
                          value={overrides[t.id] ?? ''}
                          onChange={(e) => setOverrides((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder={sugerido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          className="w-full px-2 py-1.5 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1">Deixe em branco para usar o preço sugerido (base + ajuste %). Preencha para travar um preço específico.</p>
            </div>
          )}

          {/* Estoque */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Estoque</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Estoque Atual" type="number" step="0.001" min="0" value={form.estoque || 0} onChange={set('estoque')} />
              <Input label="Estoque Mínimo (alerta)" type="number" step="0.001" min="0" value={form.estoque_minimo || 0} onChange={set('estoque_minimo')} />
            </div>
          </div>

          {saveMsg && <p className="text-sm text-green-600 font-medium">{saveMsg}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && (
              <Button type="button" variant="danger" size="sm" onClick={() => { setProdToDelete(selected.id); setShowConfirm(true); }}>
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
            <input type="text" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)}
              placeholder="Nome da categoria..."
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <Button type="submit" loading={savingCat} size="sm"><Plus size={14} /> Criar</Button>
          </form>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {categorias.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nenhuma categoria criada</p>
            ) : categorias.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-800 flex items-center gap-2"><Tag size={14} className="text-slate-400" /> {cat.nome}</span>
                <button type="button" onClick={() => handleDeleteCategoria(cat.id)}
                  className="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50 transition-colors">
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Tabelas de Preço Modal */}
      <Modal open={showTabelas} onClose={() => setShowTabelas(false)} title="Tabelas de Preço" size="md">
        <div className="space-y-4">
          <form onSubmit={handleSaveTabela} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nome da tabela</label>
              <input type="text" value={novaTabelaNome} onChange={(e) => setNovaTabelaNome(e.target.value)}
                placeholder="Ex: Atacado"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="w-28">
              <label className="text-xs font-medium text-slate-600 block mb-1">Ajuste %</label>
              <input type="number" step="0.01" value={novaTabelaAjuste} onChange={(e) => setNovaTabelaAjuste(e.target.value)}
                placeholder="-15"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <Button type="submit" loading={savingTab} size="sm"><Plus size={14} /> Criar</Button>
          </form>
          <p className="text-xs text-slate-400">
            O ajuste % é aplicado sobre o preço base do produto (ex: <strong>-15</strong> = 15% de desconto · <strong>+10</strong> = 10% a mais). Use 0 para igualar ao preço base.
          </p>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {tabelas.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <DollarSign size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-800">{t.nome}</span>
                  {t.padrao && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">padrão</span>}
                  <span className="text-xs text-slate-400">
                    {Number(t.ajuste_percentual) === 0 ? 'preço base' : `${t.ajuste_percentual > 0 ? '+' : ''}${t.ajuste_percentual}%`}
                  </span>
                </div>
                {!t.padrao && (
                  <button type="button" onClick={() => handleDeleteTabela(t)}
                    className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Confirm open={showConfirm} title="Desativar produto"
        message="O produto será desativado. Histórico de movimentações e itens em orçamentos/pedidos são preservados."
        confirmLabel="Sim, desativar" loading={deleting}
        onConfirm={handleDelete} onCancel={() => { setShowConfirm(false); setProdToDelete(null); }} />
    </div>
  );
}
