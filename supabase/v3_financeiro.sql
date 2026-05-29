-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v3 — MÓDULO FINANCEIRO COMPLETO
-- Execute APÓS os scripts anteriores (schema.sql, estoque.sql, functions.sql, melhorias.sql, v2_improvements.sql)
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. FORNECEDORES
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  razao_social  TEXT,
  cnpj_cpf      TEXT,
  tipo          VARCHAR(8) DEFAULT 'juridica' CHECK (tipo IN ('fisica','juridica')),
  email         TEXT,
  telefone      TEXT,
  endereco      TEXT,
  cidade        TEXT,
  estado        VARCHAR(2),
  cep           TEXT,
  banco         TEXT,
  agencia       TEXT,
  conta         TEXT,
  tipo_conta    VARCHAR(10) CHECK (tipo_conta IN ('corrente','poupanca','pagamento')),
  pix_chave     TEXT,
  pix_tipo      VARCHAR(15) CHECK (pix_tipo IN ('cpf','cnpj','email','telefone','aleatoria')),
  prazo_padrao  INT NOT NULL DEFAULT 30,
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. PLANO DE CONTAS (hierárquico)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plano_contas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo      TEXT NOT NULL,
  nome        TEXT NOT NULL,
  tipo        VARCHAR(10) NOT NULL CHECK (tipo IN ('receita','despesa')),
  pai_id      UUID REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. CENTROS DE CUSTO
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 4. CONTAS BANCÁRIAS
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  banco          TEXT,
  agencia        TEXT,
  conta          TEXT,
  tipo           VARCHAR(20) DEFAULT 'corrente' CHECK (tipo IN ('corrente','poupanca','caixa','investimento','outro')),
  saldo_inicial  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 5. CONTAS A RECEBER
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contas_receber (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id          UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  pedido_id           UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  plano_contas_id     UUID REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  centro_custo_id     UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  conta_bancaria_id   UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  descricao           TEXT NOT NULL,
  valor               NUMERIC(14,2) NOT NULL,
  data_emissao        DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento     DATE NOT NULL,
  data_pagamento      DATE,
  valor_pago          NUMERIC(14,2),
  juros               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  desconto            NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente','pago','cancelado')),
  numero_parcela      INT NOT NULL DEFAULT 1,
  total_parcelas      INT NOT NULL DEFAULT 1,
  grupo_parcelas      UUID,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 6. CONTAS A PAGAR
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fornecedor_id       UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  nfe_id              UUID REFERENCES public.nfe_importadas(id) ON DELETE SET NULL,
  plano_contas_id     UUID REFERENCES public.plano_contas(id) ON DELETE SET NULL,
  centro_custo_id     UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  conta_bancaria_id   UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  aprovado_por        UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  descricao           TEXT NOT NULL,
  valor               NUMERIC(14,2) NOT NULL,
  data_emissao        DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento     DATE NOT NULL,
  data_pagamento      DATE,
  valor_pago          NUMERIC(14,2),
  juros               NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  desconto            NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente','aprovado','pago','cancelado')),
  comprovante_url     TEXT,
  numero_parcela      INT NOT NULL DEFAULT 1,
  total_parcelas      INT NOT NULL DEFAULT 1,
  grupo_parcelas      UUID,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 7. HISTÓRICO DE COBRANÇAS (régua)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.historico_cobrancas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_receber_id    UUID NOT NULL REFERENCES public.contas_receber(id) ON DELETE CASCADE,
  usuario_id          UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('preventiva','vencimento','leve','medio','grave','renegociacao','outro')),
  canal               VARCHAR(20) CHECK (canal IN ('email','whatsapp','telefone','carta','sistema')),
  observacao          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 8. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.fornecedores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_contas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_custo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_bancarias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_receber       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_cobrancas  ENABLE ROW LEVEL SECURITY;

CREATE POLICY fornecedores_policy        ON public.fornecedores        USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY plano_contas_policy        ON public.plano_contas        USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY centros_custo_policy       ON public.centros_custo       USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY contas_bancarias_policy    ON public.contas_bancarias    USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY contas_receber_policy      ON public.contas_receber      USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY contas_pagar_policy        ON public.contas_pagar        USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY historico_cobrancas_policy ON public.historico_cobrancas USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 9. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_contas_receber_updated_at
  BEFORE UPDATE ON public.contas_receber
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_contas_pagar_updated_at
  BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 10. VIEWS
