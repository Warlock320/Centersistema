'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Building2, Users, Mail, ShieldCheck, Copy, Check } from 'lucide-react';
import type { Empresa, Usuario, Convite } from '@/types/database.types';
import {
  ALL_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS,
  can, resolveRoles, type UserRole,
} from '@/lib/permissions';

// Seletor de papéis (checkboxes) reutilizável
function RoleSelector({ value, onChange }: { value: UserRole[]; onChange: (roles: UserRole[]) => void }) {
  const toggle = (role: UserRole) => {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  };
  return (
    <div className="space-y-2">
      {ALL_ROLES.map((role) => {
        const checked = value.includes(role);
        return (
          <button
            key={role}
            type="button"
            onClick={() => toggle(role)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
              checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
            }`}>
              {checked && <Check size={13} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RoleBadges({ roles }: { roles: UserRole[] }) {
  if (roles.length === 0) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {roles.map((r) => (
        <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}>
          {ROLE_LABELS[r]}
        </span>
      ))}
    </div>
  );
}

// Matriz de permissões para referência visual
const MATRIZ: { modulo: string; perms: Partial<Record<UserRole, string>> }[] = [
  { modulo: 'Dashboard', perms: { admin: '✓', gestor: '✓', financeiro: '✓', vendedor: '✓' } },
  { modulo: 'Clientes', perms: { admin: '✓', gestor: '✓', financeiro: 'ver', vendedor: '✓' } },
  { modulo: 'Produtos / Fornecedores', perms: { admin: '✓', gestor: '✓', financeiro: 'ver', vendedor: 'ver' } },
  { modulo: 'Orçamentos', perms: { admin: '✓', gestor: '✓', financeiro: 'ver', vendedor: 'criar' } },
  { modulo: 'Aprovar Orçamentos', perms: { admin: '✓', gestor: '✓', financeiro: '—', vendedor: '—' } },
  { modulo: 'Pedidos / NF-e', perms: { admin: '✓', gestor: '✓', financeiro: 'ver', vendedor: '✓' } },
  { modulo: 'Financeiro', perms: { admin: '✓', gestor: 'ver', financeiro: '✓', vendedor: '—' } },
  { modulo: 'Aprovar Contas a Pagar', perms: { admin: '✓', gestor: '✓', financeiro: '✓', vendedor: '—' } },
  { modulo: 'Pagar / Bancos', perms: { admin: '✓', gestor: '—', financeiro: '✓', vendedor: '—' } },
  { modulo: 'Relatórios', perms: { admin: '✓', gestor: '✓', financeiro: '✓', vendedor: '—' } },
  { modulo: 'Configurações / Equipe', perms: { admin: '✓', gestor: '—', financeiro: '—', vendedor: '—' } },
];

export default function ConfiguracoesPage() {
  const [empresa, setEmpresa] = useState<Partial<Empresa>>({});
  const [equipe, setEquipe] = useState<Usuario[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [savedMsg, setSavedMsg] = useState('');

  // Convite
  const [showConvite, setShowConvite] = useState(false);
  const [conviteEmail, setConviteEmail] = useState('');
  const [conviteRoles, setConviteRoles] = useState<UserRole[]>(['vendedor']);
  const [conviteLink, setConviteLink] = useState('');
  const [copiado, setCopiado] = useState(false);

  // Editar papéis
  const [showRoles, setShowRoles] = useState(false);
  const [editTarget, setEditTarget] = useState<Usuario | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: usr } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
    if (!usr) { setLoading(false); return; }
    setUsuario(usr as Usuario);

    const [emp, equi, conv] = await Promise.all([
      supabase.from('empresas').select('*').eq('id', usr.empresa_id).single(),
      supabase.from('usuarios').select('*').order('nome'),
      supabase.from('convites').select('*').eq('usado', false).order('created_at', { ascending: false }),
    ]);

    setEmpresa(emp.data as Empresa || {});
    setEquipe(equi.data as Usuario[] || []);
    setConvites(conv.data as Convite[] || []);
    setLoading(false);
  }

  async function handleSaveEmpresa(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('empresas').update({
      nome: empresa.nome, razao_social: empresa.razao_social, cnpj: empresa.cnpj,
      email: empresa.email, telefone: empresa.telefone, endereco: empresa.endereco,
      cidade: empresa.cidade, estado: empresa.estado, cep: empresa.cep,
    }).eq('id', empresa.id!);
    setSaving(false);
    setSavedMsg('Dados salvos com sucesso!');
    setTimeout(() => setSavedMsg(''), 3000);
  }

  async function handleConvite(e: FormEvent) {
    e.preventDefault();
    if (conviteRoles.length === 0) { alert('Selecione ao menos um papel.'); return; }
    const { data } = await supabase.from('convites').insert({
      empresa_id: usuario?.empresa_id,
      email: conviteEmail,
      roles: conviteRoles,
    }).select().single();

    // Monta link de convite
    const token = (data as Convite | null)?.token;
    if (token) {
      setConviteLink(`${window.location.origin}/login?convite=${token}`);
    }
    setConviteEmail('');
    setConviteRoles(['vendedor']);
    fetchData();
  }

  function openEditRoles(u: Usuario) {
    setEditTarget(u);
    setEditRoles(resolveRoles(u));
    setShowRoles(true);
  }

  async function handleSaveRoles() {
    if (!editTarget || editRoles.length === 0) return;
    setSaving(true);
    await supabase.from('usuarios').update({ roles: editRoles }).eq('id', editTarget.id);
    setSaving(false);
    setShowRoles(false);
    setEditTarget(null);
    fetchData();
  }

  async function handleToggleAtivo(uid: string, ativo: boolean) {
    await supabase.from('usuarios').update({ ativo: !ativo }).eq('id', uid);
    fetchData();
  }

  function copyLink() {
    navigator.clipboard?.writeText(conviteLink);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const set = (key: keyof Empresa) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEmpresa((p) => ({ ...p, [key]: e.target.value }));

  const isAdmin = can(resolveRoles(usuario || {}), 'manage_config');

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 text-sm">Dados da empresa, equipe e papéis de acesso</p>
      </div>

      {!isAdmin && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl text-sm">
          Apenas administradores podem editar as configurações e gerenciar a equipe.
        </div>
      )}

      {/* Dados da Empresa */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Building2 size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Dados da Empresa</h2>
        </div>
        <form onSubmit={handleSaveEmpresa} className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nome Fantasia" value={empresa.nome || ''} onChange={set('nome')} disabled={!isAdmin} />
            <Input label="Razão Social" value={empresa.razao_social || ''} onChange={set('razao_social')} disabled={!isAdmin} />
            <Input label="CNPJ" value={empresa.cnpj || ''} onChange={set('cnpj')} disabled={!isAdmin} />
            <Input label="E-mail" type="email" value={empresa.email || ''} onChange={set('email')} disabled={!isAdmin} />
            <Input label="Telefone" value={empresa.telefone || ''} onChange={set('telefone')} disabled={!isAdmin} />
            <Input label="CEP" value={empresa.cep || ''} onChange={set('cep')} disabled={!isAdmin} />
            <Input label="Endereço" value={empresa.endereco || ''} onChange={set('endereco')} disabled={!isAdmin} />
            <Input label="Cidade" value={empresa.cidade || ''} onChange={set('cidade')} disabled={!isAdmin} />
            <Input label="Estado (UF)" value={empresa.estado || ''} onChange={set('estado')} maxLength={2} disabled={!isAdmin} />
          </div>
          {savedMsg && <p className="text-green-600 text-sm">{savedMsg}</p>}
          {isAdmin && <Button type="submit" loading={saving}>Salvar Dados</Button>}
        </form>
      </div>

      {/* Equipe */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-900">Equipe ({equipe.length})</h2>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => { setShowConvite(true); setConviteLink(''); }}>
              <Plus size={14} /> Convidar
            </Button>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {equipe.map((u) => {
            const roles = resolveRoles(u);
            return (
              <div key={u.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                    {u.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      {u.nome} {u.id === usuario?.id && <span className="text-xs text-slate-400">(você)</span>}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RoleBadges roles={roles} />
                  {!u.ativo && <span className="text-xs text-red-500">Inativo</span>}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => openEditRoles(u)}>
                      <ShieldCheck size={14} /> Papéis
                    </Button>
                  )}
                  {isAdmin && u.id !== usuario?.id && (
                    <Button variant={u.ativo ? 'danger' : 'success'} size="sm" onClick={() => handleToggleAtivo(u.id, u.ativo)}>
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Convites pendentes */}
      {isAdmin && convites.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <Mail size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-900">Convites Pendentes ({convites.length})</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {convites.map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.email}</p>
                  <p className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <RoleBadges roles={resolveRoles(c)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matriz de permissões (referência) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Matriz de Permissões por Papel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Módulo</th>
                {ALL_ROLES.map((r) => (
                  <th key={r} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIZ.map((row) => (
                <tr key={row.modulo} className="border-b border-slate-50">
                  <td className="px-6 py-2.5 text-slate-700">{row.modulo}</td>
                  {ALL_ROLES.map((r) => {
                    const v = row.perms[r] || '—';
                    const color = v === '✓' ? 'text-green-600 font-bold'
                      : v === '—' ? 'text-slate-300'
                      : 'text-slate-500 text-xs';
                    return <td key={r} className={`px-4 py-2.5 text-center ${color}`}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-50">
          ✓ = acesso completo · ver = somente visualização · criar = pode criar mas não aprovar · — = sem acesso
        </p>
      </div>

      {/* Convite Modal */}
      <Modal open={showConvite} onClose={() => setShowConvite(false)} title="Convidar Membro da Equipe" size="md">
        {conviteLink ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              Convite gerado! Compartilhe o link abaixo com o colaborador.
            </div>
            <div className="flex gap-2">
              <input readOnly value={conviteLink}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono text-xs" />
              <Button type="button" variant="secondary" onClick={copyLink}>
                {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <Button onClick={() => { setShowConvite(false); setConviteLink(''); }} className="w-full">Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleConvite} className="space-y-4">
            <Input label="E-mail *" type="email" value={conviteEmail}
              onChange={(e) => setConviteEmail(e.target.value)} placeholder="colaborador@empresa.com" required />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Papéis * (pode marcar mais de um)</label>
              <RoleSelector value={conviteRoles} onChange={setConviteRoles} />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1">Gerar Convite</Button>
              <Button type="button" variant="secondary" onClick={() => setShowConvite(false)}>Cancelar</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Editar Papéis Modal */}
      <Modal open={showRoles} onClose={() => setShowRoles(false)} title={`Papéis — ${editTarget?.nome}`} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Marque um ou mais papéis. As permissões são a união de todos os papéis selecionados.
          </p>
          <RoleSelector value={editRoles} onChange={setEditRoles} />
          {editRoles.length === 0 && (
            <p className="text-xs text-red-500">Selecione ao menos um papel.</p>
          )}
          <div className="flex gap-3">
            <Button onClick={handleSaveRoles} loading={saving} disabled={editRoles.length === 0} className="flex-1">
              Salvar Papéis
            </Button>
            <Button variant="secondary" onClick={() => setShowRoles(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
