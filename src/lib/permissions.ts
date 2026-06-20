// =====================================================================
// SISTEMA DE PERMISSÕES — papéis fixos com matriz pré-definida
// Um usuário pode ter MÚLTIPLOS papéis (roles: UserRole[]).
// =====================================================================

export type UserRole = 'admin' | 'gestor' | 'financeiro' | 'vendedor' | 'caixa' | 'balconista';

export const ALL_ROLES: UserRole[] = ['admin', 'gestor', 'financeiro', 'vendedor', 'caixa', 'balconista'];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  financeiro: 'Financeiro',
  vendedor: 'Vendedor',
  caixa: 'Operador de Caixa',
  balconista: 'Balconista',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Acesso total ao sistema, equipe e configurações',
  gestor: 'Gestão comercial, aprova orçamentos e vê relatórios',
  financeiro: 'Módulo financeiro completo, aprova contas a pagar',
  vendedor: 'Cadastra clientes, cria orçamentos, pedidos e OS',
  caixa: 'Balcão: opera o caixa, registra vendas e atende clientes',
  balconista: 'Vende só no balcão (monta a pré-venda); não recebe valores',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  gestor: 'bg-blue-100 text-blue-700',
  financeiro: 'bg-emerald-100 text-emerald-700',
  vendedor: 'bg-amber-100 text-amber-700',
  caixa: 'bg-pink-100 text-pink-700',
  balconista: 'bg-cyan-100 text-cyan-700',
};

export type Permission =
  | 'view_dashboard'
  | 'view_clientes' | 'edit_clientes'
  | 'view_produtos' | 'edit_produtos'
  | 'view_estoque' | 'edit_estoque'
  | 'view_veiculos' | 'edit_veiculos'
  | 'view_fornecedores' | 'edit_fornecedores'
  | 'view_orcamentos' | 'edit_orcamentos' | 'approve_orcamentos'
  | 'view_pedidos' | 'edit_pedidos'
  | 'view_os' | 'edit_os'
  | 'view_nfe'
  | 'registrar_venda' | 'operar_balcao'
  | 'view_financeiro' | 'edit_financeiro' | 'approve_contas_pagar' | 'operar_caixa' | 'gerir_caixa'
  | 'gerir_crediario' | 'aprovar_credito'
  | 'view_relatorios'
  | 'view_auditoria'
  | 'manage_config';

const ALL_PERMISSIONS: Permission[] = [
  'view_dashboard',
  'view_clientes', 'edit_clientes',
  'view_produtos', 'edit_produtos',
  'view_estoque', 'edit_estoque',
  'view_veiculos', 'edit_veiculos',
  'view_fornecedores', 'edit_fornecedores',
  'view_orcamentos', 'edit_orcamentos', 'approve_orcamentos',
  'view_pedidos', 'edit_pedidos',
  'view_os', 'edit_os',
  'view_nfe',
  'registrar_venda', 'operar_balcao',
  'view_financeiro', 'edit_financeiro', 'approve_contas_pagar', 'operar_caixa', 'gerir_caixa',
  'gerir_crediario', 'aprovar_credito',
  'view_relatorios',
  'view_auditoria',
  'manage_config',
];

