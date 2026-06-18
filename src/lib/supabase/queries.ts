import { createClient } from './client';
import type { OrcamentoStatus, PedidoStatus } from '@/types/database.types';

// ── Produtos ──────────────────────────────────────────────────────────────────
export const getProdutos = async () => {
  const supabase = createClient();
  return await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
};

export const getProdutosComCategoria = async () => {
  const supabase = createClient();
  return await supabase
    .from('produtos')
    .select('*, categorias(nome)')
    .eq('ativo', true)
    .order('nome');
};

export const getProdutosAbaixoMinimo = async () => {
  const supabase = createClient();
  return await supabase.from('v_produtos_abaixo_minimo').select('*').order('nome');
};

// ── Clientes ──────────────────────────────────────────────────────────────────
export const getClientes = async () => {
  const supabase = createClient();
  return await supabase.from('clientes').select('*').eq('ativo', true).order('nome');
};

export const getClienteLtv = async (clienteId: string) => {
  const supabase = createClient();
  return await supabase.from('v_clientes_ltv').select('*').eq('id', clienteId).single();
};

// ── Orçamentos ────────────────────────────────────────────────────────────────
export const getOrcamentos = async () => {
  const supabase = createClient();
  return await supabase
    .from('orcamentos')
    .select('*, clientes(nome, cpf_cnpj), usuarios(nome)')
    .order('numero', { ascending: false });
};

export const getOrcamentoComItens = async (orcamentoId: string) => {
  const supabase = createClient();
  return await supabase
    .from('orcamentos')
    .select('*, clientes(*), usuarios(nome), orcamento_itens(*)')
    .eq('id', orcamentoId)
    .single();
};

export const updateOrcamentoStatus = async (id: string, status: OrcamentoStatus, obs?: string) => {
  const supabase = createClient();
  const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (obs !== undefined) payload.observacoes = obs;
  return await supabase.from('orcamentos').update(payload).eq('id', id);
};

export const createPedidoFromOrcamento = async (orcamentoId: string) => {
  const supabase = createClient();
  return await supabase.rpc('create_pedido_from_orcamento', { p_orcamento_id: orcamentoId });
};

export const duplicateOrcamento = async (orcamentoId: string) => {
  const supabase = createClient();
  return await supabase.rpc('duplicate_orcamento', { p_orcamento_id: orcamentoId });
};

// ── Pedidos ───────────────────────────────────────────────────────────────────
export const getPedidos = async () => {
  const supabase = createClient();
  return await supabase
    .from('pedidos')
    .select('*, clientes(nome), pedido_itens(*)')
    .order('numero', { ascending: false });
};

export const updatePedidoStatus = async (id: string, status: PedidoStatus) => {
  const supabase = createClient();
  return await supabase
    .from('pedidos')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
};

// ── Aprovações ────────────────────────────────────────────────────────────────
export const getOrcamentosParaAprovacao = async () => {
  const supabase = createClient();
  return await supabase
    .from('orcamentos')
    .select('*, clientes(nome, cpf_cnpj), usuarios(nome), orcamento_itens(*)')
    .eq('status', 'aguardando_aprovacao')
    .order('updated_at', { ascending: true });
};

// ── NF-e ──────────────────────────────────────────────────────────────────────
export const getNfeImportadas = async () => {
  const supabase = createClient();
  return await supabase.from('nfe_importadas').select('*').order('created_at', { ascending: false });
};

export const checkNfeDuplicidade = async (chaveAcesso: string) => {
  const supabase = createClient();
  const { data } = await supabase
    .from('nfe_importadas')
    .select('id')
    .eq('chave_acesso', chaveAcesso)
    .single();
  return !!data;
};

// ── Relatórios ────────────────────────────────────────────────────────────────
export const getRelatorioFaturamento = async (dataInicio: string, dataFim: string) => {
  const supabase = createClient();
  return await supabase
    .from('pedidos')
    .select('*, clientes(nome), pedido_itens(*)')
    .eq('status', 'faturado')
    .gte('created_at', dataInicio)
    .lte('created_at', dataFim + 'T23:59:59')
    .order('created_at', { ascending: false });
};

// ── Categorias ────────────────────────────────────────────────────────────────
export const getCategorias = async () => {
  const supabase = createClient();
  return await supabase.from('categorias').select('*').order('nome');
};

// ── Configurações / Equipe ────────────────────────────────────────────────────
export const getEquipe = async () => {
  const supabase = createClient();
  return await supabase.from('usuarios').select('*').order('nome');
};

export const getConvitesPendentes = async () => {
  const supabase = createClient();
  return await supabase.from('convites').select('*').eq('usado', false).order('created_at', { ascending: false });
};
