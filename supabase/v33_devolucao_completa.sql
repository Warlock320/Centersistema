-- v33 — Devolução completa: estorno estoque + ajuste financeiro + vínculo
-- Tudo dentro de uma transação atômica (a função PL/pgSQL é transacional).

-- Adiciona referência à devolução na conta_receber (para rastreio)
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS devolucao_id UUID REFERENCES public.devolucoes(id) ON DELETE SET NULL;

-- Adiciona campo nfe_devolucao_id na devolução (para futura NF-e de entrada)
ALTER TABLE public.devolucoes
  ADD COLUMN IF NOT EXISTS nfe_devolucao_id UUID REFERENCES public.nfe_emitidas(id) ON DELETE SET NULL;

-- =====================================================================
-- RPC: Aprovar devolução (tudo atômico)
-- 1. Valida que está pendente
-- 2. Marca como concluída
-- 3. Estorna estoque (movimentações de entrada)
-- 4. Gera crédito ao cliente (conta a receber negativa ou ajuste)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.aprovar_devolucao(
  p_devolucao_id UUID,
  p_aprovado_por UUID
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_dev          RECORD;
  v_item         RECORD;
  v_conta_id     UUID;
  v_pedido_num   INT;
  v_total_dev    NUMERIC := 0;
BEGIN
  -- 1. Buscar e validar devolução
  SELECT d.*, p.numero AS pedido_numero, p.empresa_id
  INTO v_dev
  FROM public.devolucoes d
  JOIN public.pedidos p ON p.id = d.pedido_id
  WHERE d.id = p_devolucao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devolução não encontrada: %', p_devolucao_id;
  END IF;

  IF v_dev.status != 'pendente' THEN
    RAISE EXCEPTION 'Devolução já foi processada (status: %)', v_dev.status;
  END IF;

  v_pedido_num := v_dev.pedido_numero;

  -- 2. Estornar estoque de cada item
  FOR v_item IN
    SELECT di.*, pr.custo
    FROM public.devolucao_itens di
    LEFT JOIN public.produtos pr ON pr.id = di.produto_id
    WHERE di.devolucao_id = p_devolucao_id AND di.produto_id IS NOT NULL
  LOOP
    INSERT INTO public.movimentacoes_estoque
      (empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, observacao)
    VALUES (
      v_dev.empresa_id, v_item.produto_id, 'entrada', v_item.quantidade,
      COALESCE(v_item.custo, 0), 'devolucao', p_devolucao_id,
      'Devolução do pedido #' || v_pedido_num || ' — ' || v_item.descricao
    );

    v_total_dev := v_total_dev + v_item.total;
  END LOOP;

  -- 3. Ajuste financeiro: criar conta a receber com valor NEGATIVO (crédito ao cliente)
  -- Isso reduz o saldo devedor do cliente automaticamente nos relatórios
  IF v_total_dev > 0 THEN
    INSERT INTO public.contas_receber (
      empresa_id, cliente_id, pedido_id, devolucao_id,
      descricao, valor, data_emissao, data_vencimento,
      status, valor_pago, numero_parcela, total_parcelas
    ) VALUES (
      v_dev.empresa_id, v_dev.cliente_id, v_dev.pedido_id, p_devolucao_id,
      'Crédito por ' || CASE v_dev.tipo WHEN 'devolucao' THEN 'devolução' ELSE 'troca' END
        || ' — Pedido #' || v_pedido_num,
      -v_total_dev,
      CURRENT_DATE, CURRENT_DATE,
      'pago', -v_total_dev, 1, 1
    ) RETURNING id INTO v_conta_id;
  END IF;

  -- 4. Marcar devolução como concluída
  UPDATE public.devolucoes
  SET status = 'concluida', aprovado_por = p_aprovado_por
  WHERE id = p_devolucao_id;

  RETURN json_build_object(
    'ok', true,
    'estoque_estornado', v_total_dev > 0,
    'credito_gerado', v_total_dev,
    'conta_receber_id', v_conta_id
  );
END;
$$;
