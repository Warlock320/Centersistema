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
  login?: string | null;
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
  aplicacao: string | null;       // legado (campo único) — mantido por compat
  aplicacoes: string[];           // lista de aplicações (vários veículos/anos)
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

export type ComandaStatus = 'aberta' | 'orcamento' | 'aguardando_caixa' | 'em_atendimento_caixa' | 'faturada' | 'cancelada';

export interface ComandaPagamento {
  id: string;
  empresa_id: string;
  comanda_id: string;
  forma: string;
  valor: number;
  parcelas: number;
  primeiro_venc: string | null;
  usuario_id: string | null;
  created_at: string;
}

export interface Comanda {
  id: string;
  empresa_id: string;
  numero: number;
  unidade_id: string | null;
  vendedor_id: string | null;
  cliente_id: string | null;
  status: ComandaStatus;
  total: number;
  observacao: string | null;
  caixa_id: string | null;
  forma_pagamento: string | null;
  faturada_em: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string };
  vendedores?: { nome: string };
  comanda_itens?: ComandaItem[];
}

export interface ComandaItem {
  id: string;
  empresa_id: string;
  comanda_id: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  desconto: number;
  total: number;
  created_at: string;
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
  rg: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  endereco: string | null;
  numero: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  observacoes: string | null;
  limite_credito: number;
  status_credito: StatusCredito;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type StatusCredito = 'ativo' | 'bloqueado' | 'inadimplente' | 'em_analise';
// status_efetivo da view inclui 'atraso' (vencido mas dentro do prazo de inadimplência)
export type StatusCreditoEfetivo = StatusCredito | 'atraso';

export interface CreditoCliente {
  cliente_id: string;
  empresa_id: string;
  nome: string;
  telefone: string | null;
  celular: string | null;
  cpf_cnpj: string | null;
  limite_credito: number;
  limite_utilizado: number;
  limite_disponivel: number;
  pct_utilizado: number;
  status_credito: StatusCredito;
  status_efetivo: StatusCreditoEfetivo;
  parcelas_abertas: number;
  parcelas_vencidas: number;
  valor_vencido: number;
  dias_atraso_max: number;
  total_comprado: number;
  ultima_compra: string | null;
  ultimo_pagamento: string | null;
  score_pontos: number;
  score_estrelas: number;
}

export interface ParcelaCliente {
  id: string;
  empresa_id: string;
  cliente_id: string;
  cliente_nome: string;
  telefone: string | null;
  celular: string | null;
  cpf_cnpj: string | null;
  descricao: string;
  valor: number;
  valor_pago: number;
  saldo: number;
  data_vencimento: string;
  status: ContaReceberStatus;
  numero_parcela: number;
  total_parcelas: number;
  unidade_id: string | null;
  dias_atraso: number;
  faixa_atraso: 'a_vencer' | '1_30' | '31_60' | '61_90' | '90_mais';
}

export interface AprovacaoCredito {
  id: string;
  empresa_id: string;
  cliente_id: string;
  tipo: 'acima_limite' | 'inadimplente';
  valor: number;
  aprovado_por: string | null;
  motivo: string;
  created_at: string;
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
  prazo_dias: number | null;
  observacoes: string | null;
  observacoes_internas: string | null;
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

export type ContaReceberStatus = 'pendente' | 'pago_parcial' | 'pago' | 'cancelado';
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
  conciliado: boolean;
  conciliado_em: string | null;
  conciliado_por: string | null;
  comanda_id?: string | null;
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
  conciliado: boolean;
  conciliado_em: string | null;
  conciliado_por: string | null;
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

export interface Veiculo {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  marca: string | null;
  modelo: string;
  placa: string | null;
  ano: string | null;
  cor: string | null;
  km: number | null;
  chassi: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  clientes?: { nome: string };
}

export type OrdemServicoStatus = 'aberta' | 'em_execucao' | 'concluida' | 'entregue' | 'cancelada';

export interface OsItem {
  id: string;
  os_id: string;
  tipo: 'peca' | 'servico';
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
  ordem: number;
}

export interface OrdemServico {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  cliente_id: string;
  veiculo_id: string | null;
  tecnico_id: string | null;
  numero: number;
  status: OrdemServicoStatus;
  descricao_problema: string | null;
  diagnostico: string | null;
  observacoes: string | null;
  km_entrada: number | null;
  total_pecas: number;
  total_servicos: number;
  desconto: number;
  total: number;
  data_entrada: string;
  data_conclusao: string | null;
  data_entrega: string | null;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
  veiculos?: Veiculo;
  os_itens?: OsItem[];
}

export type CaixaStatus = 'aberto' | 'em_conferencia' | 'encerrado';
export type MovimentoCategoria = 'abertura' | 'recebimento' | 'sangria' | 'suprimento';

export interface Caixa {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  usuario_id: string | null;
  saldo_inicial: number;
  status: CaixaStatus;
  aberto_em: string;
  fechado_em: string | null;
  encerrado_em: string | null;
  conferido_por: string | null;
  saldo_informado: number | null;
  saldo_calculado: number | null;
  observacao: string | null;
}

export interface MovimentoCaixa {
  id: string;
  empresa_id: string;
  caixa_id: string;
  tipo: 'entrada' | 'saida';
  categoria: MovimentoCategoria;
  forma_pagamento: string | null;
  valor: number;
  descricao: string | null;
  cliente_id: string | null;
  usuario_id: string | null;
  cancelado: boolean;
  cancelado_por: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  comanda_id?: string | null;
  created_at: string;
  clientes?: Cliente;
  usuarios?: { nome: string };
}

export interface AuditLog {
  id: number;
  empresa_id: string | null;
  tabela: string;
  registro_id: string | null;
  operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  usuario_id: string | null;
  campos: string[] | null;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
  created_at: string;
  usuarios?: { nome: string };
}

export interface ReaberturaCaixa {
  id: string;
  empresa_id: string;
  caixa_id: string;
  usuario_id: string | null;
  motivo: string;
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
