-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v18 — MÚLTIPLAS APLICAÇÕES POR PRODUTO
-- Execute APÓS os scripts anteriores (idempotente).
-- =====================================================================

-- Lista de aplicações (vários veículos/anos por peça)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS aplicacoes TEXT[] NOT NULL DEFAULT '{}';

-- Migra o campo único 'aplicacao' (v17) para a lista, se existir e estiver preenchido
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'aplicacao'
  ) THEN
    UPDATE public.produtos
    SET aplicacoes = ARRAY[aplicacao]
    WHERE aplicacao IS NOT NULL AND TRIM(aplicacao) <> ''
      AND (aplicacoes IS NULL OR array_length(aplicacoes, 1) IS NULL);
  END IF;
END $$;
