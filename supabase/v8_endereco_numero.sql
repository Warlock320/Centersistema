-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v8 — NÚMERO DO ENDEREÇO
-- Execute APÓS os scripts anteriores
-- =====================================================================

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS numero TEXT;

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS numero TEXT;
