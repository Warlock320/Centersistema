'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Confirm } from '@/components/ui/Confirm';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Plus, Pencil, Building2, Search, Loader2, Star } from 'lucide-react';
import type { Unidade } from '@/types/database.types';
import { buscarCNPJ, isCNPJ, formatCpfCnpj } from '@/lib/brasilapi';

const EMPTY: Partial<Unidade> = {
  razao_social: '', nome_fantasia: '', cnpj: '', endereco: '', telefone: '', ativo: true,
};

export default function EmpresasPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState<Unidade | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Unidade | null>(null);
  const [form, setForm] = useState<Partial<Unidade>>(EMPTY);
  const [saveMsg, setSaveMsg] = useState('');

  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState('');

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('unidades').select('*').order('padrao', { ascending: false }).order('razao_social');
    setUnidades(data as Unidade[] || []);
    setLoading(false);
  }

  function openForm(u?: Unidade) {
    setSelected(u || null);
    setForm(u ? { ...u } : EMPTY);
    setSaveMsg('');
    setCnpjMsg('');
    setShowForm(true);
  }

  async function handleBuscarCNPJ() {
    setCnpjMsg('');
    if (!isCNPJ(form.cnpj || '')) { setCnpjMsg('Informe um CNPJ com 14 dígitos.'); return; }
    setBuscandoCNPJ(true);
    try {
      const d = await buscarCNPJ(form.cnpj || '');
      setForm((p) => ({
        ...p,
        razao_social: d.razaoSocial,
        nome_fantasia: p.nome_fantasia || d.nomeFantasia,
        telefone: p.telefone || d.telefone,
        endereco: [d.enderecoCompleto, d.municipio, d.uf].filter(Boolean).join(' - '),
      }));
      setCnpjMsg(d.situacao ? `Encontrado · situação: ${d.situacao}` : 'Dados preenchidos!');
    } catch (err) {
      setCnpjMsg(err instanceof Error ? err.message : 'Erro ao consultar CNPJ');
    } finally {
      setBuscandoCNPJ(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia || null,
      cnpj: form.cnpj || null,
      endereco: form.endereco || null,
      telefone: form.telefone || null,
      ativo: form.ativo ?? true,
    };
    if (selected) {
      await supabase.from('unidades').update(payload).eq('id', selected.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      await supabase.from('unidades').insert({ ...payload, empresa_id: (usr as { empresa_id: string })!.empresa_id });
    }
    setSaving(false);
    setSaveMsg('Salvo!');
    fetchData();
    setTimeout(() => { setSaveMsg(''); setShowForm(false); }, 800);
  }

  async function handleTornarPadrao(u: Unidade) {
    // Remove padrão de todas e marca esta
    await supabase.from('unidades').update({ padrao: false }).eq('empresa_id', u.empresa_id);
    await supabase.from('unidades').update({ padrao: true }).eq('id', u.id);
    fetchData();
  }

  async function handleDelete() {
    if (!toDelete) return;
    if (toDelete.padrao) { alert('A unidade padrão não pode ser desativada. Defina outra como padrão antes.'); setShowConfirm(false); return; }
    setDeleting(true);
    await supabase.from('unidades').update({ ativo: false }).eq('id', toDelete.id);
    setDeleting(false);
    setShowConfirm(false);
    setToDelete(null);
    fetchData();
  }

  const set = (key: keyof Unidade) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const columns: Column<Unidade>[] = [
    { key: 'razao_social', label: 'Empresa', render: (r) => (
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{r.nome_fantasia || r.razao_social}</span>
          {r.padrao && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10} /> Padrão</span>}
        </div>
        {r.nome_fantasia && <p className="text-xs text-slate-400">{r.razao_social}</p>}
      </div>
    )},
    { key: 'cnpj', label: 'CNPJ', render: (r) => r.cnpj ? formatCpfCnpj(r.cnpj) : <span className="text-slate-300">—</span> },
    { key: 'telefone', label: 'Telefone', render: (r) => r.telefone || <span className="text-slate-300">—</span> },
    { key: 'ativo', label: 'Status', render: (r) => (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
        {r.ativo ? 'Ativa' : 'Inativa'}
      </span>
    )},
    { key: 'acoes', label: '', render: (r) => (
      <div className="flex gap-1 justify-end">
        {!r.padrao && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleTornarPadrao(r); }} title="Tornar padrão">
            <Star size={14} />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(r); }}>
          <Pencil size={14} />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas (CNPJs)</h1>
          <p className="text-slate-500 text-sm">{unidades.length} empresa(s) · use para separar o financeiro por CNPJ</p>
        </div>
        <Button onClick={() => openForm()}><Plus size={16} /> Nova Empresa</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <DataTable columns={columns} data={unidades} keyField="id" loading={loading}
          emptyMessage="Nenhuma empresa cadastrada." />
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Empresa' : 'Nova Empresa (CNPJ)'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">CNPJ</label>
            <div className="flex gap-2">
              <input value={form.cnpj || ''} onChange={(e) => setForm((p) => ({ ...p, cnpj: formatCpfCnpj(e.target.value) }))}
                placeholder="00.000.000/0001-00"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <Button type="button" variant="secondary" size="sm" onClick={handleBuscarCNPJ}
                disabled={buscandoCNPJ || !isCNPJ(form.cnpj || '')} title="Buscar dados na Receita">
                {buscandoCNPJ ? <Loader2 size={14} className="animate-spin" /> : <><Search size={14} /> Buscar</>}
              </Button>
            </div>
            {cnpjMsg && <p className={`text-xs mt-1 ${cnpjMsg.includes('Erro') || cnpjMsg.includes('Informe') || cnpjMsg.includes('não') ? 'text-red-500' : 'text-green-600'}`}>{cnpjMsg}</p>}
          </div>

          <Input label="Razão Social *" value={form.razao_social || ''} onChange={set('razao_social')} required />
          <Input label="Nome Fantasia" value={form.nome_fantasia || ''} onChange={set('nome_fantasia')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Telefone" value={form.telefone || ''} onChange={set('telefone')} placeholder="(11) 99999-9999" />
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                <input type="checkbox" checked={form.ativo ?? true}
                  onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300" />
                Empresa ativa
              </label>
            </div>
          </div>
          <Textarea label="Endereço" value={form.endereco || ''} onChange={set('endereco')} />

          {saveMsg && <p className="text-sm text-green-600 font-medium">{saveMsg}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={saving} className="flex-1">Salvar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            {selected && !selected.padrao && (
              <Button type="button" variant="danger" size="sm" onClick={() => { setToDelete(selected); setShowConfirm(true); }}>
                Desativar
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <Confirm open={showConfirm} title="Desativar empresa"
        message="A empresa será desativada e não aparecerá mais para novos lançamentos. O histórico é preservado."
        confirmLabel="Desativar" loading={deleting}
        onConfirm={handleDelete} onCancel={() => { setShowConfirm(false); setToDelete(null); }} />
    </div>
  );
}
