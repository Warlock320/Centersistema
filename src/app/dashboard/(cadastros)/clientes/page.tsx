'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Plus, History, Pencil } from 'lucide-react';
import type { Cliente, Orcamento, Pedido } from '@/types/database.types';

const EMPTY: Partial<Cliente> = {
  nome: '', tipo: 'juridica', cpf_cnpj: '', email: '',
  telefone: '', endereco: '', cidade: '', estado: '', cep: '', observacoes: '',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtered, setFiltered] = useState<Cliente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showFicha, setShowFicha] = useState(false);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>(EMPTY);

  const [ficha, setFicha] = useState<{ ltv: number; orcamentos: Orcamento[]; pedidos: Pedido[] } | null>(null);

  const supabase = createClient();

  useEffect(() => { fetchClientes(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      clientes.filter((c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.cpf_cnpj || '').includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      )
    );
  }, [search, clientes]);

  async function fetchClientes() {
    setLoading(true);
    const { data } = await supabase.from('clientes').select('*').eq('ativo', true).order('nome');
    setClientes(data || []);
    setFiltered(data || []);
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
    setShowForm(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };

    if (selected) {
      await supabase.from('clientes').update(payload).eq('id', selected.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single();
      await supabase.from('clientes').insert({ ...payload, empresa_id: usr!.empresa_id });
    }

    setSaving(false);
    setShowForm(false);
    fetchClientes();
  }

  async function handleDelete(id: string) {
    if (!confirm('Desativar este cliente?')) return;
    await supabase.from('clientes').update({ ativo: false }).eq('id', id);
    fetchClientes();
  }

  const set = (key: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const statusOrc: Record<string, string> = {
    criado: 'bg-slate-100 text-slate-700', orcamento_enviado: 'bg-blue-100 text-blue-700',
    aguardando_aprovacao: 'bg-yellow-100 text-yellow-700', aprovado: 'bg-green-100 text-green-700',
    aguardando_pecas: 'bg-orange-100 text-orange-700', enviado: 'bg-teal-100 text-teal-700', cancelado: 'bg-red-100 text-red-700',
  };
  const statusPed: Record<string, string> = {
    aberto: 'bg-blue-100 text-blue-700', em_andamento: 'bg-yellow-100 text-yellow-700',
    faturado: 'bg-green-100 text-green-700', cancelado: 'bg-red-100 text-red-700',
  };

  const columns: Column<Cliente>[] = [
    { key: 'nome', label: 'Nome', render: (r) => <span className="font-medium text-slate-900">{r.nome}</span> },
    { key: 'tipo', label: 'Tipo', render: (r) => <span className="capitalize text-xs px-2 py-1 bg-slate-100 rounded-full">{r.tipo}</span> },
    { key: 'cpf_cnpj', label: 'CPF/CNPJ', render: (r) => r.cpf_cnpj || <span className="text-slate-300">—</span> },
    { key: 'telefone', label: 'Telefone', render: (r) => r.telefone || <span className="text-slate-300">—</span> },
    { key: 'cidade', label: 'Cidade', render: (r) => r.cidade ? `${r.cidade}/${r.estado}` : <span className="text-slate-300">—</span> },
    {
      key: 'acoes', label: '', render: (r) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openFicha(r); }}>
            <History size={14} /> Ficha 360°
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openForm(r); }}>
            <Pencil size={14} />
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm">{clientes.length} cliente(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => openForm()}>
          <Plus size={16} /> Novo Cliente
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100">
          <input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <DataTable columns={columns} data={filtered} keyField="id" loading={loading} />
      </div>

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={selected ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Nome *" value={form.nome || ''} onChange={set('nome')} required />
            </div>
            <Select
              label="Tipo"
              value={form.tipo || 'juridica'}
              onChange={set('tipo')}
              options={[{ value: 'juridica', label: 'Pessoa Jurídica' }, { value: 'fisica', label: 'Pessoa Física' }]}
            />
            <Input label="CPF / CNPJ" value={form.cpf_cnpj || ''} onChange={set('cpf_cnpj')} />
            <Input label="E-mail" type="email" value={form.email || ''} onChange={set('email')} />
            <Input label="Telefone" value={form.telefone || ''} onChange={set('telefone')} />
            <Input label="Endereço" value={form.endereco || ''} onChange={set('endereco')} />
            <Input label="CEP" value={form.cep || ''} onChange={set('cep')} />
            <Input label="Cidade" value={form.cidade || ''} onChange={set('cidade')} />
            <Input label="Estado (UF)" value={form.estado || ''} onChange={set('estado')} maxLength={2} />
          </div>
          <Textarea label="Observações" value={form.observacoes || ''} onChange={set('observacoes')} />
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

      {/* Ficha 360° Modal */}
      <Modal open={showFicha} onClose={() => setShowFicha(false)} title={`Ficha 360° — ${selected?.nome}`} size="xl">
        {!ficha ? (
          <div className="flex justify-center py-12 text-slate-400">Carregando histórico...</div>
        ) : (
          <div className="space-y-6">
            {/* LTV */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 flex items-center gap-4">
              <div>
                <p className="text-sm text-blue-600 font-medium">Lifetime Value (LTV)</p>
                <p className="text-3xl font-bold text-blue-800">
                  {ficha.ltv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-blue-500">Total em pedidos faturados</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm text-blue-600">{selected?.telefone || '—'}</p>
                <p className="text-sm text-blue-600">{selected?.email || '—'}</p>
                <p className="text-xs text-blue-400">{selected?.cidade && `${selected.cidade}/${selected.estado}`}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Orçamentos */}
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Orçamentos ({ficha.orcamentos.length})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {ficha.orcamentos.length === 0 ? (
                    <p className="text-sm text-slate-400">Nenhum orçamento</p>
                  ) : ficha.orcamentos.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">#{o.numero}</p>
                        <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusOrc[o.status] || 'bg-slate-100 text-slate-600'}`}>{o.status.replace('_', ' ')}</span>
                        <p className="text-sm font-medium text-slate-700 mt-1">{Number(o.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pedidos */}
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Pedidos ({ficha.pedidos.length})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {ficha.pedidos.length === 0 ? (
                    <p className="text-sm text-slate-400">Nenhum pedido</p>
                  ) : ficha.pedidos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">#{p.numero}</p>
                        <p className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusPed[p.status] || 'bg-slate-100 text-slate-600'}`}>{p.status.replace('_', ' ')}</span>
                        <p className="text-sm font-medium text-slate-700 mt-1">{Number(p.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
