'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_MODULOS, MODULO_ROTAS, type ModulosEmpresa } from '@/lib/modules';

interface ModulesContextValue {
  modulos: ModulosEmpresa;
  isModuleActive: (modulo: keyof ModulosEmpresa) => boolean;
  isRouteAllowed: (href: string) => boolean;
  reload: () => void;
}

const ModulesContext = createContext<ModulesContextValue>({
  modulos: DEFAULT_MODULOS,
  isModuleActive: () => true,
  isRouteAllowed: () => true,
  reload: () => {},
});

export function ModulesProvider({ empresaId, children }: { empresaId: string | null; children: React.ReactNode }) {
  const [modulos, setModulos] = useState<ModulosEmpresa>(DEFAULT_MODULOS);

  const load = useCallback(async () => {
    if (!empresaId) return;
    const supabase = createClient();
    const { data } = await supabase.from('modulos_empresa').select('*').eq('empresa_id', empresaId).maybeSingle();
    if (data) {
      const m: ModulosEmpresa = { ...DEFAULT_MODULOS };
      for (const key of Object.keys(DEFAULT_MODULOS) as (keyof ModulosEmpresa)[]) {
        if (key in data) m[key] = Boolean((data as Record<string, unknown>)[key]);
      }
      setModulos(m);
    }
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const isModuleActive = useCallback((modulo: keyof ModulosEmpresa) => modulos[modulo], [modulos]);

  const isRouteAllowed = useCallback((href: string) => {
    for (const [modulo, rotas] of Object.entries(MODULO_ROTAS)) {
      if (rotas?.some((r) => href === r || href.startsWith(r + '/'))) {
        return modulos[modulo as keyof ModulosEmpresa];
      }
    }
    return true;
  }, [modulos]);

  return (
    <ModulesContext.Provider value={{ modulos, isModuleActive, isRouteAllowed, reload: load }}>
      {children}
    </ModulesContext.Provider>
  );
}

export const useModules = () => useContext(ModulesContext);
