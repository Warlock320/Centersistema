-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO - RPCs DE FLUXO DE NEGÓCIO
-- =====================================================================

-- RPC: Criar pedido a partir de orçamento aprovado
CREATE OR REPLACE FUNCTION public.create_pedido_from_orcamento(p_orcamento_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pedido_id UUID;
  v_rec       RECORD;
BEGIN
  SELECT * INTO v_rec FROM public.orcamentos WHERE id = p_orcamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado: %', p_orcamento_id;
  END IF;

  INSERT INTO public.pedidos (empresa_id, cliente_id, orcamento_id, total, status, observacoes)
  VALUES (v_rec.empresa_id, v_rec.cliente_id, v_rec.id, v_rec.total, 'aberto', v_rec.observacoes)
  RETURNING id INTO v_pedido_id;

  INSERT INTO public.pedido_itens (pedido_id, produto_id, descricao, quantidade, preco_unitario, total)
  SELECT v_pedido_id,
         produto_id,
         descricao,
         quantidade,
         (preco_unitario * (1 - desconto / 100)),
         total
  FROM public.orcamento_itens
  WHERE orcamento_itens.orcamento_id = p_orcamento_id;

  RETURN v_pedido_id;
END;
$$;

-- RPC: Duplicar orçamento para agilidade de vendas
CREATE OR REPLACE FUNCTION public.duplicate_orcamento(p_orcamento_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_novo_id UUID;
BEGIN
  INSERT INTO public.orcamentos (empresa_id, cliente_id, usuario_id, status, validade, observacoes, total)
  SELECT empresa_id, cliente_id, usuario_id, 'criado', validade, observacoes, total
  FROM public.orcamentos
  WHERE id = p_orcamento_id
  RETURNING id INTO v_novo_id;

  INSERT INTO public.orcamento_itens (orcamento_id, produto_id, descricao, quantidade, preco_unitario, desconto, total, ordem)
  SELECT v_novo_id, produto_id, descricao, quantidade, preco_unitario, desconto, total, ordem
  FROM public.orcamento_itens
  WHERE orcamento_itens.orcamento_id = p_orcamento_id;

  RETURN v_novo_id;
END;
$$;

-- RPC: Dashboard KPIs
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_empresa_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_faturamento_mes NUMERIC;
  v_pedidos_abertos INT;
  v_clientes_ativos INT;
  v_alertas_estoque INT;
BEGIN
  SELECT COALESCE(SUM(total), 0) INTO v_faturamento_mes
  FROM public.pedidos
  WHERE empresa_id = p_empresa_id
    AND status = 'faturado'
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', now());

  SELECT COUNT(*) INTO v_pedidos_abertos
  FROM public.pedidos
  WHERE empresa_id = p_empresa_id AND status IN ('aberto','em_andamento');

  SELECT COUNT(*) INTO v_clientes_ativos
  FROM public.clientes
  WHERE empresa_id = p_empresa_id AND ativo = true;

  SELECT COUNT(*) INTO v_alertas_estoque
  FROM public.produtos
  WHERE empresa_id = p_empresa_id AND ativo = true AND estoque_minimo > 0 AND estoque < estoque_minimo;

  RETURN json_build_object(
    'faturamento_mes', v_faturamento_mes,
    'pedidos_abertos', v_pedidos_abertos,
    'clientes_ativos', v_clientes_ativos,
    'alertas_estoque', v_alertas_estoque
  );
END;
$$;
