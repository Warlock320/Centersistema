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
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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

/** Verdadeiro se ALGUM dos papéis concede a permissão. */
export function can(roles: UserRole[] | null | undefined, perm: Permission): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(perm));
}

/** Verdadeiro se concede QUALQUER uma das permissões. */
export function canAny(roles: UserRole[] | null | undefined, perms: Permission[]): boolean {
  return perms.some((p) => can(roles, p));
}

/** Conjunto unificado de permissões dos papéis. */
export function permissionsOf(roles: UserRole[] | null | undefined): Set<Permission> {
  const set = new Set<Permission>();
  (roles || []).forEach((r) => ROLE_PERMISSIONS[r]?.forEach((p) => set.add(p)));
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
