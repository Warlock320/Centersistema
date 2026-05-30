-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v9 — FUNDAÇÃO DO FINANCEIRO v2
-- Múltiplos CNPJs (unidades), categorias financeiras, forma de pagamento
-- Execute APÓS os scripts anteriores
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. UNIDADES (Empresas / CNPJs da mesma conta)
--    O tenant continua sendo public.empresas; cada conta pode ter vários CNPJs.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unidades (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  razao_social   TEXT NOT NULL,
  nome_fantasia  TEXT,
  cnpj           TEXT,
  endereco       TEXT,
  telefone       TEXT,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  padrao         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unidades_empresa ON public.unidades(empresa_id);

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY unidades_policy ON public.unidades
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 2. VÍNCULO DE UNIDADE nas tabelas financeiras
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.contas_receber   ADD COLUMN IF NOT EXISTS unidade_id      UUID REFERENCES public.unidades(id) ON DELETE SET NULL;
ALTER TABLE public.contas_pagar     ADD COLUMN IF NOT EXISTS unidade_id      UUID REFERENCES public.unidades(id) ON DELETE SET NULL;
ALTER TABLE public.contas_bancarias ADD COLUMN IF NOT EXISTS unidade_id      UUID REFERENCES public.unidades(id) ON DELETE SET NULL;

-- Forma de pagamento na conta a receber (venda)
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
-- valores esperados: pix, dinheiro, debito, credito_vista, credito_parcelado, boleto, transferencia, outro

-- ─────────────────────────────────────────────────────────────────────
-- 3. SEED: cria uma unidade padrão a partir dos dados do tenant
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.unidades (empresa_id, razao_social, nome_fantasia, cnpj, endereco, telefone, padrao)
SELECT e.id, COALESCE(e.razao_social, e.nome), e.nome, e.cnpj, e.endereco, e.telefone, true
FROM public.empresas e
WHERE NOT EXISTS (SELECT 1 FROM public.unidades u WHERE u.empresa_id = e.id);

-- Vincula lançamentos já existentes à unidade padrão
UPDATE public.contas_receber cr
SET unidade_id = (SELECT id FROM public.unidades u WHERE u.empresa_id = cr.empresa_id AND u.padrao LIMIT 1)
WHERE cr.unidade_id IS NULL;

UPDATE public.contas_pagar cp
SET unidade_id = (SELECT id FROM public.unidades u WHERE u.empresa_id = cp.empresa_id AND u.padrao LIMIT 1)
WHERE cp.unidade_id IS NULL;

UPDATE public.contas_bancarias cb
SET unidade_id = (SELECT id FROM public.unidades u WHERE u.empresa_id = cb.empresa_id AND u.padrao LIMIT 1)
WHERE cb.unidade_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 4. CATEGORIAS FINANCEIRAS — substitui pelas categorias do negócio
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_categorias_financeiras(p_empresa_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Limpa o plano de contas atual da empresa (FKs em contas_* são SET NULL)
  DELETE FROM public.plano_contas WHERE empresa_id = p_empresa_id;

  -- Receitas
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo) VALUES
    (p_empresa_id, 'R01', 'Venda de Scooter',   'receita'),
    (p_empresa_id, 'R02', 'Venda de Peças',     'receita'),
    (p_empresa_id, 'R03', 'Serviço Técnico',    'receita'),
    (p_empresa_id, 'R04', 'Frete',              'receita'),
    (p_empresa_id, 'R05', 'Outras Receitas',    'receita');

  -- Despesas
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo) VALUES
    (p_empresa_id, 'D01', 'Fornecedores',       'despesa'),
    (p_empresa_id, 'D02', 'Aluguel',            'despesa'),
    (p_empresa_id, 'D03', 'Energia',            'despesa'),
    (p_empresa_id, 'D04', 'Água',               'despesa'),
    (p_empresa_id, 'D05', 'Internet',           'despesa'),
    (p_empresa_id, 'D06', 'Impostos',           'despesa'),
    (p_empresa_id, 'D07', 'Marketing',          'despesa'),
    (p_empresa_id, 'D08', 'Salários',           'despesa'),
    (p_empresa_id, 'D09', 'Outras Despesas',    'despesa');
END;
$$;

-- Aplica nas empresas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_categorias_financeiras(r.id);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. setup_initial_account: usa as novas categorias + cria unidade padrão
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

  INSERT INTO public.tabelas_preco (empresa_id, nome, ajuste_percentual, padrao)
  VALUES (v_empresa_id, 'Varejo', 0, true);

  -- Unidade (CNPJ) padrão
  INSERT INTO public.unidades (empresa_id, razao_social, nome_fantasia, cnpj, telefone, padrao)
  VALUES (v_empresa_id, COALESCE(p_empresa_razao, p_empresa_nome), p_empresa_nome, p_empresa_cnpj, p_empresa_telefone, true);

  -- Conta caixa padrão
  INSERT INTO public.contas_bancarias (empresa_id, nome, tipo, saldo_inicial)
  VALUES (v_empresa_id, 'Caixa', 'caixa', 0);

  -- Categorias financeiras do negócio
  PERFORM public.seed_categorias_financeiras(v_empresa_id);

  RETURN v_empresa_id;
END;
$$;
