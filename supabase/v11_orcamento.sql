-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v11 — ORÇAMENTO: PRAZO E OBSERVAÇÕES
-- Execute APÓS os scripts anteriores
-- =====================================================================

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS prazo_dias            INT,
  ADD COLUMN IF NOT EXISTS observacoes_internas  TEXT;

-- observacoes (já existente) passa a ser a observação EXTERNA (vai no PDF/cliente)
-- observacoes_internas: anotações internas (ex: comprar no fornecedor X) — NÃO vão no PDF
