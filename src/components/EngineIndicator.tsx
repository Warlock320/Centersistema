'use client';

import { useEffect, useState } from 'react';
import { detectEngine, getEngineStatus, requestSync, clearEngineCache, type EngineStatus } from '@/lib/engine';
import { HardDrive, RefreshCw, Trash2, X } from 'lucide-react';

export default function EngineIndicator() {
  const [status, setStatus] = useState<EngineStatus>(getEngineStatus());
  const [showPanel, setShowPanel] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    detectEngine().then(setStatus);
    const interval = setInterval(() => detectEngine().then(setStatus), 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleSync() {
    setSyncing(true);
    await requestSync();
    await detectEngine().then(setStatus);
    setSyncing(false);
  }

  async function handleClear() {
    if (!confirm('Limpar o cache local? Os dados serão baixados novamente na próxima sincronização.')) return;
    await clearEngineCache();
    await detectEngine().then(setStatus);
  }

  if (!status.online) return null;

  return (
    <div className="relative">
      <button onClick={() => setShowPanel((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
        title="Engine local conectado">
        <HardDrive size={13} />
        <span className="hidden sm:inline">Engine</span>
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      </button>

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <HardDrive size={15} className="text-green-600" /> CenterEngine
            </h3>
            <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="text-green-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" /> Online
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Porta</span>
              <span className="text-slate-700 font-mono">{status.port}</span>
            </div>
            {status.version && (
              <div className="flex justify-between">
                <span className="text-slate-500">Versão</span>
                <span className="text-slate-700">{status.version}</span>
              </div>
            )}
            {status.lastSync && (
              <div className="flex justify-between">
                <span className="text-slate-500">Última sync</span>
                <span className="text-slate-700">{new Date(status.lastSync).toLocaleTimeString('pt-BR')}</span>
              </div>
            )}
            {status.cacheSize > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Cache</span>
                <span className="text-slate-700">{(status.cacheSize / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
            <button onClick={handleSync} disabled={syncing}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <button onClick={handleClear}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors">
              <Trash2 size={13} /> Limpar cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
