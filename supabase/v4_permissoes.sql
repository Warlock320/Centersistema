-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v4 — PAPÉIS MÚLTIPLOS (roles[])
-- Execute APÓS os scripts anteriores
-- Papéis: admin, gestor, financeiro, vendedor (aprovador legado → gestor)
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. USUÁRIOS: coluna roles TEXT[] (múltiplos papéis)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['vendedor'];

-- Migra o role único legado para o array (aprovador → gestor)
UPDATE public.usuarios
SET roles = ARRAY[CASE WHEN role = 'aprovador' THEN 'gestor' ELSE role END]
WHERE role IS NOT NULL
  AND (roles IS NULL OR roles = ARRAY['vendedor']::TEXT[])
  AND role <> 'vendedor';

-- Garante que cada role do array é válido
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_roles_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_roles_check
  CHECK (roles <@ ARRAY['admin','gestor','financeiro','vendedor']::TEXT[] AND array_length(roles, 1) >= 1);

-- ─────────────────────────────────────────────────────────────────────
-- 2. CONVITES: coluna roles TEXT[]
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.convites
  ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['vendedor'];

UPDATE public.convites
SET roles = ARRAY[CASE WHEN role = 'aprovador' THEN 'gestor' ELSE role END]
WHERE role IS NOT NULL
  AND (roles IS NULL OR roles = ARRAY['vendedor']::TEXT[])
  AND role <> 'vendedor';

-- ─────────────────────────────────────────────────────────────────────
-- 3. get_user_role → get_user_roles (retorna array)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN (SELECT roles FROM public.usuarios WHERE id = auth.uid());
END;
$$;

-- Helper: usuário atual tem o papel?
CREATE OR REPLACE FUNCTION public.user_has_role(p_role TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN p_role = ANY (SELECT unnest(roles) FROM public.usuarios WHERE id = auth.uid());
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. setup_initial_account — cria admin com roles=['admin']
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.setup_initial_account(
  p_empresa_nome       TEXT,
  p_empresa_razao      TEXT,
  p_empresa_cnpj       TEXT,
  p_empresa_email      TEXT,
  p_empresa_telefone   TEXT,
  p_empresa_cidade     TEXT,
  p_empresa_estado     TEXT,
  p_usuario_nome       TEXT,
  p_usuario_email      TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()) THEN
    RETURN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid());
  END IF;

  INSERT INTO public.empresas (nome, razao_social, cnpj, email, telefone, cidade, estado)
  VALUES (p_empresa_nome, p_empresa_razao, p_empresa_cnpj, p_empresa_email, p_empresa_telefone, p_empresa_cidade, p_empresa_estado)
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.usuarios (id, empresa_id, nome, email, role, roles)
  VALUES (auth.uid(), v_empresa_id, p_usuario_nome, p_usuario_email, 'admin', ARRAY['admin']);

  INSERT INTO public.contas_bancarias (empresa_id, nome, tipo, saldo_inicial)
  VALUES (v_empresa_id, 'Caixa', 'caixa', 0);

  PERFORM public.seed_plano_contas(v_empresa_id);

  RETURN v_empresa_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. aceitar_convite — aplica roles do convite
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aceitar_convite(p_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_convite RECORD;
  v_roles   TEXT[];
BEGIN
  SELECT * INTO v_convite FROM public.convites
  WHERE token = p_token AND usado = false;

  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()) THEN RETURN false; END IF;

  v_roles := COALESCE(v_convite.roles, ARRAY['vendedor']);

  INSERT INTO public.usuarios (id, empresa_id, nome, email, role, roles)
  VALUES (auth.uid(), v_convite.empresa_id, split_part(v_convite.email,'@',1),
          v_convite.email, v_roles[1], v_roles);

  UPDATE public.convites SET usado = true WHERE id = v_convite.id;
  RETURN true;
END;
$$;
