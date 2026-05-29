// =====================================================================
// SISTEMA DE PERMISSÕES — papéis fixos com matriz pré-definida
// Um usuário pode ter MÚLTIPLOS papéis (roles: UserRole[]).
// =====================================================================

export type UserRole = 'admin' | 'gestor' | 'financeiro' | 'vendedor';

export const ALL_ROLES: UserRole[] = ['admin', 'gestor', 'financeiro', 'vendedor'];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  financeiro: 'Financeiro',
  vendedor: 'Vendedor',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acesso total ao sistema, equipe e configurações',
  gestor: 'Gestão comercial, aprova orçamentos e vê relatórios',
  financeiro: 'Módulo financeiro completo, aprova contas a pagar',
  vendedor: 'Cadastra clientes, cria orçamentos e pedidos',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  gestor: 'bg-blue-100 text-blue-700',
  financeiro: 'bg-emerald-100 text-emerald-700',
  vendedor: 'bg-amber-100 text-amber-700',
};

export type Permission =
  | 'view_dashboard'
  | 'view_clientes' | 'edit_clientes'
  | 'view_produtos' | 'edit_produtos'
  | 'view_fornecedores' | 'edit_fornecedores'
  | 'view_orcamentos' | 'edit_orcamentos' | 'approve_orcamentos'
  | 'view_pedidos' | 'edit_pedidos'
  | 'view_nfe'
  | 'view_financeiro' | 'edit_financeiro' | 'approve_contas_pagar'
  | 'view_relatorios'
  | 'manage_config';

const ALL_PERMISSIONS: Permission[] = [
  'view_dashboard',
  'view_clientes', 'edit_clientes',
  'view_produtos', 'edit_produtos',
  'view_fornecedores', 'edit_fornecedores',
  'view_orcamentos', 'edit_orcamentos', 'approve_orcamentos',
  'view_pedidos', 'edit_pedidos',
  'view_nfe',
  'view_financeiro', 'edit_financeiro', 'approve_contas_pagar',
  'view_relatorios',
  'manage_config',
];

// Matriz de permissões por papel (FIXA)
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ALL_PERMISSIONS,

  gestor: [
    'view_dashboard',
    'view_clientes', 'edit_clientes',
    'view_produtos', 'edit_produtos',
    'view_fornecedores', 'edit_fornecedores',
    'view_orcamentos', 'edit_orcamentos', 'approve_orcamentos',
    'view_pedidos', 'edit_pedidos',
    'view_nfe',
    'view_financeiro',            // só visualiza o financeiro
    'approve_contas_pagar',
    'view_relatorios',
  ],

  financeiro: [
    'view_dashboard',
    'view_clientes',
    'view_produtos',
    'view_fornecedores', 'edit_fornecedores',
    'view_orcamentos',
    'view_pedidos',
    'view_nfe',
    'view_financeiro', 'edit_financeiro', 'approve_contas_pagar',
    'view_relatorios',
  ],

  vendedor: [
    'view_dashboard',
    'view_clientes', 'edit_clientes',
    'view_produtos',
    'view_fornecedores',
    'view_orcamentos', 'edit_orcamentos',
    'view_pedidos', 'edit_pedidos',
    'view_nfe',
  ],
};

/** Mapa de permissões usado pelos helpers standalone. Pode ser customizado por empresa. */
export type RolePermissionMap = Record<UserRole, Permission[]>;

/** Verdadeiro se ALGUM dos papéis concede a permissão (usa o mapa default). */
export function can(roles: UserRole[] | null | undefined, perm: Permission): boolean {
  return canWith(DEFAULT_ROLE_PERMISSIONS, roles, perm);
}

/** Igual a can(), mas com um mapa de permissões específico (ex: customizado por empresa). */
export function canWith(map: RolePermissionMap, roles: UserRole[] | null | undefined, perm: Permission): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => map[r]?.includes(perm));
}