// Matriz de permissões por papel (FIXA — ponto de partida; editável por empresa)
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ALL_PERMISSIONS,

  gestor: [
    'view_dashboard',
    'view_clientes', 'edit_clientes',
    'view_produtos', 'edit_produtos',
    'view_estoque', 'edit_estoque',
    'view_veiculos', 'edit_veiculos',
    'view_fornecedores', 'edit_fornecedores',
    'view_orcamentos', 'edit_orcamentos', 'approve_orcamentos',
    'view_pedidos', 'edit_pedidos',
    'view_os', 'edit_os',
    'view_nfe',
    'registrar_venda', 'operar_balcao',
    'view_financeiro',            // só visualiza o financeiro
    'approve_contas_pagar', 'operar_caixa',
    'gerir_crediario', 'aprovar_credito',
    'view_relatorios',
  ],

  financeiro: [
    'view_dashboard',
    'view_clientes',
    'view_produtos', 'view_estoque',
    'view_veiculos',
    'view_fornecedores', 'edit_fornecedores',
    'view_orcamentos',
    'view_pedidos',
    'view_os',
    'view_nfe',
    'registrar_venda', 'operar_balcao',
    'view_financeiro', 'edit_financeiro', 'approve_contas_pagar', 'operar_caixa', 'gerir_caixa',
    'gerir_crediario', 'aprovar_credito',
    'view_relatorios',
  ],

  vendedor: [
    'view_dashboard',
    'view_clientes', 'edit_clientes',
    'view_produtos', 'view_estoque',
    'view_veiculos', 'edit_veiculos',
    'view_fornecedores',
    'view_orcamentos', 'edit_orcamentos',
    'view_pedidos', 'edit_pedidos',
    'view_os', 'edit_os',
    'registrar_venda', 'operar_balcao',
    'operar_caixa',
  ],

  // Operador de caixa: foco no balcão
  caixa: [
    'view_dashboard',
    'view_clientes', 'edit_clientes',
    'view_produtos', 'view_estoque',
    'view_veiculos',
    'registrar_venda', 'operar_balcao',
    'operar_caixa',
  ],

  // Balconista: vende só no balcão (monta a pré-venda). Não recebe, não vê o resto.
  balconista: [
    'operar_balcao',
    'view_clientes', 'edit_clientes',
    'view_produtos', 'view_estoque',
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
  { modulo: 'Veículos', permissions: [{ key: 'view_veiculos', label: 'Visualizar' }, { key: 'edit_veiculos', label: 'Criar / Editar' }] },
  { modulo: 'Produtos', permissions: [{ key: 'view_produtos', label: 'Visualizar' }, { key: 'edit_produtos', label: 'Criar / Editar' }] },
  { modulo: 'Estoque', permissions: [{ key: 'view_estoque', label: 'Visualizar movimentações' }, { key: 'edit_estoque', label: 'Movimentar (entrada/saída/ajuste)' }] },
  { modulo: 'Fornecedores', permissions: [{ key: 'view_fornecedores', label: 'Visualizar' }, { key: 'edit_fornecedores', label: 'Criar / Editar' }] },
  { modulo: 'Orçamentos', permissions: [{ key: 'view_orcamentos', label: 'Visualizar' }, { key: 'edit_orcamentos', label: 'Criar / Editar' }, { key: 'approve_orcamentos', label: 'Aprovar orçamentos' }] },
  { modulo: 'Pedidos', permissions: [{ key: 'view_pedidos', label: 'Visualizar' }, { key: 'edit_pedidos', label: 'Criar / Editar' }] },
  { modulo: 'Ordem de Serviço', permissions: [{ key: 'view_os', label: 'Visualizar' }, { key: 'edit_os', label: 'Criar / Editar / Faturar' }] },
  { modulo: 'Notas Fiscais', permissions: [{ key: 'view_nfe', label: 'Importar NF-e' }] },
  { modulo: 'Vendas / Caixa', permissions: [{ key: 'registrar_venda', label: 'Registrar venda (Contas a Receber)' }, { key: 'operar_balcao', label: 'Balcão: abrir/editar comandas (pré-venda)' }, { key: 'operar_caixa', label: 'Abrir e operar o caixa' }, { key: 'gerir_caixa', label: 'Conferir / encerrar / reabrir caixa' }] },
  { modulo: 'Financeiro', permissions: [{ key: 'view_financeiro', label: 'Visualizar financeiro' }, { key: 'edit_financeiro', label: 'Pagar / Gerenciar bancos' }, { key: 'approve_contas_pagar', label: 'Aprovar contas a pagar' }] },
  { modulo: 'Crediário', permissions: [{ key: 'gerir_crediario', label: 'Definir limite e status do cliente' }, { key: 'aprovar_credito', label: 'Liberar venda acima do limite / inadimplente' }] },
  { modulo: 'Relatórios', permissions: [{ key: 'view_relatorios', label: 'Visualizar relatórios' }] },
  { modulo: 'Auditoria', permissions: [{ key: 'view_auditoria', label: 'Consultar logs do sistema (somente admin)' }] },
  { modulo: 'Configurações', permissions: [{ key: 'manage_config', label: 'Gerenciar empresa e equipe' }] },
];

