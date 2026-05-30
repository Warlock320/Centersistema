export type OrcamentoStatus =
  | 'criado'
  | 'orcamento_enviado'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'aguardando_pecas'
  | 'enviado'
  | 'cancelado';

export type PedidoStatus = 'aberto' | 'em_andamento' | 'faturado' | 'cancelado';

// Papéis do sistema — ver src/lib/permissions.ts para a matriz de permissões
export type { UserRole } from '@/lib/permissions';
import type { UserRole } from '@/lib/permissions';

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
  permite_estoque_negativo: boolean;
  created_at: string;
}

export interface Unidade {
  id: string;
  empresa_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
}

export type FormaPagamento =
  | 'pix' | 'dinheiro' | 'debito' | 'credito_vista'
  | 'credito_parcelado' | 'boleto' | 'transferencia' | 'outro';

export interface TabelaPreco {
  id: string;
  empresa_id: string;
  nome: string;
  ajuste_percentual: number;
  padrao: boolean;
  ativo: boolean;
  created_at: string;
}

export interface PrecoProduto {
  id: string;
  empresa_id: string;
  produto_id: string;
  tabela_preco_id: string;
  preco: number;
}

/** Linha da view v_precos_produto */
export interface PrecoProdutoView {
  produto_id: string;
  empresa_id: string;
  tabela_preco_id: string;
  tabela_nome: string;
  tabela_padrao: boolean;
  preco: number;
  preco_customizado: boolean;
}

export interface Usuario {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  roles: UserRole[];
  /** @deprecated mantido para compatibilidade com dados legados */
  role?: UserRole | null;
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
  ref: string | null;
  nome: string;
  categoria: string | null;
  fornecedor_id: string | null;
  localizacao: string | null;
  codigos_auxiliares: string[];
  preco: number;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  fornecedores?: { nome: string };
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
  razao_social: string | null;
  inscricao_estadual: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
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
  roles: UserRole[];
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

// ── Módulo Financeiro ──────────────────────────────────────────────────────────

export interface Fornecedor {
  id: string;
  empresa_id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  tipo: 'fisica' | 'juridica';
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: 'corrente' | 'poupanca' | 'pagamento' | null;
  pix_chave: string | null;
  pix_tipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  prazo_padrao: number;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

export interface PlanoContas {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  pai_id: string | null;
  ativo: boolean;
  created_at: string;
}

export interface CentroCusto {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export interface ContaBancaria {
  id: string;
  empresa_id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo: 'corrente' | 'poupanca' | 'caixa' | 'investimento' | 'outro';
  saldo_inicial: number;
  saldo_atual?: number;
  unidade_id: string | null;
  ativo: boolean;
  created_at: string;
}

export type ContaReceberStatus = 'pendente' | 'pago' | 'cancelado';
export type ContaPagarStatus = 'pendente' | 'aprovado' | 'pago' | 'cancelado';

export interface ContaReceber {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  pedido_id: string | null;
  unidade_id: string | null;
  plano_contas_id: string | null;
  centro_custo_id: string | null;
  conta_bancaria_id: string | null;
  forma_pagamento: FormaPagamento | null;
  descricao: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  juros: number;
  desconto: number;
  status: ContaReceberStatus;
  numero_parcela: number;
  total_parcelas: number;
  grupo_parcelas: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
}

export interface ContaPagar {
  id: string;
  empresa_id: string;
  fornecedor_id: string | null;
  nfe_id: string | null;
  unidade_id: string | null;
  plano_contas_id: string | null;
  centro_custo_id: string | null;
  conta_bancaria_id: string | null;
  aprovado_por: string | null;
  descricao: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  juros: number;
  desconto: number;
  status: ContaPagarStatus;
  comprovante_url: string | null;
  numero_parcela: number;
  total_parcelas: number;
  grupo_parcelas: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  fornecedores?: Fornecedor;
}

export interface HistoricoCobranca {
  id: string;
  empresa_id: string;
  conta_receber_id: string;
  usuario_id: string | null;
  tipo: 'preventiva' | 'vencimento' | 'leve' | 'medio' | 'grave' | 'renegociacao' | 'outro';
  canal: 'email' | 'whatsapp' | 'telefone' | 'carta' | 'sistema' | null;
  observacao: string | null;
  created_at: string;
}

export interface Caixa {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  usuario_id: string | null;
  saldo_inicial: number;
  status: 'aberto' | 'fechado';
  aberto_em: string;
  fechado_em: string | null;
  saldo_informado: number | null;
  saldo_calculado: number | null;
  observacao: string | null;
}

export interface MovimentoCaixa {
  id: string;
  empresa_id: string;
  caixa_id: string;
  tipo: 'entrada' | 'saida';
  forma_pagamento: string | null;
  valor: number;
  descricao: string | null;
  created_at: string;
}

export interface KpisFinanceiros {
  receber_mes: number;
  pagar_mes: number;
  recebido_mes: number;
  pago_mes: number;
  vencidos_rec: number;
  vencidos_pag: number;
  saldo_total: number;
}
