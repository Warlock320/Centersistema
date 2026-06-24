-- v35 — Papéis customizáveis por empresa
-- Permite criar papéis além dos 6 fixos, com permissões individuais.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.papeis_custom (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID         NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome         TEXT         NOT NULL,
  descricao    TEXT,
  cor          TEXT         DEFAULT 'bg-slate-100 text-slate-700',
  permissoes   TEXT[]       NOT NULL DEFAULT '{}',
  ativo        BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS papeis_custom_nome_uniq
  ON public.papeis_custom (empresa_id, nome) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS papeis_custom_empresa_idx
  ON public.papeis_custom (empresa_id);

ALTER TABLE public.papeis_custom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS papeis_custom_policy ON public.papeis_custom;
CREATE POLICY papeis_custom_policy ON public.papeis_custom
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
