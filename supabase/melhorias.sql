-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO - MELHORIAS: SETUP, ALERTAS E CONVITES
-- =====================================================================

-- RPC: Provisionamento inicial (SECURITY DEFINER = bypass RLS)
-- Chamado pela API Route /api/setup no primeiro acesso
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
  -- Verifica se o usuário já tem conta
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()) THEN
    RETURN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid());
  END IF;

  INSERT INTO public.empresas (nome, razao_social, cnpj, email, telefone, cidade, estado)
  VALUES (p_empresa_nome, p_empresa_razao, p_empresa_cnpj, p_empresa_email, p_empresa_telefone, p_empresa_cidade, p_empresa_estado)
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.usuarios (id, empresa_id, nome, email, role)
  VALUES (auth.uid(), v_empresa_id, p_usuario_nome, p_usuario_email, 'admin');

  RETURN v_empresa_id;
END;
$$;

-- RPC: Aceitar convite (novo usuário usa token de convite)
CREATE OR REPLACE FUNCTION public.aceitar_convite(p_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_convite RECORD;
BEGIN
  SELECT * INTO v_convite FROM public.convites
  WHERE token = p_token AND usado = false;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Verifica se o usuário já tem perfil
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid()) THEN
    RETURN false;
  END IF;

  INSERT INTO public.usuarios (id, empresa_id, nome, email, role)
  VALUES (auth.uid(), v_convite.empresa_id, split_part(v_convite.email,'@',1), v_convite.email, v_convite.role);

  UPDATE public.convites SET usado = true WHERE id = v_convite.id;

  RETURN true;
END;
$$;

-- View: relatório de faturamento por mês
CREATE OR REPLACE VIEW public.v_faturamento_mensal AS
  SELECT
    empresa_id,
    DATE_TRUNC('month', created_at) AS mes,
    COUNT(*)                        AS quantidade,
    SUM(total)                      AS total
  FROM public.pedidos
  WHERE status = 'faturado'
  GROUP BY empresa_id, DATE_TRUNC('month', created_at);

-- View: clientes com LTV (lifetime value)
CREATE OR REPLACE VIEW public.v_clientes_ltv AS
  SELECT
    c.id,
    c.empresa_id,
    c.nome,
    c.cpf_cnpj,
    c.email,
    c.telefone,
    COALESCE(SUM(p.total), 0) AS ltv
  FROM public.clientes c
  LEFT JOIN public.pedidos p ON p.cliente_id = c.id AND p.status = 'faturado'
  GROUP BY c.id, c.empresa_id, c.nome, c.cpf_cnpj, c.email, c.telefone;
