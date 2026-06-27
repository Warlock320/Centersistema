// Centro Engine — integração com o agente desktop local
// O engine é OPCIONAL. Sem ele, tudo funciona normalmente via Supabase.
// Com ele: leitura do cache local (5ms) + sync em background.

const ENGINE_PORTS = [9090, 9091, 9092, 9093];
const PING_TIMEOUT = 1500;
const CACHE_STATUS_KEY = 'center_engine_status';

export interface EngineStatus {
  online: boolean;
  port: number | null;
  version: string | null;
  lastSync: string | null;
  cacheSize: number;
  url: string | null;
}

const defaultStatus: EngineStatus = {
  online: false, port: null, version: null,
  lastSync: null, cacheSize: 0, url: null,
};

let _status: EngineStatus = { ...defaultStatus };
let _checked = false;

function engineUrl(): string | null {
  return _status.online && _status.port ? `http://127.0.0.1:${_status.port}` : null;
}

export async function detectEngine(): Promise<EngineStatus> {
  for (const port of ENGINE_PORTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT);
      const res = await fetch(`http://127.0.0.1:${port}/ping`, {
        signal: controller.signal,
        mode: 'cors',
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        _status = {
          online: true,
          port,
          version: data.version || null,
          lastSync: data.lastSync || null,
          cacheSize: data.cacheSize || 0,
          url: `http://127.0.0.1:${port}`,
        };
        _checked = true;
        try { sessionStorage.setItem(CACHE_STATUS_KEY, JSON.stringify(_status)); } catch {}
        return _status;
      }
    } catch {
      // Porta não responde — tenta a próxima
    }
  }

  _status = { ...defaultStatus };
  _checked = true;
  try { sessionStorage.setItem(CACHE_STATUS_KEY, JSON.stringify(_status)); } catch {}
  return _status;
}

export function getEngineStatus(): EngineStatus {
  if (!_checked) {
    try {
      const cached = sessionStorage.getItem(CACHE_STATUS_KEY);
      if (cached) _status = JSON.parse(cached);
    } catch {}
  }
  return _status;
}

export function isEngineOnline(): boolean {
  return _status.online;
}

// Busca dados do engine local (cache). Retorna null se engine offline.
export async function fetchFromEngine<T>(path: string): Promise<T | null> {
  const base = engineUrl();
  if (!base) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${base}${path}`, {
      signal: controller.signal,
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    // Engine caiu ou não respondeu — marca offline
    _status = { ...defaultStatus };
    return null;
  }
}

// Helper: tenta engine, se não tiver usa o fallback (Supabase)
export async function fetchWithEngine<T>(
  enginePath: string,
  fallback: () => Promise<T>
): Promise<{ data: T; source: 'engine' | 'supabase' }> {
  const engineData = await fetchFromEngine<T>(enginePath);
  if (engineData !== null) {
    return { data: engineData, source: 'engine' };
  }
  const data = await fallback();
  return { data, source: 'supabase' };
}

// Pede ao engine para sincronizar agora
export async function requestSync(): Promise<boolean> {
  const base = engineUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/sync`, { method: 'POST', mode: 'cors' });
    return res.ok;
  } catch {
    return false;
  }
}

// Pede ao engine para limpar o cache
export async function clearEngineCache(): Promise<boolean> {
  const base = engineUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/cache/clear`, { method: 'POST', mode: 'cors' });
    return res.ok;
  } catch {
    return false;
  }
}