/** Verdadeiro se concede QUALQUER uma das permissões. */
export function canAny(roles: UserRole[] | null | undefined, perms: Permission[]): boolean {
  return perms.some((p) => can(roles, p));
}

/** Conjunto unificado de permissões dos papéis. */
export function permissionsOf(roles: UserRole[] | null | undefined): Set<Permission> {
  const set = new Set<Permission>();
  (roles || []).forEach((r) => DEFAULT_ROLE_PERMISSIONS[r]?.forEach((p) => set.add(p)));
  return set;
}

/** Normaliza dados legados: aceita roles[] ou role único (migra aprovador→gestor). */
export function resolveRoles(input: { roles?: string[] | null; role?: string | null }): UserRole[] {
  if (input.roles && input.roles.length > 0) {
    return input.roles.filter((r): r is UserRole => ALL_ROLES.includes(r as UserRole));
  }
  if (input.role) {
    const legacy = input.role === 'aprovador' ? 'gestor' : input.role;
    if (ALL_ROLES.includes(legacy as UserRole)) return [legacy as UserRole];
  }
  return ['vendedor'];
}

// Metadata dos módulos/permissões para a UI de configuração (cards expansíveis)
export const PERMISSION_GROUPS: { modulo: string; permissions: { key: Permission; label: string }[] }[] = [
  { modulo: 'Dashboard', permissions: [{ key: 'view_dashboard', label: 'Acessar o dashboard' }] },
  { modulo: 'Clientes', permissions: [{ key: 'view_clientes', label: 'Visualizar' }, { key: 'edit_clientes', label: 'Criar / Editar' }] },
  { modulo: 'Produtos', permissions: [{ key: 'view_produtos', label: 'Visualizar' }, { key: 'edit_produtos', label: 'Criar / Editar' }] },
  { modulo: 'Fornecedores', permissions: [{ key: 'view_fornecedores', label: 'Visualizar' }, { key: 'edit_fornecedores', label: 'Criar / Editar' }] },
  { modulo: 'Orçamentos', permissions: [{ key: 'view_orcamentos', label: 'Visualizar' }, { key: 'edit_orcamentos', label: 'Criar / Editar' }, { key: 'approve_orcamentos', label: 'Aprovar orçamentos' }] },
  { modulo: 'Pedidos', permissions: [{ key: 'view_pedidos', label: 'Visualizar' }, { key: 'edit_pedidos', label: 'Criar / Editar' }] },
  { modulo: 'Notas Fiscais', permissions: [{ key: 'view_nfe', label: 'Importar NF-e' }] },
  { modulo: 'Financeiro', permissions: [{ key: 'view_financeiro', label: 'Visualizar' }, { key: 'edit_financeiro', label: 'Pagar / Gerenciar bancos' }, { key: 'approve_contas_pagar', label: 'Aprovar contas a pagar' }] },
  { modulo: 'Relatórios', permissions: [{ key: 'view_relatorios', label: 'Visualizar relatórios' }] },
  { modulo: 'Configurações', permissions: [{ key: 'manage_config', label: 'Gerenciar empresa e equipe' }] },
];

/** Constrói um mapa a partir de linhas {papel, permissao} (vindas do banco). Default para papéis sem linhas. */
export function buildPermissionMap(rows: { papel: string; permissao: string }[]): RolePermissionMap {
  const map: RolePermissionMap = { admin: [], gestor: [], financeiro: [], vendedor: [] };
  const seen = new Set<UserRole>();
  rows.forEach(({ papel, permissao }) => {
    if (ALL_ROLES.includes(papel as UserRole)) {
      seen.add(papel as UserRole);
      map[papel as UserRole].push(permissao as Permission);
    }
  });
  // Papéis sem nenhuma linha caem no default
  ALL_ROLES.forEach((r) => { if (!seen.has(r)) map[r] = [...DEFAULT_ROLE_PERMISSIONS[r]]; });
  // Admin sempre tem tudo (proteção)
  map.admin = [...DEFAULT_ROLE_PERMISSIONS.admin];
  return map;
}
