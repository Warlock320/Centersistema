-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v6 — CAMPOS DE CADASTRO
-- Execute APÓS os scripts anteriores
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PRODUTOS: referência, fornecedor, localização e códigos auxiliares
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ref                TEXT,
  ADD COLUMN IF NOT EXISTS fornecedor_id      UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS localizacao        TEXT,
  ADD COLUMN IF NOT EXISTS codigos_auxiliares TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor ON public.produtos(fornecedor_id);
-- Índice GIN para buscar por código auxiliar
CREATE INDEX IF NOT EXISTS idx_produtos_cod_aux ON public.produtos USING GIN (codigos_auxiliares);

-- ─────────────────────────────────────────────────────────────────────
-- CLIENTES: razão social e inscrição estadual
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS razao_social       TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
