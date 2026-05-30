'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastMsg { id: number; type: ToastType; message: string }

interface ToastApi {
  show: (message: string, type?: ToastType) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const ToastContext = createContext<ToastApi>({
  show: () => {}, success: () => {}, error: () => {}, info: () => {},
});

const STYLES: Record<ToastType, { bg: string; icon: React.ElementType; text: string }> = {
  success: { bg: 'bg-green-600', icon: CheckCircle, text: 'text-white' },
  error: { bg: 'bg-red-600', icon: XCircle, text: 'text-white' },
  info: { bg: 'bg-slate-800', icon: Info, text: 'text-white' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => remove(id), type === 'error' ? 6000 : 3500);
  }, [remove]);

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => {
          const s = STYLES[t.type];
          const Icon = s.icon;
          return (
            <div key={t.id}
              className={`${s.bg} ${s.text} rounded-lg shadow-lg px-4 py-3 flex items-start gap-2.5 animate-[slideIn_0.2s_ease-out]`}>
              <Icon size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm flex-1">{t.message}</p>
              <button onClick={() => remove(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
