export type OrcamentoStatus =
  | 'criado'
  | 'orcamento_enviado'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'aguardando_pecas'
  | 'enviado'
  | 'cancelado';

export type PedidoStatus = 'aberto' | 'em_andamento' | 'faturado' | 'cancelado';
export type UserRole = 'admin' | 'vendedor' | 'aprovador';

export interface Empresa {
  id: string;
  nome: string;
  razao_social: string;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  created_at: string;
}

export interface Usuario {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  created_at: string;
}

export interface Categoria {
  id: string;
  empresa_id: string;
  nome: string;
  created_at: string;
}

export interface Produto {
  id: string;
  empresa_id: string;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  preco: number;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MovimentacaoEstoque {
  id: string;
  empresa_id: string;
  produto_id: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  custo_unitario: number;
  referencia_tipo: string;
  referencia_id: string | null;
  observacao: string | null;
  created_at: string;
}

export interface Cliente {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: 'fisica' | 'juridica';
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto: number;
  total: number;
  ordem: number;
}

export interface Orcamento {
  id: string;
  empresa_id: string;
  cliente_id: string;
  usuario_id: string;
  numero: number;
  status: OrcamentoStatus;
  validade: string | null;
  observacoes: string | null;
  total: number;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
  usuarios?: Usuario;
  orcamento_itens?: OrcamentoItem[];
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
}

export interface Pedido {
  id: string;
  empresa_id: string;
  cliente_id: string;
  orcamento_id: string | null;
  numero: number;
  status: PedidoStatus;
  observacoes: string | null;
  total: number;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
  pedido_itens?: PedidoItem[];
}

export interface Convite {
  id: string;
  empresa_id: string;
  email: string;
  role: UserRole;
  token: string;
  usado: boolean;
  created_at: string;
}

export interface NfeImportada {
  id: string;
  empresa_id: string;
  chave_acesso: string;
  numero_nota: number;
  emitente_nome: string;
  valor_total: number;
  xml_conteudo: string;
  created_at: string;
}

export interface DashboardKpis {
  faturamento_mes: number;
  pedidos_abertos: number;
  clientes_ativos: number;
  alertas_estoque: number;
}
