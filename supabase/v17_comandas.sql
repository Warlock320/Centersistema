-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v17 — COMANDA / PRÉ-VENDA DE BALCÃO (Fase A)
-- Execute APÓS os scripts anteriores (idempotente).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. PRODUTO — campo "aplicação" (entra na busca F7 do balcão)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS aplicacao TEXT;

-- ─────────────────────────────────────────────────────────────────────
-- 2. COMANDAS (pré-venda de balcão)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comandas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero              BIGSERIAL,
  unidade_id          UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  vendedor_id         UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cliente_id          UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status              VARCHAR(16) NOT NULL DEFAULT 'aberta'
                        CHECK (status IN ('aberta','aguardando_caixa','faturada','cancelada')),
  total               NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao          TEXT,
  caixa_id            UUID REFERENCES public.caixas(id) ON DELETE SET NULL,
  forma_pagamento     TEXT,
  faturada_em         TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comandas_empresa ON public.comandas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comandas_status  ON public.comandas(status);
CREATE INDEX IF NOT EXISTS idx_comandas_numero  ON public.comandas(numero);

CREATE TABLE IF NOT EXISTS public.comanda_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  comanda_id      UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  produto_id      UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao       TEXT NOT NULL,
  quantidade      NUMERIC(12,3) NOT NULL DEFAULT 1,
  preco_unitario  NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comanda_itens_comanda ON public.comanda_itens(comanda_id);

-- RLS
ALTER TABLE public.comandas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comandas_policy ON public.comandas;
CREATE POLICY comandas_policy ON public.comandas
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
DROP POLICY IF EXISTS comanda_itens_policy ON public.comanda_itens;
CREATE POLICY comanda_itens_policy ON public.comanda_itens
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 3. RPC: enviar comanda para o caixa
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enviar_comanda_caixa(p_comanda_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
  v_numero  BIGINT;
  v_total   NUMERIC;
  v_itens   INT;
BEGIN
  SELECT status, numero INTO v_status, v_numero
  FROM public.comandas WHERE id = p_comanda_id AND empresa_id = v_empresa;
  IF v_numero IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_status NOT IN ('aberta','aguardando_caixa') THEN RAISE EXCEPTION 'Esta comanda já foi finalizada.'; END IF;

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO v_itens, v_total
  FROM public.comanda_itens WHERE comanda_id = p_comanda_id;
  IF v_itens = 0 THEN RAISE EXCEPTION 'Adicione ao menos um item antes de finalizar.'; END IF;

  UPDATE public.comandas
  SET status = 'aguardando_caixa', total = v_total, updated_at = now()
  WHERE id = p_comanda_id;

  RETURN v_numero;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. RPC: faturar comanda (no caixa) — baixa estoque + financeiro + caixa
--    Formas à vista: dinheiro, pix, debito, credito, transferencia
--    Crediário: gera parcelas (limite validado na tela antes de chamar)
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

  -- Baixa de estoque (itens com produto vinculado)
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
    -- Gera parcelas em aberto (crediário)
    v_n := GREATEST(1, COALESCE(p_parcelas,1));
    v_grupo := gen_random_uuid();
    v_valor_par := ROUND(v_total / v_n, 2);
    v_base := COALESCE(p_primeiro_venc, CURRENT_DATE + 30);
    FOR i IN 1..v_n LOOP
      INSERT INTO public.contas_receber
        (empresa_id, unidade_id, cliente_id, forma_pagamento, descricao, valor,
         data_emissao, data_vencimento, status, numero_parcela, total_parcelas, grupo_parcelas)
      VALUES
        (v_empresa, v_com.unidade_id, v_cliente, 'credito_parcelado',
         'Pré-venda Nº ' || v_com.numero || ' (' || i || '/' || v_n || ')',
         v_valor_par, CURRENT_DATE, (v_base + ((i-1) * INTERVAL '1 month'))::DATE,
         'pendente', i, v_n, v_grupo);
    END LOOP;
  ELSE
    -- À vista: forma p/ contas_receber + entrada no caixa
    v_forma_cr := CASE p_forma
      WHEN 'credito' THEN 'credito_vista'
      WHEN 'dinheiro' THEN 'dinheiro' WHEN 'pix' THEN 'pix'
      WHEN 'debito' THEN 'debito' WHEN 'transferencia' THEN 'transferencia'
      ELSE 'outro' END;

    INSERT INTO public.contas_receber
      (empresa_id, unidade_id, cliente_id, forma_pagamento, descricao, valor, valor_pago,
       data_emissao, data_vencimento, data_pagamento, status)
    VALUES
      (v_empresa, v_com.unidade_id, v_cliente, v_forma_cr,
       'Pré-venda Nº ' || v_com.numero, v_total, v_total,
       CURRENT_DATE, CURRENT_DATE, CURRENT_DATE, 'pago');

    -- Entrada no caixa (gaveta), se foi recebido por um caixa aberto
    IF p_caixa_id IS NOT NULL THEN
      SELECT status INTO v_caixa_st FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
      IF v_caixa_st IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
      IF v_caixa_st <> 'aberto' THEN RAISE EXCEPTION 'O caixa não está aberto para receber.'; END IF;
      INSERT INTO public.movimentos_caixa
        (empresa_id, caixa_id, tipo, categoria, forma_pagamento, valor, descricao, cliente_id, usuario_id)
      VALUES
        (v_empresa, p_caixa_id, 'entrada', 'recebimento', p_forma, v_total,
         'Pré-venda Nº ' || v_com.numero, v_cliente, auth.uid());
    END IF;
  END IF;

  UPDATE public.comandas
  SET status = 'faturada', total = v_total, forma_pagamento = p_forma,
      cliente_id = v_cliente, caixa_id = p_caixa_id, faturada_em = now(), updated_at = now()
  WHERE id = p_comanda_id;

  RETURN json_build_object('numero', v_com.numero, 'total', v_total, 'forma', p_forma);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RPC: cancelar comanda (antes de faturar)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_comanda(p_comanda_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
BEGIN
  SELECT status INTO v_status FROM public.comandas WHERE id = p_comanda_id AND empresa_id = v_empresa;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_status = 'faturada' THEN RAISE EXCEPTION 'Comanda faturada não pode ser cancelada.'; END IF;

  UPDATE public.comandas
  SET status = 'cancelada', motivo_cancelamento = p_motivo, updated_at = now()
  WHERE id = p_comanda_id;
END;
$$;
