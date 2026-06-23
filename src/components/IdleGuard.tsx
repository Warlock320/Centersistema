'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function IdleGuard({ timeoutSeconds }: { timeoutSeconds: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [countdown, setCountdown] = useState(-1);
  const lastActivity = useRef(Date.now());
  const loggedOut = useRef(false);

  const warningSeconds = Math.min(10, Math.floor(timeoutSeconds / 3));
  const disabled = timeoutSeconds <= 0;

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setCountdown(-1);
  }, []);

  // Ouvir atividade
  useEffect(() => {
    if (disabled) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, resetActivity));
  }, [disabled, resetActivity]);

  // Timer único que checa a cada segundo
  useEffect(() => {
    if (disabled) return;

    const tick = setInterval(() => {
      if (loggedOut.current) return;
      const idle = Math.floor((Date.now() - lastActivity.current) / 1000);
      const remaining = timeoutSeconds - idle;

      if (remaining <= 0) {
        loggedOut.current = true;
        clearInterval(tick);
        supabase.auth.signOut().then(() => {
          router.push('/login?reason=idle');
          router.refresh();
        });
        return;
      }

      if (remaining <= warningSeconds) {
        setCountdown(remaining);
      } else {
        setCountdown(-1);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [disabled, timeoutSeconds, warningSeconds, supabase, router]);

  if (disabled || countdown < 0) return null;

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0');
  const ss = String(countdown % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Sessão expirando</h2>
        <p className="text-sm text-slate-500 mb-4">
          Você será deslogado por inatividade em
        </p>
        <div className="text-4xl font-bold text-red-600 mb-4 font-mono tracking-wider">
          00:{mm}:{ss}
        </div>
        <button onClick={resetActivity}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Continuar usando
        </button>
      </div>
    </div>
  );
}
