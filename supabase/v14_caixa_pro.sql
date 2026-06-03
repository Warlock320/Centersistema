-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v14 — CAIXA PROFISSIONAL + AUDITORIA + CONCILIAÇÃO
-- Execute APÓS os scripts anteriores (idempotente).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. CAIXAS — máquina de estados: aberto → em_conferencia → encerrado
-- ─────────────────────────────────────────────────────────────────────
-- Migra dados antigos antes de trocar o CHECK
UPDATE public.caixas SET status = 'encerrado' WHERE status = 'fechado';

ALTER TABLE public.caixas DROP CONSTRAINT IF EXISTS caixas_status_check;
-- 'em_conferencia' tem 14 chars; a coluna nasceu VARCHAR(10) no v10 → amplia
ALTER TABLE public.caixas ALTER COLUMN status TYPE VARCHAR(20);
ALTER TABLE public.caixas
  ALTER COLUMN status SET DEFAULT 'aberto';
ALTER TABLE public.caixas ADD CONSTRAINT caixas_status_check
  CHECK (status IN ('aberto','em_conferencia','encerrado'));

ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS conferido_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS encerrado_em  TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────
-- 2. MOVIMENTOS DO CAIXA — categoria + cliente/responsável + auditoria
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS categoria VARCHAR(12) NOT NULL DEFAULT 'recebimento';
ALTER TABLE public.movimentos_caixa DROP CONSTRAINT IF EXISTS movcaixa_categoria_check;
ALTER TABLE public.movimentos_caixa ADD CONSTRAINT movcaixa_categoria_check
  CHECK (categoria IN ('abertura','recebimento','sangria','suprimento'));

ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS cliente_id          UUID REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS usuario_id          UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS cancelado           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS cancelado_por       UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS cancelado_em        TIMESTAMPTZ;
ALTER TABLE public.movimentos_caixa ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- ─────────────────────────────────────────────────────────────────────
-- 3. REABERTURAS DE CAIXA — trilha de auditoria
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reaberturas_caixa (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  caixa_id    UUID NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  motivo      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reaberturas_caixa ON public.reaberturas_caixa(caixa_id);

ALTER TABLE public.reaberturas_caixa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reaberturas_caixa_policy ON public.reaberturas_caixa;
CREATE POLICY reaberturas_caixa_policy ON public.reaberturas_caixa
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 4. CONCILIAÇÃO BANCÁRIA — flags em contas a receber/pagar
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS conciliado     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS conciliado_em  TIMESTAMPTZ;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS conciliado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

ALTER TABLE public.contas_pagar   ADD COLUMN IF NOT EXISTS conciliado     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.contas_pagar   ADD COLUMN IF NOT EXISTS conciliado_em  TIMESTAMPTZ;
ALTER TABLE public.contas_pagar   ADD COLUMN IF NOT EXISTS conciliado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RPCs
-- ─────────────────────────────────────────────────────────────────────

-- Abrir caixa: bloqueia se houver caixa pendente (aberto ou em conferência)
CREATE OR REPLACE FUNCTION public.abrir_caixa(
  p_unidade_id    UUID DEFAULT NULL,
  p_saldo_inicial NUMERIC DEFAULT 0,
  p_observacao    TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_caixa   UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.caixas
    WHERE empresa_id = v_empresa AND status IN ('aberto','em_conferencia')
  ) THEN
    RAISE EXCEPTION 'Existe caixa pendente de fechamento. Encerre-o antes de abrir um novo.';
  END IF;

  INSERT INTO public.caixas (empresa_id, unidade_id, usuario_id, saldo_inicial, status, aberto_em, observacao)
  VALUES (v_empresa, p_unidade_id, auth.uid(), COALESCE(p_saldo_inicial,0), 'aberto', now(), p_observacao)
  RETURNING id INTO v_caixa;

  IF COALESCE(p_saldo_inicial,0) > 0 THEN
    INSERT INTO public.movimentos_caixa (empresa_id, caixa_id, tipo, categoria, forma_pagamento, valor, descricao, usuario_id)
    VALUES (v_empresa, v_caixa, 'entrada', 'abertura', 'dinheiro', p_saldo_inicial, 'Troco inicial (abertura)', auth.uid());
  END IF;

  RETURN v_caixa;
END;
$$;

-- Lançar movimento (recebimento / sangria / suprimento) — só com caixa aberto
CREATE OR REPLACE FUNCTION public.lancar_movimento_caixa(
  p_caixa_id   UUID,
  p_categoria  TEXT,
  p_forma      TEXT,
  p_valor      NUMERIC,
  p_cliente_id UUID DEFAULT NULL,
  p_descricao  TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
  v_tipo    TEXT;
  v_mov     UUID;
BEGIN
  SELECT status INTO v_status FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
  IF v_status <> 'aberto' THEN RAISE EXCEPTION 'O caixa não está aberto para movimentação.'; END IF;
  IF p_categoria NOT IN ('recebimento','sangria','suprimento') THEN
    RAISE EXCEPTION 'Categoria inválida.';
  END IF;
  IF COALESCE(p_valor,0) <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero.'; END IF;

  v_tipo := CASE WHEN p_categoria = 'sangria' THEN 'saida' ELSE 'entrada' END;

  INSERT INTO public.movimentos_caixa
    (empresa_id, caixa_id, tipo, categoria, forma_pagamento, valor, descricao, cliente_id, usuario_id)
  VALUES
    (v_empresa, p_caixa_id, v_tipo, p_categoria,
     CASE WHEN p_categoria = 'recebimento' THEN p_forma ELSE 'dinheiro' END,
     p_valor, p_descricao, p_cliente_id, auth.uid())
  RETURNING id INTO v_mov;

  RETURN v_mov;
END;
$$;

-- Enviar para conferência: calcula o dinheiro esperado e troca o status
CREATE OR REPLACE FUNCTION public.enviar_conferencia_caixa(
  p_caixa_id        UUID,
  p_saldo_informado NUMERIC,
  p_observacao      TEXT DEFAULT NULL
) RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa   UUID := get_empresa_id();
  v_status    TEXT;
  v_inicial   NUMERIC;
  v_entradas  NUMERIC;
  v_saidas    NUMERIC;
  v_calculado NUMERIC;
BEGIN
  SELECT status, saldo_inicial INTO v_status, v_inicial
  FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
  IF v_status <> 'aberto' THEN RAISE EXCEPTION 'O caixa não está aberto.'; END IF;

  SELECT COALESCE(SUM(valor),0) INTO v_entradas FROM public.movimentos_caixa
    WHERE caixa_id = p_caixa_id AND tipo = 'entrada' AND forma_pagamento = 'dinheiro' AND cancelado = false;
  SELECT COALESCE(SUM(valor),0) INTO v_saidas FROM public.movimentos_caixa
    WHERE caixa_id = p_caixa_id AND tipo = 'saida' AND forma_pagamento = 'dinheiro' AND cancelado = false;

  v_calculado := COALESCE(v_inicial,0) + v_entradas - v_saidas;

  UPDATE public.caixas
  SET status = 'em_conferencia', fechado_em = now(),
      saldo_informado = p_saldo_informado, saldo_calculado = v_calculado,
      observacao = COALESCE(p_observacao, observacao)
  WHERE id = p_caixa_id;

  RETURN v_calculado;
END;
$$;

-- Conferir e encerrar (gestor/financeiro)
CREATE OR REPLACE FUNCTION public.encerrar_caixa(p_caixa_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
BEGIN
  SELECT status INTO v_status FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
  IF v_status <> 'em_conferencia' THEN RAISE EXCEPTION 'O caixa precisa estar em conferência para ser encerrado.'; END IF;

  UPDATE public.caixas
  SET status = 'encerrado', encerrado_em = now(), conferido_por = auth.uid()
  WHERE id = p_caixa_id;
END;
$$;

-- Reabrir caixa (gestor/financeiro) — registra auditoria
CREATE OR REPLACE FUNCTION public.reabrir_caixa(p_caixa_id UUID, p_motivo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
BEGIN
  IF COALESCE(TRIM(p_motivo),'') = '' THEN RAISE EXCEPTION 'Informe o motivo da reabertura.'; END IF;

  SELECT status INTO v_status FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
  IF v_status NOT IN ('em_conferencia','encerrado') THEN RAISE EXCEPTION 'Só é possível reabrir caixa em conferência ou encerrado.'; END IF;

  -- Bloqueia reabertura se já houver outro caixa ativo
  IF EXISTS (
    SELECT 1 FROM public.caixas
    WHERE empresa_id = v_empresa AND status IN ('aberto','em_conferencia') AND id <> p_caixa_id
  ) THEN
    RAISE EXCEPTION 'Existe outro caixa em aberto. Encerre-o antes de reabrir este.';
  END IF;

  UPDATE public.caixas
  SET status = 'aberto', encerrado_em = NULL, conferido_por = NULL, fechado_em = NULL
  WHERE id = p_caixa_id;

  INSERT INTO public.reaberturas_caixa (empresa_id, caixa_id, usuario_id, motivo)
  VALUES (v_empresa, p_caixa_id, auth.uid(), p_motivo);
END;
$$;

-- Cancelar movimento (auditoria — não exclui)
CREATE OR REPLACE FUNCTION public.cancelar_movimento_caixa(p_mov_id UUID, p_motivo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_caixa   UUID;
  v_cat     TEXT;
  v_status  TEXT;
BEGIN
  IF COALESCE(TRIM(p_motivo),'') = '' THEN RAISE EXCEPTION 'Informe o motivo do cancelamento.'; END IF;

  SELECT caixa_id, categoria INTO v_caixa, v_cat
  FROM public.movimentos_caixa WHERE id = p_mov_id AND empresa_id = v_empresa;
  IF v_caixa IS NULL THEN RAISE EXCEPTION 'Movimento não encontrado.'; END IF;
  IF v_cat = 'abertura' THEN RAISE EXCEPTION 'O movimento de abertura não pode ser cancelado.'; END IF;

  SELECT status INTO v_status FROM public.caixas WHERE id = v_caixa;
  IF v_status <> 'aberto' THEN RAISE EXCEPTION 'Só é possível cancelar movimentos com o caixa aberto.'; END IF;

  UPDATE public.movimentos_caixa
  SET cancelado = true, cancelado_por = auth.uid(), cancelado_em = now(), motivo_cancelamento = p_motivo
  WHERE id = p_mov_id;
END;
$$;
