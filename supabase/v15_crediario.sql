-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v15 — CREDIÁRIO (limite, status, score, recebimento unificado)
-- Execute APÓS os scripts anteriores (idempotente).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. CLIENTES — dados de crédito
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS rg              TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS celular         TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS limite_credito  NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS status_credito  VARCHAR(12) NOT NULL DEFAULT 'ativo';
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_status_credito_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_status_credito_check
  CHECK (status_credito IN ('ativo','bloqueado','inadimplente','em_analise'));

-- ─────────────────────────────────────────────────────────────────────
-- 2. CONTAS A RECEBER — status pago_parcial
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.contas_receber DROP CONSTRAINT IF EXISTS contas_receber_status_check;
ALTER TABLE public.contas_receber ADD CONSTRAINT contas_receber_status_check
  CHECK (status IN ('pendente','pago_parcial','pago','cancelado'));

-- ─────────────────────────────────────────────────────────────────────
-- 3. EMPRESAS — parâmetro de inadimplência (dias)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS dias_inadimplencia INT NOT NULL DEFAULT 30;

-- ─────────────────────────────────────────────────────────────────────
-- 4. APROVAÇÕES DE CRÉDITO — auditoria de liberações (acima do limite / inadimplente)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aprovacoes_credito (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id   UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo         VARCHAR(16) NOT NULL CHECK (tipo IN ('acima_limite','inadimplente')),
  valor        NUMERIC(14,2) NOT NULL DEFAULT 0,
  aprovado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  motivo       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aprov_credito_cliente ON public.aprovacoes_credito(cliente_id);

ALTER TABLE public.aprovacoes_credito ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aprovacoes_credito_policy ON public.aprovacoes_credito;
CREATE POLICY aprovacoes_credito_policy ON public.aprovacoes_credito
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 5. VIEW: parcelas em aberto por cliente (com dias de atraso + faixa de aging)
--    security_invoker = aplica a RLS das tabelas base (isolamento por empresa)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_parcelas_cliente
WITH (security_invoker = true) AS
  SELECT
    cr.id, cr.empresa_id, cr.cliente_id, cl.nome AS cliente_nome,
    cl.telefone, cl.celular, cl.cpf_cnpj,
    cr.descricao, cr.valor,
    COALESCE(cr.valor_pago, 0) AS valor_pago,
    (cr.valor - COALESCE(cr.valor_pago, 0)) AS saldo,
    cr.data_vencimento, cr.status,
    cr.numero_parcela, cr.total_parcelas, cr.unidade_id,
    GREATEST(0, (CURRENT_DATE - cr.data_vencimento)) AS dias_atraso,
    CASE
      WHEN cr.data_vencimento >= CURRENT_DATE THEN 'a_vencer'
      WHEN (CURRENT_DATE - cr.data_vencimento) BETWEEN 1 AND 30  THEN '1_30'
      WHEN (CURRENT_DATE - cr.data_vencimento) BETWEEN 31 AND 60 THEN '31_60'
      WHEN (CURRENT_DATE - cr.data_vencimento) BETWEEN 61 AND 90 THEN '61_90'
      ELSE '90_mais'
    END AS faixa_atraso
  FROM public.contas_receber cr
  JOIN public.clientes cl ON cl.id = cr.cliente_id
  WHERE cr.status IN ('pendente', 'pago_parcial');

-- ─────────────────────────────────────────────────────────────────────
-- 6. VIEW: resumo de crédito 360 por cliente (limite, utilizado, status efetivo, score)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_credito_cliente
WITH (security_invoker = true) AS
  WITH abertos AS (
    SELECT cliente_id,
           SUM(valor - COALESCE(valor_pago,0)) AS utilizado,
           COUNT(*) AS parcelas_abertas
    FROM public.contas_receber
    WHERE status IN ('pendente','pago_parcial')
    GROUP BY cliente_id
  ),
  vencidos AS (
    SELECT cr.cliente_id,
           COUNT(*) AS parcelas_vencidas,
           SUM(cr.valor - COALESCE(cr.valor_pago,0)) AS valor_vencido,
           MAX(CURRENT_DATE - cr.data_vencimento) AS dias_atraso_max
    FROM public.contas_receber cr
    WHERE cr.status IN ('pendente','pago_parcial') AND cr.data_vencimento < CURRENT_DATE
    GROUP BY cr.cliente_id
  ),
  historico AS (
    SELECT cliente_id,
           SUM(valor) AS total_comprado,
           MAX(data_emissao) AS ultima_compra,
           MAX(data_pagamento) FILTER (WHERE status IN ('pago','pago_parcial')) AS ultimo_pagamento
    FROM public.contas_receber
    GROUP BY cliente_id
  ),
  liberacoes AS (
    SELECT cliente_id, COUNT(*) AS qtd_liberacoes
    FROM public.aprovacoes_credito
    GROUP BY cliente_id
  )
  SELECT
    cl.id AS cliente_id, cl.empresa_id, cl.nome, cl.telefone, cl.celular, cl.cpf_cnpj,
    cl.limite_credito,
    COALESCE(ab.utilizado, 0) AS limite_utilizado,
    (cl.limite_credito - COALESCE(ab.utilizado, 0)) AS limite_disponivel,
    CASE WHEN cl.limite_credito > 0
         THEN ROUND(COALESCE(ab.utilizado,0) / cl.limite_credito * 100, 1)
         ELSE 0 END AS pct_utilizado,
    cl.status_credito,
    CASE
      WHEN cl.status_credito = 'bloqueado' THEN 'bloqueado'
      WHEN COALESCE(vc.dias_atraso_max,0) > e.dias_inadimplencia THEN 'inadimplente'
      WHEN COALESCE(vc.parcelas_vencidas,0) > 0 THEN 'atraso'
      ELSE cl.status_credito
    END AS status_efetivo,
    COALESCE(ab.parcelas_abertas, 0) AS parcelas_abertas,
    COALESCE(vc.parcelas_vencidas, 0) AS parcelas_vencidas,
    COALESCE(vc.valor_vencido, 0) AS valor_vencido,
    COALESCE(vc.dias_atraso_max, 0) AS dias_atraso_max,
    COALESCE(h.total_comprado, 0) AS total_comprado,
    h.ultima_compra, h.ultimo_pagamento,
    -- Score: parte de 100, penaliza atraso e liberações, premia volume
    GREATEST(0, LEAST(100,
      60
      + LEAST(20, COALESCE(h.total_comprado,0) / 1000)::INT     -- volume
      - (COALESCE(vc.parcelas_vencidas,0) * 12)                  -- atraso atual
      - (COALESCE(lb.qtd_liberacoes,0) * 8)                      -- liberações acima do limite
      - (GREATEST(0, COALESCE(vc.dias_atraso_max,0)) / 5)        -- profundidade do atraso
    ))::INT AS score_pontos,
    CASE
      WHEN cl.status_credito = 'bloqueado' THEN 1
      WHEN GREATEST(0, LEAST(100,
        60 + LEAST(20, COALESCE(h.total_comprado,0)/1000)::INT
        - (COALESCE(vc.parcelas_vencidas,0)*12) - (COALESCE(lb.qtd_liberacoes,0)*8)
        - (GREATEST(0, COALESCE(vc.dias_atraso_max,0))/5))) >= 85 THEN 5
      WHEN GREATEST(0, LEAST(100,
        60 + LEAST(20, COALESCE(h.total_comprado,0)/1000)::INT
        - (COALESCE(vc.parcelas_vencidas,0)*12) - (COALESCE(lb.qtd_liberacoes,0)*8)
        - (GREATEST(0, COALESCE(vc.dias_atraso_max,0))/5))) >= 65 THEN 4
      WHEN GREATEST(0, LEAST(100,
        60 + LEAST(20, COALESCE(h.total_comprado,0)/1000)::INT
        - (COALESCE(vc.parcelas_vencidas,0)*12) - (COALESCE(lb.qtd_liberacoes,0)*8)
        - (GREATEST(0, COALESCE(vc.dias_atraso_max,0))/5))) >= 45 THEN 3
      WHEN GREATEST(0, LEAST(100,
        60 + LEAST(20, COALESCE(h.total_comprado,0)/1000)::INT
        - (COALESCE(vc.parcelas_vencidas,0)*12) - (COALESCE(lb.qtd_liberacoes,0)*8)
        - (GREATEST(0, COALESCE(vc.dias_atraso_max,0))/5))) >= 25 THEN 2
      ELSE 1
    END AS score_estrelas
  FROM public.clientes cl
  JOIN public.empresas e ON e.id = cl.empresa_id
  LEFT JOIN abertos    ab ON ab.cliente_id = cl.id
  LEFT JOIN vencidos   vc ON vc.cliente_id = cl.id
  LEFT JOIN historico  h  ON h.cliente_id  = cl.id
  LEFT JOIN liberacoes lb ON lb.cliente_id = cl.id;

-- ─────────────────────────────────────────────────────────────────────
-- 7. RPC: receber parcela (MOTOR ÚNICO — Caixa e Contas a Receber)
--    Suporta pagamento PARCIAL. Se p_caixa_id vier, também lança o
--    recebimento como entrada no caixa (dinheiro na gaveta).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.receber_parcela(
  p_conta_id       UUID,
  p_valor          NUMERIC,
  p_forma          TEXT DEFAULT 'dinheiro',
  p_data           DATE DEFAULT CURRENT_DATE,
  p_caixa_id       UUID DEFAULT NULL,
  p_conta_bancaria UUID DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa    UUID := get_empresa_id();
  v_conta      public.contas_receber%ROWTYPE;
  v_pago_total NUMERIC;
  v_novo       TEXT;
  v_caixa_st   TEXT;
BEGIN
  SELECT * INTO v_conta FROM public.contas_receber WHERE id = p_conta_id AND empresa_id = v_empresa;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta a receber não encontrada.'; END IF;
  IF v_conta.status NOT IN ('pendente','pago_parcial') THEN RAISE EXCEPTION 'Esta parcela não está em aberto.'; END IF;
  IF COALESCE(p_valor,0) <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero.'; END IF;

  v_pago_total := COALESCE(v_conta.valor_pago,0) + p_valor;
  IF v_pago_total > v_conta.valor + 0.005 THEN
    RAISE EXCEPTION 'Valor recebido (%) maior que o saldo da parcela (%).', p_valor, (v_conta.valor - COALESCE(v_conta.valor_pago,0));
  END IF;
  v_novo := CASE WHEN v_pago_total >= v_conta.valor THEN 'pago' ELSE 'pago_parcial' END;

  UPDATE public.contas_receber
  SET valor_pago        = v_pago_total,
      status            = v_novo,
      data_pagamento    = CASE WHEN v_novo = 'pago' THEN p_data ELSE data_pagamento END,
      conta_bancaria_id = COALESCE(p_conta_bancaria, conta_bancaria_id),
      updated_at        = now()
  WHERE id = p_conta_id;

  -- Recebido pelo caixa → registra o dinheiro entrando na gaveta
  IF p_caixa_id IS NOT NULL THEN
    SELECT status INTO v_caixa_st FROM public.caixas WHERE id = p_caixa_id AND empresa_id = v_empresa;
    IF v_caixa_st IS NULL THEN RAISE EXCEPTION 'Caixa não encontrado.'; END IF;
    IF v_caixa_st <> 'aberto' THEN RAISE EXCEPTION 'O caixa não está aberto para receber.'; END IF;
    INSERT INTO public.movimentos_caixa
      (empresa_id, caixa_id, tipo, categoria, forma_pagamento, valor, descricao, cliente_id, usuario_id)
    VALUES
      (v_empresa, p_caixa_id, 'entrada', 'recebimento', p_forma, p_valor,
       'Recebimento crediário: ' || v_conta.descricao, v_conta.cliente_id, auth.uid());
  END IF;

  RETURN json_build_object(
    'status', v_novo,
    'pago_total', v_pago_total,
    'saldo', GREATEST(v_conta.valor - v_pago_total, 0)
  );
END;
$$;
