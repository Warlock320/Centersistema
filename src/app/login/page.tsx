'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Package } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Conta criada! Verifique seu e-mail para confirmar e depois configure sua empresa.');
        setMode('login');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar';
      if (msg.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos');
      } else if (msg.includes('User already registered')) {
        setError('Este e-mail já está cadastrado');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Package size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Center Auto Peças</h1>
            <p className="text-slate-400 text-sm">Sistema de Gestão ERP</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {mode === 'login'
              ? 'Acesse o painel de gestão'
              : 'Crie sua conta e configure sua empresa'}
          </p>

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <Button type="submit" loading={loading} className="w-full">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Center Auto Peças Gestão &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
