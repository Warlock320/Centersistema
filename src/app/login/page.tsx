'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { Eye, EyeOff } from 'lucide-react';
import { DEMO_MODE, DEMO_COOKIE } from '@/lib/demo';
import { loginToEmail } from '@/lib/login';

const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = 'admin123';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
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

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(email), password });
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar';
      setError(msg.includes('Invalid login credentials') ? 'E-mail ou senha incorretos' : msg);
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
            <h2 className="text-2xl font-bold text-slate-900">Entrar</h2>
            {DEMO_MODE && (
              <span className="text-xs font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                MODO DEMO
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mb-6">Acesse o painel de gestão</p>

          {DEMO_MODE && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Credenciais de teste:</strong><br />
              E-mail: <code className="font-mono">admin@demo.com</code><br />
              Senha: <code className="font-mono">admin123</code>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuário ou e-mail"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex: jean (ou seu@email.com)"
              required
              autoComplete="username"
            />
            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <Button type="submit" loading={loading} className="w-full">Entrar</Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Novos acessos são criados pelo administrador nas configurações do sistema.
          </p>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Center Auto Peças Gestão &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