-- ─────────────────────────────────────────────────────────────────────

-- Saldo calculado por conta bancária
CREATE OR REPLACE VIEW public.v_saldo_bancario AS
  SELECT
    cb.*,
    cb.saldo_inicial
      + COALESCE(cr.total_recebido, 0)
      - COALESCE(cp.total_pago, 0)           AS saldo_atual
  FROM public.contas_bancarias cb
  LEFT JOIN (
    SELECT conta_bancaria_id, SUM(COALESCE(valor_pago, valor)) AS total_recebido
    FROM public.contas_receber
    WHERE status = 'pago' AND conta_bancaria_id IS NOT NULL
    GROUP BY conta_bancaria_id
  ) cr ON cr.conta_bancaria_id = cb.id
  LEFT JOIN (
    SELECT conta_bancaria_id, SUM(COALESCE(valor_pago, valor)) AS total_pago
    FROM public.contas_pagar
    WHERE status = 'pago' AND conta_bancaria_id IS NOT NULL
    GROUP BY conta_bancaria_id
  ) cp ON cp.conta_bancaria_id = cb.id;

-- Fluxo de caixa: entradas e saídas dia a dia
CREATE OR REPLACE VIEW public.v_fluxo_caixa AS
  SELECT
    empresa_id,
    data_vencimento                                                    AS data,
    'receber'                                                          AS tipo,
    SUM(CASE WHEN status = 'pago'     THEN COALESCE(valor_pago, valor) ELSE 0 END) AS realizado,
    SUM(CASE WHEN status = 'pendente' THEN valor                        ELSE 0 END) AS previsto
  FROM public.contas_receber
  GROUP BY empresa_id, data_vencimento
  UNION ALL
  SELECT
    empresa_id,
    data_vencimento,
    'pagar',
    SUM(CASE WHEN status = 'pago'     THEN COALESCE(valor_pago, valor) ELSE 0 END),
    SUM(CASE WHEN status IN ('pendente','aprovado') THEN valor          ELSE 0 END)
  FROM public.contas_pagar
  GROUP BY empresa_id, data_vencimento;

-- Contas vencidas (status pendente + vencimento no passado)
CREATE OR REPLACE VIEW public.v_contas_vencidas AS
  SELECT *, 'receber' AS origem,
         CURRENT_DATE - data_vencimento AS dias_atraso
  FROM public.contas_receber
  WHERE status = 'pendente' AND data_vencimento < CURRENT_DATE
  UNION ALL
  SELECT *, 'pagar',
         CURRENT_DATE - data_vencimento
  FROM public.contas_pagar
  WHERE status IN ('pendente','aprovado') AND data_vencimento < CURRENT_DATE;

-- ─────────────────────────────────────────────────────────────────────
-- 11. RPCs FINANCEIRAS
-- ─────────────────────────────────────────────────────────────────────

