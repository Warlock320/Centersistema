'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/components/PermissionsProvider';
import { ROUTE_PERMISSIONS, resolveHomeRoute } from '@/lib/permissions';

// Bloqueia o acesso direto (por URL) a telas sem a permissão necessária.
// Funciona junto com o menu (que esconde o link): aqui é a trava de verdade.
export function RouteGuard() {
  const { can, roles, map } = usePermissions();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || pathname === '/dashboard') return; // dashboard tem guard próprio (server)
    const match = ROUTE_PERMISSIONS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'));
    if (!match) return;
    const ok = Array.isArray(match.perm) ? match.perm.some((p) => can(p)) : can(match.perm);
    if (!ok) {
      router.replace(resolveHomeRoute(map, roles));
    }
  }, [pathname, map, roles]); // reavalia quando o mapa de permissões da empresa carrega
  return null;
}
