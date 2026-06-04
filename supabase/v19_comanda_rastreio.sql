-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v19 — RASTREABILIDADE DA PRÉ-VENDA
-- Liga contas_receber e movimentos_caixa à comanda de origem.
-- Execute APÓS o v17/v18 (idempotente).
-- =====================================================================

ALTER TABLE public.contas_receber   ADD COLUMN IF NOT EXISTS comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;
ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS comanda_id UUID REFERENCES public.comandas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cr_comanda  ON public.contas_receber(comanda_id);
CREATE INDEX IF NOT EXISTS idx_mov_comanda ON public.movimentos_caixa(comanda_id);

-- ─────────────────────────────────────────────────────────────────────
-- Recria faturar_comanda preenchendo comanda_id nos lançamentos gerados
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.faturar_comanda(
  p_comanda_id   UUID,
  p_forma        TEXT,
  p_caixa_id     UUID DEFAULT NULL,
  p_parcelas     INT  DEFAULT 1,
  p_cliente_id   UUID DEFAULT NULL,
  p_primeiro_venc DATE DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa   UUID := get_empresa_id();
  v_com       public.comandas%ROWTYPE;
  v_item      RECORD;
  v_cliente   UUID;
  v_total     NUMERIC;
  v_forma_cr  TEXT;
  v_grupo     UUID;
  v_n         INT;
  v_valor_par NUMERIC;
  v_base      DATE;
  v_caixa_st  TEXT;
  i           INT;
BEGIN
  SELECT * INTO v_com FROM public.comandas WHERE id = p_comanda_id AND empresa_id = v_empresa;
  IF v_com.id IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_com.status = 'faturada' THEN RAISE EXCEPTION 'Comanda já faturada.'; END IF;
  IF v_com.status = 'cancelada' THEN RAISE EXCEPTION 'Comanda cancelada.'; END IF;

  SELECT COALESCE(SUM(total),0) INTO v_total FROM public.comanda_itens WHERE comanda_id = p_comanda_id;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Comanda sem valor.'; END IF;

  v_cliente := COALESCE(p_cliente_id, v_com.cliente_id);
  IF p_forma = 'crediario' AND v_cliente IS NULL THEN
    RAISE EXCEPTION 'Venda no crediário exige um cliente.';
  END IF;

  -- Baixa de estoque
  FOR v_item IN
    SELECT ci.*, p.custo FROM public.comanda_itens ci
    LEFT JOIN public.produtos p ON p.id = ci.produto_id
    WHERE ci.comanda_id = p_comanda_id AND ci.produto_id IS NOT NULL
  LOOP
    INSERT INTO public.movimentacoes_estoque
      (empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, observacao)
    VALUES
      (v_empresa, v_item.produto_id, 'saida', v_item.quantidade, COALESCE(v_item.custo,0),
       'comanda', p_comanda_id, 'Pré-venda Nº ' || v_com.numero);
  END LOOP;

  IF p_forma = 'crediario' THEN
    v_n := GREATEST(1, COALESCE(p_parcelas,1));
    v_grupo := gen_random_uuid();
    v_valor_par := ROUND(v_total / v_n, 2);
    v_base := COALESCE(p_primeiro_venc, CURRENT_DATE + 30);
    FOR i IN 1..v_n LOOP
      INSERT INTO public.contas_receber
        (empresa_id, unidade_id, cliente_id, comanda_id, forma_pagamento, descricao, valor,
         data_emissao, data_vencimento, status, numero_parcela, total_parcelas, grupo_parcelas)
      VALUES
        (v_empresa, v_com.unidade_id, v_cliente, p_comanda_id, 'credito_parcelado',
         'Pré-venda Nº ' || v_com.numero || ' (' || i || '/' || v_n || ')',
         v_valor_par, CURRENT_DATE, (v_base + ((i-1) * INTERVAL '1 month'))::DATE,
         'pendente', i, v_n, v_grupo);
    END LOOP;
  ELSE
    v_forma_cr := CASE p_forma
      WHEN 'credito' THEN 'credito_vista'
      WHEN 'dinheiro' THEN 'dinheiro' WHEN 'pix' THEN 'pix'
      WHEN 'debito' THEN 'debito' WHEN 'transferencia' THEN 'transferencia'
      ELSE 'outro' END;

    INSERT INTO public.contas_receber
      (empresa_id, unidade_id, cliente_id, comanda_id, forma_pagamento, descricao, valor, valor_pago,
       data_emissao, data_vencimento, data_pagamento, status)
    VALUES
      (v_empresa, v_com.unidade_id, v_cliente, p_comanda_id, v_forma_cr,
       'Pré-venda Nº ' || v_com.numero, v_total, v_total,
       CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, 'pago');

    IF p_caixa_id IS NOT NULL THEN
      SELECT status INTO v_caixa_st FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
      IF v_caixa_st IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
      IF v_caixa_st <> 'aberto' THEN RAISE EXCEPTION 'O caixa não está aberto para receber.'; END IF;
      INSERT INTO public.movimentos_caixa
        (empresa_id, caixa_id, tipo, categoria, forma_pagamento, valor, descricao, cliente_id, usuario_id, comanda_id)
      VALUES
        (v_empresa, p_caixa_id, 'entrada', 'recebimento', p_forma, v_total,
         'Pré-venda Nº ' || v_com.numero, v_cliente, auth.uid(), p_comanda_id);
    END IF;
  END IF;

  UPDATE public.comandas
  SET status = 'faturada', total = v_total, forma_pagamento = p_forma,
      cliente_id = v_cliente, caixa_id = p_caixa_id, faturada_em = now(), updated_at = now()
  WHERE id = p_comanda_id;

  RETURN json_build_object('numero', v_com.numero, 'total', v_total, 'forma', p_forma);
END;
$$;
