-- v38 — Módulos configuráveis por empresa
-- Cada empresa pode ligar/desligar funcionalidades do sistema.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.modulos_empresa (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID         NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  orcamentos   BOOLEAN      NOT NULL DEFAULT true,
  pedidos      BOOLEAN      NOT NULL DEFAULT true,
  nfe          BOOLEAN      NOT NULL DEFAULT true,
  estoque      BOOLEAN      NOT NULL DEFAULT true,
  financeiro   BOOLEAN      NOT NULL DEFAULT true,
  caixa        BOOLEAN      NOT NULL DEFAULT true,
  balcao       BOOLEAN      NOT NULL DEFAULT true,
  os           BOOLEAN      NOT NULL DEFAULT false,
  veiculos     BOOLEAN      NOT NULL DEFAULT false,
  busca_veiculo BOOLEAN     NOT NULL DEFAULT false,
  crediario    BOOLEAN      NOT NULL DEFAULT true,
  comissoes    BOOLEAN      NOT NULL DEFAULT true,
  garantias    BOOLEAN      NOT NULL DEFAULT false,
  devolucoes   BOOLEAN      NOT NULL DEFAULT true,
  catalogo_whatsapp BOOLEAN NOT NULL DEFAULT true,
  etiquetas    BOOLEAN      NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.modulos_empresa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS modulos_empresa_policy ON public.modulos_empresa;
CREATE POLICY modulos_empresa_policy ON public.modulos_empresa
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- Campos customizáveis no produto (tags genéricas em vez de "aplicações")
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Tema de cores por empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tema_cor_primaria TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS tema_cor_secundaria TEXT DEFAULT '#0f172a';

-- Flag para pular aprovação de orçamento (venda direta)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS orcamento_pular_aprovacao BOOLEAN DEFAULT false;
