-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v2 — MELHORIAS DE FLUXO
-- Execute APÓS os scripts anteriores
-- =====================================================================

-- RPC: Faturar pedido com baixa de estoque automática
-- Executado quando um pedido muda de em_andamento → faturado
CREATE OR REPLACE FUNCTION public.faturar_pedido(p_pedido_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pedido RECORD;
  v_item   RECORD;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id; END IF;
  IF v_pedido.status = 'faturado' THEN RETURN false; END IF;

  -- Atualiza status do pedido
  UPDATE public.pedidos
  SET status = 'faturado', updated_at = now()
  WHERE id = p_pedido_id;

  -- Cria movimentação de saída para cada item com produto vinculado
  FOR v_item IN
    SELECT pi.*, p.custo
    FROM public.pedido_itens pi
    LEFT JOIN public.produtos p ON p.id = pi.produto_id
    WHERE pi.pedido_id = p_pedido_id AND pi.produto_id IS NOT NULL
  LOOP
    INSERT INTO public.movimentacoes_estoque
      (empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, observacao)
    VALUES
      (v_pedido.empresa_id, v_item.produto_id, 'saida', v_item.quantidade,
       COALESCE(v_item.custo, 0),
       'pedido', p_pedido_id,
       'Pedido #' || v_pedido.numero || ' faturado');
  END LOOP;

  -- Se o pedido veio de um orçamento, avança o status do orçamento para 'enviado'
  IF v_pedido.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos
    SET status = 'enviado', updated_at = now()
    WHERE id = v_pedido.orcamento_id
      AND status IN ('aprovado', 'aguardando_pecas');
  END IF;

  RETURN true;
END;
$$;

-- RPC: Cancelar pedido com estorno de estoque (caso haja saídas registradas)
CREATE OR REPLACE FUNCTION public.cancelar_pedido(p_pedido_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pedido RECORD;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND OR v_pedido.status = 'cancelado' THEN RETURN false; END IF;

  -- Deleta movimentações de saída vinculadas (o trigger de estorno cuida do estoque)
  DELETE FROM public.movimentacoes_estoque
  WHERE referencia_tipo = 'pedido' AND referencia_id = p_pedido_id AND tipo = 'saida';

  UPDATE public.pedidos SET status = 'cancelado', updated_at = now() WHERE id = p_pedido_id;

  RETURN true;
END;
$$;

-- View: Histórico de movimentações por produto (para tela de detalhes do produto)
CREATE OR REPLACE VIEW public.v_movimentacoes_produto AS
  SELECT
    m.*,
    p.nome AS produto_nome,
    p.empresa_id
  FROM public.movimentacoes_estoque m
  JOIN public.produtos p ON p.id = m.produto_id;

-- Índices de performance para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_orcamentos_status       ON public.orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_empresa      ON public.orcamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status          ON public.pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa         ON public.pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa        ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa        ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto   ON public.movimentacoes_estoque(produto_id);
