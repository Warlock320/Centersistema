'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_ROLE_PERMISSIONS, buildPermissionMap, canWith,
  type RolePermissionMap, type Permission, type PapelCustom,
} from '@/lib/permissions';

interface PermissionsContextValue {
  roles: string[];
  map: RolePermissionMap;
  can: (perm: Permission) => boolean;
  reload: () => void;
  customRoles: PapelCustom[];
}

const PermissionsContext = createContext<PermissionsContextValue>({
  roles: [],
  map: DEFAULT_ROLE_PERMISSIONS,
  can: () => false,
  reload: () => {},
  customRoles: [],
});

export function PermissionsProvider({
  roles,
  empresaId,
  children,
}: {
  roles: string[];
  empresaId: string | null;
  children: React.ReactNode;
}) {
  const [map, setMap] = useState<RolePermissionMap>(DEFAULT_ROLE_PERMISSIONS);
  const [customRoles, setCustomRoles] = useState<PapelCustom[]>([]);

  const load = useCallback(async () => {
    if (!empresaId) return;
    const supabase = createClient();

    const [permRes, customRes] = await Promise.all([
      supabase.from('permissoes_papel').select('papel, permissao').eq('empresa_id', empresaId),
      supabase.from('papeis_custom').select('id, nome, descricao, cor, permissoes, ativo').eq('empresa_id', empresaId).eq('ativo', true),
    ]);

    const customs = (customRes.data || []) as PapelCustom[];
    setCustomRoles(customs);

    if (permRes.data && permRes.data.length > 0) {
      setMap(buildPermissionMap(permRes.data as { papel: string; permissao: string }[], customs));
    } else {
      setMap(buildPermissionMap([], customs));
    }
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const can = useCallback(
    (perm: Permission) => canWith(map, roles, perm),
    [map, roles]
  );

  return (
    <PermissionsContext.Provider value={{ roles, map, can, reload: load, customRoles }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
