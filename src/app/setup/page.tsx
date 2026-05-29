'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Package } from 'lucide-react';
import { DEMO_MODE } from '@/lib/demo';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  const [form, setForm] = useState({
    empresaNome: '',
    empresaRazao: '',
    empresaCnpj: '',
    empresaEmail: '',
    empresaTelefone: '',
    empresaCidade: '',
    empresaEstado: '',
  });

  useEffect(() => {
    if (DEMO_MODE) { router.replace('/dashboard'); return; }

    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email || '');
      setUserName(user.email?.split('@')[0] || '');

      const { data } = await supabase.from('usuarios').select('id').eq('id', user.id).single();
      if (data) router.push('/dashboard');
    };
    getUser();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('setup_initial_account', {
        p_empresa_nome: form.empresaNome,
        p_empresa_razao: form.empresaRazao || form.empresaNome,
        p_empresa_cnpj: form.empresaCnpj.replace(/\D/g, ''),
        p_empresa_email: form.empresaEmail || userEmail,
        p_empresa_telefone: form.empresaTelefone,
        p_empresa_cidade: form.empresaCidade,
        p_empresa_estado: form.empresaEstado,
        p_usuario_nome: userName,
        p_usuario_email: userEmail,
      });

      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao configurar empresa');
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  if (DEMO_MODE) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Package size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Center Auto Peças</h1>
            <p className="text-slate-400 text-sm">Configuração inicial da empresa</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Configure sua empresa</h2>
          <p className="text-slate-500 text-sm mb-6">
            Preencha os dados para criar seu espaço de gestão. Você poderá editar depois.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nome Fantasia *" value={form.empresaNome} onChange={set('empresaNome')} placeholder="Center Auto Peças" required />
              <Input label="Razão Social *" value={form.empresaRazao} onChange={set('empresaRazao')} placeholder="Center Auto Peças LTDA" required />
              <Input label="CNPJ *" value={form.empresaCnpj} onChange={set('empresaCnpj')} placeholder="00.000.000/0001-00" required maxLength={18} />
              <Input label="E-mail da Empresa" type="email" value={form.empresaEmail} onChange={set('empresaEmail')} placeholder={userEmail} />
              <Input label="Telefone" value={form.empresaTelefone} onChange={set('empresaTelefone')} placeholder="(11) 99999-9999" />
              <Input label="Cidade" value={form.empresaCidade} onChange={set('empresaCidade')} placeholder="São Paulo" />
              <Input label="Estado (UF)" value={form.empresaEstado} onChange={set('empresaEstado')} placeholder="SP" maxLength={2} />
              <Input label="Seu nome *" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do administrador" required />
            </div>
            <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
              Criar minha empresa e entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
