'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/components/PermissionsProvider';
import {
  Plus, Building2, Users, ShieldCheck, Check,
  ChevronDown, UserPlus, KeyRound, RotateCcw, Search, Loader2,
} from 'lucide-react';
import type { Empresa, Usuario } from '@/types/database.types';
import { buscarCNPJ, isCNPJ, formatCpfCnpj } from '@/lib/brasilapi';
import {
  ALL_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS,
  PERMISSION_GROUPS, DEFAULT_ROLE_PERMISSIONS, resolveRoles,
  type UserRole, type Permission,
} from '@/lib/permissions';
import { DEMO_MODE } from '@/lib/demo';

// ── Seletor de papéis (checkboxes) ─────────────────────────────────────────────
function RoleSelector({ value, onChange }: { value: UserRole[]; onChange: (roles: UserRole[]) => void }) {
  const toggle = (role: UserRole) =>
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  return (
    <div className="space-y-2">
      {ALL_ROLES.map((role) => {
        const checked = value.includes(role);
        return (
          <button key={role} type="button" onClick={() => toggle(role)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
              checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}>
            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
              checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
            }`}>
              {checked && <Check size={13} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
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
        <span key={r} className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r]}</span>
      ))}
    </div>
  );
}

export default function ConfiguracoesPage() {
  const { can, map: permMap, reload: reloadPerms } = usePermissions();

  const [empresa, setEmpresa] = useState<Partial<Empresa>>({});
  const [equipe, setEquipe] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>('');
  const [savedMsg, setSavedMsg] = useState('');

  // Cadastro de usuário com senha
  const [showCadastro, setShowCadastro] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoRoles, setNovoRoles] = useState<UserRole[]>(['vendedor']);
  const [cadastroErro, setCadastroErro] = useState('');
  const [cadastroMsg, setCadastroMsg] = useState('');

  // Editar papéis
  const [showRoles, setShowRoles] = useState(false);
  const [editTarget, setEditTarget] = useState<Usuario | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);

  // Cards de permissões expansíveis
  const [openRole, setOpenRole] = useState<UserRole | null>(null);
  const [permEdit, setPermEdit] = useState<Record<UserRole, Set<Permission>>>({
    admin: new Set(), gestor: new Set(), financeiro: new Set(), vendedor: new Set(),
  });
  const [savingPerms, setSavingPerms] = useState<UserRole | null>(null);

  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState('');

  const supabase = createClient();
  const toast = useToast();
  const isAdmin = can('manage_config');

  async function handleBuscarCNPJ() {
    setCnpjMsg('');
    if (!isCNPJ(empresa.cnpj || '')) { setCnpjMsg('Informe um CNPJ com 14 dígitos.'); return; }
    setBuscandoCNPJ(true);
    try {
      const d = await buscarCNPJ(empresa.cnpj || '');
      setEmpresa((p) => ({
        ...p,
        razao_social: d.razaoSocial,
        nome: p.nome || d.nomeFantasia,
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

  useEffect(() => { fetchData(); }, []);

  // Sincroniza o estado editável dos cards com o mapa atual
  useEffect(() => {
    setPermEdit({
      admin: new Set(permMap.admin),
      gestor: new Set(permMap.gestor),
      financeiro: new Set(permMap.financeiro),
      vendedor: new Set(permMap.vendedor),
    });
  }, [permMap]);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    let eid = '';
    if (user) {
      const { data: usr } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single();
      eid = (usr as { empresa_id: string } | null)?.empresa_id || '';
    }
    if (DEMO_MODE) eid = 'demo-empresa-id';
    setEmpresaId(eid);

    const [emp, equi] = await Promise.all([
      eid ? supabase.from('empresas').select('*').eq('id', eid).single() : Promise.resolve({ data: null }),
      supabase.from('usuarios').select('*').order('nome'),
    ]);
    setEmpresa((emp.data as Empresa) || {});
    setEquipe((equi.data as Usuario[]) || []);
    setLoading(false);
  }

  async function handleSaveEmpresa(e: FormEvent) {
    e.preventDefault();
    if (!empresa.id) { toast.error('Empresa não carregada. Recarregue a página.'); return; }
    setSaving(true);
    const { error } = await supabase.from('empresas').update({
      nome: empresa.nome, razao_social: empresa.razao_social, cnpj: empresa.cnpj,
      email: empresa.email, telefone: empresa.telefone, endereco: empresa.endereco,
      cidade: empresa.cidade, estado: empresa.estado, cep: empresa.cep,
      permite_estoque_negativo: empresa.permite_estoque_negativo,
    }).eq('id', empresa.id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Dados da empresa salvos!');
    fetchData(); // recarrega do banco para refletir o que persistiu
  }

  // ── Cadastro direto de usuário (email + senha + papéis) ───────────────────────
  async function handleCadastro(e: FormEvent) {
    e.preventDefault();
    setCadastroErro('');
    setCadastroMsg('');
    if (novoRoles.length === 0) { setCadastroErro('Selecione ao menos um papel.'); return; }
    setSaving(true);

    if (DEMO_MODE) {
      setCadastroMsg(`(Demo) Usuário ${novoEmail} criado com papéis: ${novoRoles.map((r) => ROLE_LABELS[r]).join(', ')}.`);
      setSaving(false);
      setNovoNome(''); setNovoEmail(''); setNovaSenha(''); setNovoRoles(['vendedor']);
      return;
    }

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoNome, email: novoEmail, password: novaSenha, roles: novoRoles }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao criar usuário');
      setCadastroMsg('Usuário criado com sucesso!');
      setNovoNome(''); setNovoEmail(''); setNovaSenha(''); setNovoRoles(['vendedor']);
      fetchData();
      setTimeout(() => { setCadastroMsg(''); setShowCadastro(false); }, 1200);
    } catch (err) {
      setCadastroErro(err instanceof Error ? err.message : 'Erro ao criar usuário');
    } finally {
      setSaving(false);
    }
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

  // ── Permissões por papel (cards expansíveis) ──────────────────────────────────
  function togglePerm(role: UserRole, perm: Permission) {
    setPermEdit((prev) => {
      const next = new Set(prev[role]);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return { ...prev, [role]: next };
    });
  }

  function resetRolePerms(role: UserRole) {
    setPermEdit((prev) => ({ ...prev, [role]: new Set(DEFAULT_ROLE_PERMISSIONS[role]) }));
  }

  async function saveRolePerms(role: UserRole) {
    setSavingPerms(role);
    const perms = Array.from(permEdit[role]);
    if (!DEMO_MODE && empresaId) {
      await supabase.rpc('salvar_permissoes_papel', { p_papel: role, p_permissoes: perms });
      reloadPerms();
    }
    setTimeout(() => setSavingPerms(null), 500);
  }

  const set = (key: keyof Empresa) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEmpresa((p) => ({ ...p, [key]: e.target.value }));

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
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">CNPJ</label>
              <div className="flex gap-2">
                <input value={empresa.cnpj || ''} disabled={!isAdmin}
                  onChange={(e) => setEmpresa((p) => ({ ...p, cnpj: formatCpfCnpj(e.target.value) }))}
                  placeholder="00.000.000/0001-00"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50" />
                {isAdmin && (
                  <Button type="button" variant="secondary" size="sm" onClick={handleBuscarCNPJ}
                    disabled={buscandoCNPJ || !isCNPJ(empresa.cnpj || '')} title="Buscar dados na Receita">
                    {buscandoCNPJ ? <Loader2 size={14} className="animate-spin" /> : <><Search size={14} /> Buscar</>}
                  </Button>
                )}
              </div>
              {cnpjMsg && <p className={`text-xs mt-1 ${cnpjMsg.includes('Erro') || cnpjMsg.includes('Informe') || cnpjMsg.includes('não') ? 'text-red-500' : 'text-green-600'}`}>{cnpjMsg}</p>}
            </div>
            <Input label="Nome Fantasia" value={empresa.nome || ''} onChange={set('nome')} disabled={!isAdmin} />
            <Input label="Razão Social" value={empresa.razao_social || ''} onChange={set('razao_social')} disabled={!isAdmin} />
            <Input label="E-mail" type="email" value={empresa.email || ''} onChange={set('email')} disabled={!isAdmin} />
            <Input label="Telefone" value={empresa.telefone || ''} onChange={set('telefone')} disabled={!isAdmin} />
            <Input label="CEP" value={empresa.cep || ''} onChange={set('cep')} disabled={!isAdmin} />
            <Input label="Endereço" value={empresa.endereco || ''} onChange={set('endereco')} disabled={!isAdmin} />
            <Input label="Cidade" value={empresa.cidade || ''} onChange={set('cidade')} disabled={!isAdmin} />
            <Input label="Estado (UF)" value={empresa.estado || ''} onChange={set('estado')} maxLength={2} disabled={!isAdmin} />
          </div>

          {/* Preferência de estoque */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Permitir estoque negativo</p>
              <p className="text-xs text-slate-400">
                Ativado: a venda conclui mesmo sem saldo (estoque pode ficar negativo). Desativado: o faturamento é bloqueado se faltar estoque.
              </p>
            </div>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setEmpresa((p) => ({ ...p, permite_estoque_negativo: !p.permite_estoque_negativo }))}
              className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${empresa.permite_estoque_negativo ? 'bg-blue-600' : 'bg-slate-300'} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${empresa.permite_estoque_negativo ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
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
            <Button size="sm" onClick={() => { setShowCadastro(true); setCadastroErro(''); setCadastroMsg(''); }}>
              <UserPlus size={14} /> Cadastrar usuário
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
                    <p className="font-medium text-slate-800 truncate">{u.nome}</p>
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
                  {isAdmin && (
                    <Button variant={u.ativo ? 'danger' : 'success'} size="sm" onClick={() => handleToggleAtivo(u.id, u.ativo)}>
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {equipe.length === 0 && (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">
              Nenhum membro ainda. Clique em &quot;Cadastrar usuário&quot; para adicionar.
            </div>
          )}
        </div>
      </div>

      {/* Permissões por papel — cards expansíveis */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <ShieldCheck size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-900">Permissões por Papel</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {ALL_ROLES.map((role) => {
            const isOpen = openRole === role;
            const isAdminRole = role === 'admin';
            const count = permEdit[role].size;
            return (
              <div key={role}>
                {/* Cabeçalho do card */}
                <button
                  onClick={() => setOpenRole(isOpen ? null : role)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                    <span className="text-sm text-slate-500">{ROLE_DESCRIPTIONS[role]}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{count} permissões</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Corpo expansível */}
                {isOpen && (
                  <div className="px-6 pb-5 bg-slate-50/50">
                    {isAdminRole && (
                      <div className="mb-3 p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                        O papel Administrador sempre tem acesso total — não é editável.
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                      {PERMISSION_GROUPS.map((group) => (
                        <div key={group.modulo} className="py-2">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">{group.modulo}</p>
                          <div className="space-y-1">
                            {group.permissions.map((p) => {
                              const checked = permEdit[role].has(p.key);
                              return (
                                <label key={p.key}
                                  className={`flex items-center gap-2 text-sm ${isAdminRole ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                  <button
                                    type="button"
                                    disabled={isAdminRole || !isAdmin}
                                    onClick={() => togglePerm(role, p.key)}
                                    className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${
                                      checked ? 'bg-blue-600' : 'bg-slate-300'
                                    } ${isAdminRole ? 'cursor-not-allowed' : ''}`}
                                  >
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
                                  </button>
                                  <span className="text-slate-700">{p.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!isAdminRole && isAdmin && (
                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
                        <Button size="sm" loading={savingPerms === role} onClick={() => saveRolePerms(role)}>
                          {savingPerms === role ? 'Salvando...' : 'Salvar permissões'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => resetRolePerms(role)}>
                          <RotateCcw size={13} /> Restaurar padrão
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {DEMO_MODE && (
          <p className="px-6 py-3 text-xs text-amber-600 border-t border-slate-50">
            Modo demo: as alterações de permissão não são persistidas.
          </p>
        )}
      </div>

      {/* Cadastro de Usuário Modal */}
      <Modal open={showCadastro} onClose={() => setShowCadastro(false)} title="Cadastrar Usuário" size="md">
        <form onSubmit={handleCadastro} className="space-y-4">
          {cadastroErro && <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{cadastroErro}</div>}
          {cadastroMsg && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{cadastroMsg}</div>}
          <Input label="Nome *" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required placeholder="Nome do colaborador" />
          <Input label="E-mail *" type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} required placeholder="colaborador@empresa.com" />
          <Input label="Senha *" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={6}
            placeholder="Mínimo 6 caracteres" />
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2 flex items-center gap-1">
              <KeyRound size={14} /> Papéis * (pode marcar mais de um)
            </label>
            <RoleSelector value={novoRoles} onChange={setNovoRoles} />
          </div>
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="flex-1">Criar Usuário</Button>
            <Button type="button" variant="secondary" onClick={() => setShowCadastro(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Editar Papéis Modal */}
      <Modal open={showRoles} onClose={() => setShowRoles(false)} title={`Papéis — ${editTarget?.nome}`} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Marque um ou mais papéis. As permissões são a união de todos os papéis.</p>
          <RoleSelector value={editRoles} onChange={setEditRoles} />
          {editRoles.length === 0 && <p className="text-xs text-red-500">Selecione ao menos um papel.</p>}
          <div className="flex gap-3">
            <Button onClick={handleSaveRoles} loading={saving} disabled={editRoles.length === 0} className="flex-1">Salvar Papéis</Button>
            <Button variant="secondary" onClick={() => setShowRoles(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
