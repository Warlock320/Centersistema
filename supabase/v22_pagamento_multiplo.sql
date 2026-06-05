-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v22 — RECEBIMENTO MÚLTIPLO + ATENDIMENTO NO CAIXA
-- Vários pagamentos por venda (PIX + dinheiro + cartão + crediário).
-- Execute APÓS o v17/v21 (idempotente).
-- =====================================================================

-- 1) Novo status: a pré-venda fica "em atendimento no caixa" enquanto o operador recebe
ALTER TABLE public.comandas DROP CONSTRAINT IF EXISTS comandas_status_check;
ALTER TABLE public.comandas ADD CONSTRAINT comandas_status_check
  CHECK (status IN ('aberta','orcamento','aguardando_caixa','em_atendimento_caixa','faturada','cancelada'));

-- 2) Pagamentos da comanda (cada forma é uma linha)
CREATE TABLE IF NOT EXISTS public.comanda_pagamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  comanda_id     UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  forma          TEXT NOT NULL,           -- dinheiro, pix, debito, credito, transferencia, crediario
  valor          NUMERIC(14,2) NOT NULL,
  parcelas       INT NOT NULL DEFAULT 1,  -- usado no crediário
  primeiro_venc  DATE,
  usuario_id     UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comanda_pag_comanda ON public.comanda_pagamentos(comanda_id);

