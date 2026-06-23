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
  const [loadingScreen, setLoadingScreen] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

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
      // Pré-validação: verifica bloqueio, horário e conta ativa
      const preCheck = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: email, password: '***' }),
      });
      const preResult = await preCheck.json();
      if (!preCheck.ok || !preResult.canLogin) {
        setError(preResult.error || 'Não foi possível fazer login.');
        setLoading(false);
        return;
      }

      // Login real
      setLoadingMsg('Verificando credenciais...');
      const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(email), password });
      if (error) {
        await fetch('/api/auth/login-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: email, success: false }),
        }).catch(() => {});
        throw error;
      }

      // Login OK — mostrar tela de carregamento
      setLoadingScreen(true);
      setLoadingMsg('Registrando acesso...');
      await fetch('/api/auth/login-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: email, success: true }),
      }).catch(() => {});

      setLoadingMsg('Carregando o sistema...');
      await new Promise((r) => setTimeout(r, 500));
      setLoadingMsg('Preparando seu ambiente...');
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar';
      setError(msg.includes('Invalid login credentials') ? 'E-mail ou senha incorretos' : msg);
      setLoadingScreen(false);
    } finally {
      if (!loadingScreen) setLoading(false);
    }
  };

  if (loadingScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center">
          <Logo size={120} className="shadow-xl ring-4 ring-white/10 mb-6 animate-pulse" />
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-5 h-5 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-blue-300 text-sm font-medium">{loadingMsg}</p>
          </div>
          <div className="w-48 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-[loading_2s_ease-in-out_infinite]"
              style={{ width: '60%', animation: 'loading 1.5s ease-in-out infinite' }} />
          </div>
          <style>{`@keyframes loading { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }`}</style>
        </div>
      </div>
    );
  }

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
