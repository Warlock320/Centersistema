-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v10 — CAIXA DIÁRIO
-- Execute APÓS os scripts anteriores
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. CAIXAS (sessão de caixa diário)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.caixas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id       UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  usuario_id       UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  saldo_inicial    NUMERIC(14,2) NOT NULL DEFAULT 0,
  status           VARCHAR(10) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  aberto_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_em       TIMESTAMPTZ,
  saldo_informado  NUMERIC(14,2),   -- dinheiro conferido na gaveta ao fechar
  saldo_calculado  NUMERIC(14,2),   -- dinheiro esperado pelo sistema ao fechar
  observacao       TEXT
);

CREATE INDEX IF NOT EXISTS idx_caixas_empresa ON public.caixas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_caixas_status  ON public.caixas(status);

-- ─────────────────────────────────────────────────────────────────────
-- 2. MOVIMENTOS DO CAIXA
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimentos_caixa (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  caixa_id         UUID NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  tipo             VARCHAR(7) NOT NULL CHECK (tipo IN ('entrada','saida')),
  forma_pagamento  TEXT,            -- pix, dinheiro, debito, credito, transferencia
  valor            NUMERIC(14,2) NOT NULL,
  descricao        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movcaixa_caixa ON public.movimentos_caixa(caixa_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.caixas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentos_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY caixas_policy ON public.caixas
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY movcaixa_policy ON public.movimentos_caixa
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 4. RPC: fechar caixa (calcula o dinheiro esperado e fecha)
--    Dinheiro esperado = saldo_inicial + entradas em dinheiro - saídas em dinheiro
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fechar_caixa(
  p_caixa_id        UUID,
  p_saldo_informado NUMERIC,
  p_observacao      TEXT DEFAULT NULL
) RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inicial    NUMERIC;
  v_entradas   NUMERIC;
  v_saidas     NUMERIC;
  v_calculado  NUMERIC;
BEGIN
  SELECT saldo_inicial INTO v_inicial FROM public.caixas WHERE id = p_caixa_id;

  SELECT COALESCE(SUM(valor), 0) INTO v_entradas
  FROM public.movimentos_caixa
  WHERE caixa_id = p_caixa_id AND tipo = 'entrada' AND forma_pagamento = 'dinheiro';

  SELECT COALESCE(SUM(valor), 0) INTO v_saidas
  FROM public.movimentos_caixa
  WHERE caixa_id = p_caixa_id AND tipo = 'saida' AND forma_pagamento = 'dinheiro';

  v_calculado := COALESCE(v_inicial, 0) + v_entradas - v_saidas;

  UPDATE public.caixas
  SET status = 'fechado',
      fechado_em = now(),
      saldo_informado = p_saldo_informado,
      saldo_calculado = v_calculado,
      observacao = p_observacao
  WHERE id = p_caixa_id;

  RETURN v_calculado;
END;
$$;
