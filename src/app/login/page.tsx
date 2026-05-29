'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { DEMO_MODE, DEMO_COOKIE } from '@/lib/demo';

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'admin123';

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

    // ── Demo mode bypass ──────────────────────────────────────────────
    if (DEMO_MODE) {
      if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=86400`;
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(`Modo Demo: use ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
        setLoading(false);
      }
      return;
    }
    // ─────────────────────────────────────────────────────────────────

    const supabase = createClient();
    const conviteToken = new URLSearchParams(window.location.search).get('convite');

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Aceita convite, se houver — define os papéis do novo membro
        if (conviteToken) {
          await supabase.rpc('aceitar_convite', { p_token: conviteToken });
        }
        router.push('/dashboard');
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Se já houver sessão (confirmação de e-mail desativada) e convite, aceita já
        if (data.session && conviteToken) {
          await supabase.rpc('aceitar_convite', { p_token: conviteToken });
          router.push('/dashboard');
          router.refresh();
          return;
        }
        setMessage(conviteToken
          ? 'Conta criada! Confirme seu e-mail e faça login para entrar na equipe.'
          : 'Conta criada! Verifique seu e-mail para confirmar e depois configure sua empresa.');
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
        <div className="flex flex-col items-center justify-center mb-8">
          <Logo size={110} className="shadow-xl ring-4 ring-white/10 mb-3" />
          <p className="text-slate-400 text-sm">Sistema de Gestão ERP</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </h2>
            {DEMO_MODE && (
              <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                MODO DEMO
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mb-6">
            {mode === 'login'
              ? 'Acesse o painel de gestão'
              : 'Crie sua conta e configure sua empresa'}
          </p>

          {DEMO_MODE && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Credenciais de teste:</strong><br />
              E-mail: <code className="font-mono">admin@demo.com</code><br />
              Senha: <code className="font-mono">admin123</code>
            </div>
          )}

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
