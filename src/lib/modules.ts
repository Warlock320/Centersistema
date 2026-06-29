export interface ModulosEmpresa {
  orcamentos: boolean;
  pedidos: boolean;
  nfe: boolean;
  estoque: boolean;
  financeiro: boolean;
  caixa: boolean;
  balcao: boolean;
  os: boolean;
  veiculos: boolean;
  busca_veiculo: boolean;
  crediario: boolean;
  comissoes: boolean;
  garantias: boolean;
  devolucoes: boolean;
  catalogo_whatsapp: boolean;
  etiquetas: boolean;
}

export const DEFAULT_MODULOS: ModulosEmpresa = {
  orcamentos: true,
  pedidos: true,
  nfe: true,
  estoque: true,
  financeiro: true,
  caixa: true,
  balcao: true,
  os: false,
  veiculos: false,
  busca_veiculo: false,
  crediario: true,
  comissoes: true,
  garantias: false,
  devolucoes: true,
  catalogo_whatsapp: true,
  etiquetas: true,
};

export const MODULO_INFO: Record<keyof ModulosEmpresa, { label: string; descricao: string; icone: string }> = {
  orcamentos: { label: 'Orçamentos', descricao: 'Criar e enviar orçamentos para clientes', icone: '📋' },
  pedidos: { label: 'Pedidos', descricao: 'Gestão de pedidos e faturamento', icone: '🛒' },
  nfe: { label: 'Notas Fiscais (NF-e)', descricao: 'Emissão e importação de notas fiscais', icone: '📄' },
  estoque: { label: 'Estoque', descricao: 'Controle de movimentações e mínimos', icone: '📦' },
  financeiro: { label: 'Financeiro', descricao: 'Contas a pagar/receber, bancos, conciliação', icone: '💰' },
  caixa: { label: 'Caixa', descricao: 'Abertura, operação e fechamento de caixa', icone: '🏦' },
  balcao: { label: 'Balcão (Pré-venda)', descricao: 'Venda rápida no balcão com comandas', icone: '🏪' },
  os: { label: 'Ordens de Serviço', descricao: 'Gestão de serviços e mão de obra', icone: '🔧' },
  veiculos: { label: 'Veículos', descricao: 'Cadastro de veículos dos clientes', icone: '🚗' },
  busca_veiculo: { label: 'Busca por Veículo', descricao: 'Consulta de peças por marca/modelo/ano (FIPE)', icone: '🔍' },
  crediario: { label: 'Crediário', descricao: 'Vendas a prazo com controle de crédito', icone: '💳' },
  comissoes: { label: 'Comissões', descricao: 'Cálculo de comissão por vendedor', icone: '📊' },
  garantias: { label: 'Garantias', descricao: 'Controle de garantias por produto/venda', icone: '🛡️' },
  devolucoes: { label: 'Devoluções', descricao: 'Fluxo de devolução e troca com estorno', icone: '↩️' },
  catalogo_whatsapp: { label: 'Catálogo WhatsApp', descricao: 'Compartilhar lista de produtos via WhatsApp', icone: '📱' },
  etiquetas: { label: 'Etiquetas', descricao: 'Gerar etiquetas de preço com código de barras', icone: '🏷️' },
};

// Mapeia módulo → rotas que ele controla (para esconder do menu)
export const MODULO_ROTAS: Partial<Record<keyof ModulosEmpresa, string[]>> = {
  orcamentos: ['/dashboard/orcamentos', '/dashboard/aprovacoes'],
  pedidos: ['/dashboard/pedidos'],
  nfe: ['/dashboard/nfe'],
  estoque: ['/dashboard/estoque'],
  financeiro: ['/dashboard/financeiro', '/dashboard/financeiro/receber', '/dashboard/financeiro/pagar', '/dashboard/financeiro/bancos', '/dashboard/financeiro/conciliacao', '/dashboard/financeiro/categorias'],
  caixa: ['/dashboard/financeiro/caixa', '/dashboard/financeiro/caixa/relatorios'],
  balcao: ['/dashboard/balcao'],
  os: ['/dashboard/os'],
  veiculos: ['/dashboard/veiculos'],
  busca_veiculo: ['/dashboard/busca-veiculo'],
  crediario: ['/dashboard/crediario'],
  comissoes: ['/dashboard/comissoes'],
  garantias: ['/dashboard/garantias'],
  devolucoes: ['/dashboard/devolucoes'],
  catalogo_whatsapp: ['/dashboard/catalogo'],
  etiquetas: ['/dashboard/etiquetas'],
};