-- Dar baixa em conta a receber
CREATE OR REPLACE FUNCTION public.baixar_conta_receber(
  p_id              UUID,
  p_data_pagamento  DATE,
  p_valor_pago      NUMERIC,
  p_juros           NUMERIC DEFAULT 0,
  p_desconto        NUMERIC DEFAULT 0,
  p_conta_bancaria  UUID DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.contas_receber
  SET status             = 'pago',
      data_pagamento     = p_data_pagamento,
      valor_pago         = p_valor_pago,
      juros              = p_juros,
      desconto           = p_desconto,
      conta_bancaria_id  = COALESCE(p_conta_bancaria, conta_bancaria_id),
      updated_at         = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$;

-- Dar baixa em conta a pagar
CREATE OR REPLACE FUNCTION public.baixar_conta_pagar(
  p_id              UUID,
  p_data_pagamento  DATE,
  p_valor_pago      NUMERIC,
  p_juros           NUMERIC DEFAULT 0,
  p_desconto        NUMERIC DEFAULT 0,
  p_conta_bancaria  UUID DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.contas_pagar
  SET status             = 'pago',
      data_pagamento     = p_data_pagamento,
      valor_pago         = p_valor_pago,
      juros              = p_juros,
      desconto           = p_desconto,
      conta_bancaria_id  = COALESCE(p_conta_bancaria, conta_bancaria_id),
      updated_at         = now()
  WHERE id = p_id;
  RETURN FOUND;
END;
$$;

-- Aprovar conta a pagar
CREATE OR REPLACE FUNCTION public.aprovar_conta_pagar(p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.contas_pagar
  SET status       = 'aprovado',
      aprovado_por = auth.uid(),
      updated_at   = now()
  WHERE id = p_id AND status = 'pendente';
  RETURN FOUND;
END;
$$;

-- Dashboard KPIs financeiros
CREATE OR REPLACE FUNCTION public.get_kpis_financeiros(p_empresa_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_receber_mes   NUMERIC;
  v_pagar_mes     NUMERIC;
  v_recebido_mes  NUMERIC;
  v_pago_mes      NUMERIC;
  v_vencidos_rec  NUMERIC;
  v_vencidos_pag  NUMERIC;
  v_saldo_total   NUMERIC;
BEGIN
  -- A receber no mês atual (pendentes)
  SELECT COALESCE(SUM(valor), 0) INTO v_receber_mes
  FROM public.contas_receber
  WHERE empresa_id = p_empresa_id AND status = 'pendente'
    AND DATE_TRUNC('month', data_vencimento) = DATE_TRUNC('month', CURRENT_DATE);

  -- A pagar no mês atual (pendentes + aprovadas)
  SELECT COALESCE(SUM(valor), 0) INTO v_pagar_mes
  FROM public.contas_pagar
  WHERE empresa_id = p_empresa_id AND status IN ('pendente','aprovado')
    AND DATE_TRUNC('month', data_vencimento) = DATE_TRUNC('month', CURRENT_DATE);

  -- Recebido no mês
  SELECT COALESCE(SUM(COALESCE(valor_pago, valor)), 0) INTO v_recebido_mes
  FROM public.contas_receber
  WHERE empresa_id = p_empresa_id AND status = 'pago'
    AND DATE_TRUNC('month', data_pagamento) = DATE_TRUNC('month', CURRENT_DATE);

  -- Pago no mês
  SELECT COALESCE(SUM(COALESCE(valor_pago, valor)), 0) INTO v_pago_mes
  FROM public.contas_pagar
  WHERE empresa_id = p_empresa_id AND status = 'pago'
    AND DATE_TRUNC('month', data_pagamento) = DATE_TRUNC('month', CURRENT_DATE);

  -- Vencidos a receber
  SELECT COALESCE(SUM(valor), 0) INTO v_vencidos_rec
  FROM public.contas_receber
  WHERE empresa_id = p_empresa_id AND status = 'pendente' AND data_vencimento < CURRENT_DATE;

  -- Vencidos a pagar
  SELECT COALESCE(SUM(valor), 0) INTO v_vencidos_pag
  FROM public.contas_pagar
  WHERE empresa_id = p_empresa_id AND status IN ('pendente','aprovado') AND data_vencimento < CURRENT_DATE;

  -- Saldo total em caixa
  SELECT COALESCE(SUM(saldo_atual), 0) INTO v_saldo_total
  FROM public.v_saldo_bancario
  WHERE empresa_id = p_empresa_id AND ativo = true;

  RETURN json_build_object(
    'receber_mes',  v_receber_mes,
    'pagar_mes',    v_pagar_mes,
    'recebido_mes', v_recebido_mes,
    'pago_mes',     v_pago_mes,
    'vencidos_rec', v_vencidos_rec,
    'vencidos_pag', v_vencidos_pag,
    'saldo_total',  v_saldo_total
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 12. ATUALIZA faturar_pedido PARA CRIAR CONTA A RECEBER
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.faturar_pedido(p_pedido_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pedido        RECORD;
  v_item          RECORD;
  v_plano_id      UUID;
  v_conta_rec_id  UUID;
  v_vencimento    DATE;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id; END IF;
  IF v_pedido.status = 'faturado' THEN RETURN NULL; END IF;

  -- Atualiza pedido
  UPDATE public.pedidos SET status = 'faturado', updated_at = now() WHERE id = p_pedido_id;

  -- Baixa de estoque
  FOR v_item IN
    SELECT pi.*, p.custo FROM public.pedido_itens pi
    LEFT JOIN public.produtos p ON p.id = pi.produto_id
    WHERE pi.pedido_id = p_pedido_id AND pi.produto_id IS NOT NULL
  LOOP
    INSERT INTO public.movimentacoes_estoque
      (empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, observacao)
    VALUES
      (v_pedido.empresa_id, v_item.produto_id, 'saida', v_item.quantidade,
       COALESCE(v_item.custo, 0), 'pedido', p_pedido_id,
       'Pedido #' || v_pedido.numero || ' faturado');
  END LOOP;

  -- Avança orçamento vinculado
  IF v_pedido.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos SET status = 'enviado', updated_at = now()
    WHERE id = v_pedido.orcamento_id AND status IN ('aprovado','aguardando_pecas');
  END IF;

  -- Cria conta a receber
  SELECT id INTO v_plano_id FROM public.plano_contas
  WHERE empresa_id = v_pedido.empresa_id AND codigo = '1.1' AND ativo = true LIMIT 1;

  v_vencimento := CURRENT_DATE + INTERVAL '30 days';

  INSERT INTO public.contas_receber
    (empresa_id, cliente_id, pedido_id, plano_contas_id, descricao, valor, data_vencimento)
  VALUES
    (v_pedido.empresa_id, v_pedido.cliente_id, p_pedido_id, v_plano_id,
     'Pedido #' || v_pedido.numero, v_pedido.total, v_vencimento)
  RETURNING id INTO v_conta_rec_id;

  RETURN v_conta_rec_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 13. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa    ON public.contas_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status     ON public.contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_vencimento ON public.contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente    ON public.contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa      ON public.contas_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status       ON public.contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento   ON public.contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa      ON public.fornecedores(empresa_id);

-- ─────────────────────────────────────────────────────────────────────
-- 14. PLANO DE CONTAS PADRÃO — seeded pelo setup_initial_account
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_plano_contas(p_empresa_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r1 UUID; r2 UUID; r21 UUID; r22 UUID; r23 UUID;
BEGIN
  -- RECEITAS
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo) VALUES (p_empresa_id,'1','Receitas','receita') RETURNING id INTO r1;
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'1.1','Venda de Produtos','receita',r1);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'1.2','Prestação de Serviços','receita',r1);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'1.3','Outros Rendimentos','receita',r1);

  -- DESPESAS
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo) VALUES (p_empresa_id,'2','Despesas','despesa') RETURNING id INTO r2;

  -- Despesas Fixas
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.1','Despesas Fixas','despesa',r2) RETURNING id INTO r21;
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.1.1','Aluguel','despesa',r21);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.1.2','Folha de Pagamento','despesa',r21);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.1.3','Contabilidade','despesa',r21);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.1.4','Internet / Telefone','despesa',r21);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.1.5','Seguros','despesa',r21);

  -- Despesas Variáveis
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.2','Despesas Variáveis','despesa',r2) RETURNING id INTO r22;
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.2.1','Impostos e Taxas','despesa',r22);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.2.2','Comissões de Vendas','despesa',r22);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.2.3','Compra de Mercadorias','despesa',r22);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.2.4','Manutenção e Reparos','despesa',r22);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.2.5','Marketing e Publicidade','despesa',r22);

  -- Despesas Financeiras
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.3','Despesas Financeiras','despesa',r2) RETURNING id INTO r23;
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.3.1','Juros e Multas','despesa',r23);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.3.2','Tarifas Bancárias','despesa',r23);
  INSERT INTO public.plano_contas (empresa_id, codigo, nome, tipo, pai_id) VALUES (p_empresa_id,'2.3.3','IOF e Tributos Financeiros','despesa',r23);

  -- Centro de custo padrão
  INSERT INTO public.centros_custo (empresa_id, nome, descricao)
  VALUES (p_empresa_id,'Geral','Centro de custo padrão'),
         (p_empresa_id,'Comercial','Vendas e atendimento'),
         (p_empresa_id,'Administrativo','Gestão e back-office'),
         (p_empresa_id,'Estoque','Compras e movimentação de peças');
END;
$$;

-- Atualiza setup_initial_account para seeder o plano de contas
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

  INSERT INTO public.usuarios (id, empresa_id, nome, email, role)
  VALUES (auth.uid(), v_empresa_id, p_usuario_nome, p_usuario_email, 'admin');

  -- Cria conta caixa padrão
  INSERT INTO public.contas_bancarias (empresa_id, nome, tipo, saldo_inicial)
  VALUES (v_empresa_id, 'Caixa', 'caixa', 0);

  -- Seed plano de contas e centros de custo
  PERFORM public.seed_plano_contas(v_empresa_id);

  RETURN v_empresa_id;
END;
$$;
