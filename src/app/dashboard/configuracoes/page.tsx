'use client';

import { useEffect, useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Plus, Building2, Users, Mail } from 'lucide-react';
import type { Empresa, Usuario, Convite, UserRole } from '@/types/database.types';

export default function ConfiguracoesPage() {
  const [empresa, setEmpresa] = useState<Partial<Empresa>>({});
  const [equipe, setEquipe] = useState<Usuario[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConvite, setShowConvite] = useState(false);
  const [conviteEmail, setConviteEmail] = useState('');
  const [conviteRole, setConviteRole] = useState<UserRole>('vendedor');
  const [savedMsg, setSavedMsg] = useState('');
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: usr } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
    if (!usr) return;
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
      nome: empresa.nome,
      razao_social: empresa.razao_social,
      cnpj: empresa.cnpj,
      email: empresa.email,
      telefone: empresa.telefone,
      endereco: empresa.endereco,
      cidade: empresa.cidade,
      estado: empresa.estado,
      cep: empresa.cep,
    }).eq('id', empresa.id!);
    setSaving(false);
    setSavedMsg('Dados salvos com sucesso!');
    setTimeout(() => setSavedMsg(''), 3000);
  }

  async function handleConvite(e: FormEvent) {
    e.preventDefault();
    await supabase.from('convites').insert({
      empresa_id: usuario?.empresa_id,
      email: conviteEmail,
      role: conviteRole,
    });
    setShowConvite(false);
    setConviteEmail('');
    fetchData();
  }

  async function handleToggleAtivo(uid: string, ativo: boolean) {
    await supabase.from('usuarios').update({ ativo: !ativo }).eq('id', uid);
    fetchData();
  }

  const set = (key: keyof Empresa) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEmpresa((p) => ({ ...p, [key]: e.target.value }));

  const isAdmin = usuario?.role === 'admin';

  if (loading) return <div className="py-16 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 text-sm">Dados fiscais da empresa e gerenciamento de equipe</p>
      </div>

      {!isAdmin && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl text-sm">
          Apenas administradores podem editar as configurações.
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
          {isAdmin && (
            <Button type="submit" loading={saving}>Salvar Dados</Button>
          )}
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
            <Button size="sm" onClick={() => setShowConvite(true)}>
              <Plus size={14} /> Convidar
            </Button>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {equipe.map((u) => (
            <div key={u.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-800">{u.nome} {u.id === usuario?.id && <span className="text-xs text-slate-400">(você)</span>}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge type="role" value={u.role} />
                {!u.ativo && <span className="text-xs text-red-500">Inativo</span>}
                {isAdmin && u.id !== usuario?.id && (
                  <Button
                    variant={u.ativo ? 'danger' : 'success'}
                    size="sm"
                    onClick={() => handleToggleAtivo(u.id, u.ativo)}
                  >
                    {u.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                )}
              </div>
            </div>
          ))}
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
                <Badge type="role" value={c.role} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convite Modal */}
      <Modal open={showConvite} onClose={() => setShowConvite(false)} title="Convidar Membro da Equipe">
        <form onSubmit={handleConvite} className="space-y-4">
          <Input
            label="E-mail *"
            type="email"
            value={conviteEmail}
            onChange={(e) => setConviteEmail(e.target.value)}
            placeholder="colaborador@empresa.com"
            required
          />
          <Select
            label="Perfil *"
            value={conviteRole}
            onChange={(e) => setConviteRole(e.target.value as UserRole)}
            options={[
              { value: 'vendedor', label: 'Vendedor' },
              { value: 'aprovador', label: 'Aprovador' },
              { value: 'admin', label: 'Administrador' },
            ]}
          />
          <p className="text-xs text-slate-400">
            Um convite será gerado. Compartilhe o link de cadastro com o colaborador.
          </p>
          <div className="flex gap-3">
            <Button type="submit" className="flex-1">Gerar Convite</Button>
            <Button type="button" variant="secondary" onClick={() => setShowConvite(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
