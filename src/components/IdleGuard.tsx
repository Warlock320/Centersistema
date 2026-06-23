'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface IdleGuardProps {
  timeoutSeconds: number;
  warningSeconds?: number;
}

export default function IdleGuard({ timeoutSeconds, warningSeconds = 30 }: IdleGuardProps) {
  const router = useRouter();
  const supabase = createClient();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const lastActivity = useRef(Date.now());
  const warningTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  if (timeoutSeconds <= 0) return null;

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
      setCountdown(0);
      if (warningTimer.current) clearInterval(warningTimer.current);
    }
  }, [showWarning]);

  const doLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login?reason=idle');
    router.refresh();
  }, [supabase, router]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, resetActivity));
  }, [resetActivity]);

  useEffect(() => {
    const check = setInterval(() => {
      const idle = (Date.now() - lastActivity.current) / 1000;
      const warningAt = timeoutSeconds - warningSeconds;

      if (idle >= timeoutSeconds) {
        doLogout();
      } else if (idle >= warningAt && !showWarning) {
        setShowWarning(true);
        setCountdown(Math.ceil(timeoutSeconds - idle));
        warningTimer.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) { doLogout(); return 0; }
            return prev - 1;
          });
        }, 1000);
      }
    }, 1000);

    return () => {
      clearInterval(check);
      if (warningTimer.current) clearInterval(warningTimer.current);
    };
  }, [timeoutSeconds, warningSeconds, showWarning, doLogout]);

  if (!showWarning) return null;

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
        <div className="text-4xl font-bold text-red-600 mb-4">{countdown}s</div>
        <button onClick={resetActivity}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Continuar usando
        </button>
      </div>
    </div>
  );
}
