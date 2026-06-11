-- v24 — Importação de NF-e: campo NCM no produto
-- (EAN/código de barras continua em produtos.codigos_auxiliares)
-- Idempotente.

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm VARCHAR(10);

COMMENT ON COLUMN produtos.ncm IS 'Código NCM do produto (preenchido na importação de NF-e)';
