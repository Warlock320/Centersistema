-- v28 — COMISSÃO DE VENDEDORES: configuração de percentual por usuário
-- Idempotente. Execute APÓS v27.

-- =====================================================================
-- 1. Tabela de configuração de comissão
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.comissao_config (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id  UUID          NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  percentual  NUMERIC(5,2)  NOT NULL DEFAULT 5.00,
  ativo       BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS comissao_config_empresa_idx
  ON public.comissao_config (empresa_id);

ALTER TABLE public.comissao_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comissao_config_policy ON public.comissao_config;
CREATE POLICY comissao_config_policy ON public.comissao_config
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
