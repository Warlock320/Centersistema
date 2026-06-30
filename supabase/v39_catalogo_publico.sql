-- v39 — Catálogo público (vitrine online)
-- Idempotente.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS catalogo_ativo     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS catalogo_slug      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS catalogo_titulo    TEXT,
  ADD COLUMN IF NOT EXISTS catalogo_descricao TEXT,
  ADD COLUMN IF NOT EXISTS catalogo_whatsapp  TEXT;

-- Campo visivel_catalogo nos produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS visivel_catalogo BOOLEAN NOT NULL DEFAULT true;

-- View pública do catálogo (sem RLS — acessível sem autenticação)
CREATE OR REPLACE VIEW public.v_catalogo_publico AS
  SELECT
    p.id, p.codigo, p.nome, p.preco, p.estoque,
    p.imagem_url, p.tags, p.aplicacoes,
    c.nome AS categoria_nome,
    e.nome AS empresa_nome, e.logo_url AS empresa_logo,
    e.catalogo_titulo, e.catalogo_descricao,
    e.catalogo_whatsapp, e.tema_cor_primaria
  FROM public.produtos p
  JOIN public.empresas e ON e.id = p.empresa_id
  LEFT JOIN public.categorias c ON c.id = p.categoria
  WHERE p.ativo = true
    AND p.visivel_catalogo = true
    AND e.catalogo_ativo = true;