// Ordem de prioridade das telas para definir a "página inicial" de quem não vê o dashboard.
// Espelha grosso modo a ordem do menu — o caixa-only cai direto no Caixa Diário.
export const HOME_ROUTE_PRIORITY: { href: string; permission: Permission }[] = [
  { href: '/dashboard', permission: 'view_dashboard' },
  { href: '/dashboard/balcao', permission: 'operar_balcao' },
  { href: '/dashboard/financeiro/caixa', permission: 'operar_caixa' },
  { href: '/dashboard/financeiro/receber', permission: 'registrar_venda' },
  { href: '/dashboard/orcamentos', permission: 'view_orcamentos' },
  { href: '/dashboard/os', permission: 'view_os' },
  { href: '/dashboard/pedidos', permission: 'view_pedidos' },
  { href: '/dashboard/clientes', permission: 'view_clientes' },
  { href: '/dashboard/produtos', permission: 'view_produtos' },
  { href: '/dashboard/estoque', permission: 'view_estoque' },
  { href: '/dashboard/veiculos', permission: 'view_veiculos' },
  { href: '/dashboard/financeiro', permission: 'view_financeiro' },
  { href: '/dashboard/relatorios', permission: 'view_relatorios' },
  { href: '/dashboard/configuracoes', permission: 'manage_config' },
];

/** Primeira rota acessível conforme as permissões do usuário (tela inicial). */
export function resolveHomeRoute(map: RolePermissionMap, roles: UserRole[] | null | undefined): string {
  const hit = HOME_ROUTE_PRIORITY.find((r) => canWith(map, roles, r.permission));
  return hit?.href ?? '/dashboard';
}

// Mapa rota → permissão exigida (mais específicas primeiro).
// Usado pelo guard de rota: sem a permissão, o acesso direto por URL é bloqueado.
export const ROUTE_PERMISSIONS: { prefix: string; perm: Permission | Permission[] }[] = [
  { prefix: '/dashboard/financeiro/caixa/relatorios', perm: ['view_financeiro', 'gerir_caixa'] },
  { prefix: '/dashboard/financeiro/caixa', perm: 'operar_caixa' },
  { prefix: '/dashboard/financeiro/receber', perm: ['view_financeiro', 'registrar_venda'] },
  { prefix: '/dashboard/financeiro/conciliacao', perm: 'edit_financeiro' },
  { prefix: '/dashboard/financeiro/bancos', perm: 'edit_financeiro' },
  { prefix: '/dashboard/financeiro/categorias', perm: 'edit_financeiro' },
  { prefix: '/dashboard/financeiro/pagar', perm: 'view_financeiro' },
  { prefix: '/dashboard/financeiro', perm: 'view_financeiro' },
  { prefix: '/dashboard/crediario', perm: ['view_financeiro', 'gerir_crediario'] },
  { prefix: '/dashboard/balcao', perm: 'operar_balcao' },
  { prefix: '/dashboard/clientes', perm: 'view_clientes' },
  { prefix: '/dashboard/produtos', perm: 'view_produtos' },
  { prefix: '/dashboard/estoque', perm: 'view_estoque' },
  { prefix: '/dashboard/fornecedores', perm: 'view_fornecedores' },
  { prefix: '/dashboard/veiculos', perm: 'view_veiculos' },
  { prefix: '/dashboard/empresas', perm: 'manage_config' },
  { prefix: '/dashboard/orcamentos', perm: 'view_orcamentos' },
  { prefix: '/dashboard/aprovacoes', perm: 'approve_orcamentos' },
  { prefix: '/dashboard/pedidos', perm: 'view_pedidos' },
  { prefix: '/dashboard/os', perm: 'view_os' },
  { prefix: '/dashboard/nfe', perm: 'view_nfe' },
  { prefix: '/dashboard/comissoes', perm: 'view_financeiro' },
  { prefix: '/dashboard/garantias', perm: 'view_pedidos' },
  { prefix: '/dashboard/devolucoes', perm: 'view_pedidos' },
  { prefix: '/dashboard/relatorios', perm: 'view_relatorios' },
  { prefix: '/dashboard/auditoria', perm: 'view_auditoria' },
  { prefix: '/dashboard/configuracoes', perm: 'manage_config' },
];

/** Constrói um mapa a partir de linhas {papel, permissao} (vindas do banco). Default para papéis sem linhas. */
export function buildPermissionMap(rows: { papel: string; permissao: string }[]): RolePermissionMap {
  const map: RolePermissionMap = { admin: [], gestor: [], financeiro: [], vendedor: [], caixa: [], balconista: [] };
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
