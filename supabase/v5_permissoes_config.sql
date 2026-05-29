-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v5 — PERMISSÕES EDITÁVEIS POR PAPEL
-- Execute APÓS o v4_permissoes.sql
-- Permite que o admin customize, por empresa, o que cada papel visualiza/faz.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. TABELA permissoes_papel (override por empresa)
--    Se um papel não tiver nenhuma linha, o app usa a matriz default do código.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissoes_papel (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  papel       TEXT NOT NULL CHECK (papel IN ('admin','gestor','financeiro','vendedor')),
  permissao   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, papel, permissao)
);

CREATE INDEX IF NOT EXISTS idx_permissoes_papel_empresa ON public.permissoes_papel(empresa_id);

ALTER TABLE public.permissoes_papel ENABLE ROW LEVEL SECURITY;

CREATE POLICY permissoes_papel_policy ON public.permissoes_papel
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 2. RPC: salvar as permissões de um papel (substitui as existentes)
--    Apenas admin pode executar. O papel 'admin' é protegido (sempre total).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.salvar_permissoes_papel(
  p_papel       TEXT,
  p_permissoes  TEXT[]
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa_id UUID;
  v_perm       TEXT;
BEGIN
  -- Só admin
  IF NOT public.user_has_role('admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar permissões.';
  END IF;

  -- O papel admin não é editável
  IF p_papel = 'admin' THEN
    RETURN false;
  END IF;

  v_empresa_id := public.get_empresa_id();

  -- Substitui as permissões do papel nesta empresa
  DELETE FROM public.permissoes_papel
  WHERE empresa_id = v_empresa_id AND papel = p_papel;

  FOREACH v_perm IN ARRAY p_permissoes LOOP
    INSERT INTO public.permissoes_papel (empresa_id, papel, permissao)
    VALUES (v_empresa_id, p_papel, v_perm)
    ON CONFLICT (empresa_id, papel, permissao) DO NOTHING;
  END LOOP;

  RETURN true;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. (Opcional) Semear os defaults explicitamente para uma empresa.
--    Não é obrigatório: sem linhas, o app já aplica a matriz default.
--    Útil se você quiser materializar a configuração para edição.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_permissoes_default(p_empresa_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- gestor
  INSERT INTO public.permissoes_papel (empresa_id, papel, permissao)
  SELECT p_empresa_id, 'gestor', unnest(ARRAY[
    'view_dashboard','view_clientes','edit_clientes','view_produtos','edit_produtos',
    'view_fornecedores','edit_fornecedores','view_orcamentos','edit_orcamentos','approve_orcamentos',
    'view_pedidos','edit_pedidos','view_nfe','view_financeiro','approve_contas_pagar','view_relatorios'
  ])
  ON CONFLICT DO NOTHING;

  -- financeiro
  INSERT INTO public.permissoes_papel (empresa_id, papel, permissao)
  SELECT p_empresa_id, 'financeiro', unnest(ARRAY[
    'view_dashboard','view_clientes','view_produtos','view_fornecedores','edit_fornecedores',
    'view_orcamentos','view_pedidos','view_nfe','view_financeiro','edit_financeiro',
    'approve_contas_pagar','view_relatorios'
  ])
  ON CONFLICT DO NOTHING;

  -- vendedor
  INSERT INTO public.permissoes_papel (empresa_id, papel, permissao)
  SELECT p_empresa_id, 'vendedor', unnest(ARRAY[
    'view_dashboard','view_clientes','edit_clientes','view_produtos','view_fornecedores',
    'view_orcamentos','edit_orcamentos','view_pedidos','edit_pedidos','view_nfe'
  ])
  ON CONFLICT DO NOTHING;
END;
$$;