ALTER TABLE public.comanda_pagamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comanda_pagamentos_policy ON public.comanda_pagamentos;
CREATE POLICY comanda_pagamentos_policy ON public.comanda_pagamentos
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- 3) Abrir atendimento no caixa (trava a pré-venda como "em atendimento")
CREATE OR REPLACE FUNCTION public.abrir_atendimento_caixa(p_comanda_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
BEGIN
  SELECT status INTO v_status FROM public.comandas WHERE id = p_comanda_id AND empresa_id = v_empresa;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_status NOT IN ('aguardando_caixa','em_atendimento_caixa') THEN
    RAISE EXCEPTION 'Esta pré-venda não está na fila do caixa.';
  END IF;
  UPDATE public.comandas SET status = 'em_atendimento_caixa', updated_at = now() WHERE id = p_comanda_id;
END;
$$;

-- 4) Voltar a pré-venda para a fila (cancela o atendimento)
CREATE OR REPLACE FUNCTION public.voltar_fila_caixa(p_comanda_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
BEGIN
  UPDATE public.comandas SET status = 'aguardando_caixa', updated_at = now()
  WHERE id = p_comanda_id AND empresa_id = v_empresa AND status = 'em_atendimento_caixa';
END;
$$;

-- 5) Faturar comanda com MÚLTIPLAS formas (lê comanda_pagamentos)
--    Regra: soma dos pagamentos = total da venda.
CREATE OR REPLACE FUNCTION public.faturar_comanda(p_comanda_id UUID, p_caixa_id UUID DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa   UUID := get_empresa_id();
  v_com       public.comandas%ROWTYPE;
  v_item      RECORD;
  v_pag       RECORD;
  v_total     NUMERIC;
  v_soma      NUMERIC;
  v_caixa_st  TEXT;
  v_forma_cr  TEXT;
  v_grupo     UUID;
  v_valor_par NUMERIC;
  v_base      DATE;
  v_formas    INT;
  v_forma_fin TEXT;
  i           INT;
BEGIN
  SELECT * INTO v_com FROM public.comandas WHERE id = p_comanda_id AND empresa_id = v_empresa;
  IF v_com.id IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_com.status NOT IN ('aguardando_caixa','em_atendimento_caixa') THEN
    RAISE EXCEPTION 'Esta pré-venda não está disponível para faturamento.';
  END IF;

  SELECT COALESCE(SUM(total),0) INTO v_total FROM public.comanda_itens WHERE comanda_id = p_comanda_id;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Comanda sem valor.'; END IF;

  SELECT COALESCE(SUM(valor),0) INTO v_soma FROM public.comanda_pagamentos WHERE comanda_id = p_comanda_id;
  IF ABS(v_soma - v_total) > 0.005 THEN
    RAISE EXCEPTION 'Pagamentos (R$ %) não fecham o total (R$ %).', to_char(v_soma,'FM999990.00'), to_char(v_total,'FM999990.00');
  END IF;

  -- Crediário exige cliente
  IF EXISTS (SELECT 1 FROM public.comanda_pagamentos WHERE comanda_id = p_comanda_id AND forma = 'crediario')
     AND v_com.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Há pagamento no crediário — selecione o cliente na comanda.';
  END IF;

  -- Caixa precisa estar aberto se houver forma imediata
  IF p_caixa_id IS NOT NULL THEN
    SELECT status INTO v_caixa_st FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
    IF v_caixa_st IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
    IF v_caixa_st <> 'aberto' THEN RAISE EXCEPTION 'O caixa não está aberto para receber.'; END IF;
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

  -- Processa cada pagamento
  FOR v_pag IN SELECT * FROM public.comanda_pagamentos WHERE comanda_id = p_comanda_id LOOP
    IF v_pag.forma = 'crediario' THEN
      -- Parcelas a receber
      v_grupo := gen_random_uuid();
      v_valor_par := ROUND(v_pag.valor / GREATEST(1, v_pag.parcelas), 2);
      v_base := COALESCE(v_pag.primeiro_venc, CURRENT_DATE + 30);
      FOR i IN 1..GREATEST(1, v_pag.parcelas) LOOP
        INSERT INTO public.contas_receber
          (empresa_id, unidade_id, cliente_id, comanda_id, forma_pagamento, descricao, valor,
           data_emissao, data_vencimento, status, numero_parcela, total_parcelas, grupo_parcelas)
        VALUES
          (v_empresa, v_com.unidade_id, v_com.cliente_id, p_comanda_id, 'credito_parcelado',
           'Pré-venda Nº ' || v_com.numero || ' (' || i || '/' || GREATEST(1, v_pag.parcelas) || ')',
           v_valor_par, CURRENT_DATE, (v_base + ((i-1) * INTERVAL '1 month'))::DATE,
           'pendente', i, GREATEST(1, v_pag.parcelas), v_grupo);
      END LOOP;
    ELSE
      -- Forma imediata: conta a receber paga + entrada no caixa (por forma)
      v_forma_cr := CASE v_pag.forma
        WHEN 'credito' THEN 'credito_vista'
        WHEN 'dinheiro' THEN 'dinheiro' WHEN 'pix' THEN 'pix'
        WHEN 'debito' THEN 'debito' WHEN 'transferencia' THEN 'transferencia'
        ELSE 'outro' END;
      INSERT INTO public.contas_receber
        (empresa_id, unidade_id, cliente_id, comanda_id, forma_pagamento, descricao, valor, valor_pago,
         data_emissao, data_vencimento, data_pagamento, status)
      VALUES
        (v_empresa, v_com.unidade_id, v_com.cliente_id, p_comanda_id, v_forma_cr,
         'Pré-venda Nº ' || v_com.numero, v_pag.valor, v_pag.valor,
         CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, 'pago');
      IF p_caixa_id IS NOT NULL THEN
        INSERT INTO public.movimentos_caixa
          (empresa_id, caixa_id, tipo, categoria, forma_pagamento, valor, descricao, cliente_id, usuario_id, comanda_id)
        VALUES
          (v_empresa, p_caixa_id, 'entrada', 'recebimento', v_pag.forma, v_pag.valor,
           'Pré-venda Nº ' || v_com.numero, v_com.cliente_id, auth.uid(), p_comanda_id);
      END IF;
    END IF;
  END LOOP;

  -- Forma resumo na comanda
  SELECT COUNT(DISTINCT forma) INTO v_formas FROM public.comanda_pagamentos WHERE comanda_id = p_comanda_id;
  IF v_formas = 1 THEN
    SELECT forma INTO v_forma_fin FROM public.comanda_pagamentos WHERE comanda_id = p_comanda_id LIMIT 1;
  ELSE
    v_forma_fin := 'multiplo';
  END IF;

  UPDATE public.comandas
  SET status = 'faturada', total = v_total, forma_pagamento = v_forma_fin,
      caixa_id = p_caixa_id, faturada_em = now(), updated_at = now()
  WHERE id = p_comanda_id;

  RETURN json_build_object('numero', v_com.numero, 'total', v_total, 'forma', v_forma_fin);
END;
$$;
