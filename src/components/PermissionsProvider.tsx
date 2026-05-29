'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_ROLE_PERMISSIONS, buildPermissionMap, canWith,
  type RolePermissionMap, type Permission, type UserRole,
} from '@/lib/permissions';

interface PermissionsContextValue {
  roles: UserRole[];
  map: RolePermissionMap;
  can: (perm: Permission) => boolean;
  reload: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  roles: [],
  map: DEFAULT_ROLE_PERMISSIONS,
  can: () => false,
  reload: () => {},
});

export function PermissionsProvider({
  roles,
  empresaId,
  children,
}: {
  roles: UserRole[];
  empresaId: string | null;
  children: React.ReactNode;
}) {
  const [map, setMap] = useState<RolePermissionMap>(DEFAULT_ROLE_PERMISSIONS);

  const load = useCallback(async () => {
    if (!empresaId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('permissoes_papel')
      .select('papel, permissao')
      .eq('empresa_id', empresaId);
    if (data && data.length > 0) {
      setMap(buildPermissionMap(data as { papel: string; permissao: string }[]));
    } else {
      setMap(DEFAULT_ROLE_PERMISSIONS);
    }
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const can = useCallback(
    (perm: Permission) => canWith(map, roles, perm),
    [map, roles]
  );

  return (
    <PermissionsContext.Provider value={{ roles, map, can, reload: load }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
