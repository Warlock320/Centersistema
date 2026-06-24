'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/components/PermissionsProvider';
import { Plus, Pencil, Trash2, Shield, Check } from 'lucide-react';
import { PERMISSION_GROUPS, type Permission, type PapelCustom } from '@/lib/permissions';

const CORES = [
  'bg-slate-100 text-slate-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-red-100 text-red-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
];

export default function PapeisCustomSection() {
  const supabase = createClient();
  const toast = useToast();
  const { reload: reloadPerms } = usePermissions();

  const [papeis, setPapeis] = useState<PapelCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState(CORES[0]);
  const [permissoes, setPermissoes] = useState<Set<Permission>>(new Set());

  useEffect(() => { fetchPapeis(); }, []);

  async function fetchPapeis() {
    setLoading(true);
    const { data } = await supabase.from('papeis_custom')
      .select('*').eq('ativo', true).order('nome');
    setPapeis((data || []) as PapelCustom[]);
    setLoading(false);
  }

  function resetForm() {
    setEditId(null);
    setNome('');
    setDescricao('');
    setCor(CORES[0]);
    setPermissoes(new Set());
  }

  function openNew() { resetForm(); setShowForm(true); }

  function openEdit(p: PapelCustom) {
    setEditId(p.id);
    setNome(p.nome);
    setDescricao(p.descricao || '');
    setCor(p.cor || CORES[0]);
    setPermissoes(new Set(p.permissoes as Permission[]));
    setShowForm(true);
  }

  function togglePerm(perm: Permission) {
    setPermissoes((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return next;
    });
  }

  async function handleSave() {
    if (!nome.trim()) { toast.error('Informe o nome do papel.'); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
    if (!usr) { setSaving(false); return; }
    const empresaId = (usr as { empresa_id: string }).empresa_id;

    const payload = {
      empresa_id: empresaId,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      cor,
      permissoes: Array.from(permissoes),
      ativo: true,
    };

    if (editId) {
      const { error } = await supabase.from('papeis_custom').update(payload).eq('id', editId);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      toast.success('Papel atualizado!');
    } else {
      const { error } = await supabase.from('papeis_custom').insert(payload);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      toast.success('Papel criado!');
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    fetchPapeis();
    reloadPerms();
  }

  async function handleDelete(p: PapelCustom) {
    if (!confirm(`Excluir o papel "${p.nome}"? Usuários com esse papel perderão as permissões associadas.`)) return;
    await supabase.from('papeis_custom').update({ ativo: false }).eq('id', p.id);
    toast.success('Papel removido.');
    fetchPapeis();
    reloadPerms();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Papéis Customizados</h2>
        </div>
        <Button size="sm" onClick={openNew}><Plus size={14} /> Novo Papel</Button>
      </div>

      {loading ? (
        <div className="px-6 py-8 text-center text-sm text-slate-400">Carregando...</div>
      ) : papeis.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-slate-400">
          Nenhum papel customizado. Clique em "Novo Papel" para criar.
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {papeis.map((p) => (
            <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.cor}`}>{p.nome}</span>
                <span className="text-xs text-slate-400">{p.permissoes.length} permissões</span>
                {p.descricao && <span className="text-xs text-slate-400 hidden sm:inline">— {p.descricao}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p)}><Trash2 size={14} className="text-red-500" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editId ? 'Editar Papel' : 'Novo Papel Customizado'} size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome do papel *" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Supervisor, Estoquista, Gerente de Vendas" />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Cor</label>
              <div className="flex flex-wrap gap-1.5">
                {CORES.map((c) => (
                  <button key={c} type="button" onClick={() => setCor(c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${c} ${cor === c ? 'border-blue-500 scale-110' : 'border-transparent'}`} />
                ))}
              </div>
            </div>
          </div>
          <Textarea label="Descrição (opcional)" value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que este papel faz no sistema..." />

          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Permissões ({permissoes.size} selecionadas)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 max-h-80 overflow-y-auto">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.modulo} className="py-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">{group.modulo}</p>
                  <div className="space-y-1">
                    {group.permissions.map((p) => {
                      const checked = permissoes.has(p.key);
                      return (
                        <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <button type="button" onClick={() => togglePerm(p.key)}
                            className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'
                            }`}>
                            {checked && <Check size={12} className="text-white" />}
                          </button>
                          <span className="text-slate-700">{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editId ? 'Salvar Alterações' : 'Criar Papel'}
            </Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
