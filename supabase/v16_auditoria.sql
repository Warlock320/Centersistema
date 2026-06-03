-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v16 — AUDITORIA GLOBAL + CORREÇÕES DE FLUXO
-- Execute APÓS os scripts anteriores (idempotente).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 0. CORREÇÕES DE FLUXO (revisão sênior)
--    a) Views de saldo/fluxo passam a considerar 'pago_parcial' (recebimentos parciais).
--    b) security_invoker = true → as views respeitam a RLS por empresa (isolamento multi-tenant).
-- ─────────────────────────────────────────────────────────────────────
-- DROP + CREATE (não dá CREATE OR REPLACE: a ordem das colunas de cb.* mudou após novos ALTERs)
DROP VIEW IF EXISTS public.v_saldo_bancario;
CREATE VIEW public.v_saldo_bancario
WITH (security_invoker = true) AS
  SELECT
    cb.*,
    cb.saldo_inicial
      + COALESCE(cr.total_recebido, 0)
      - COALESCE(cp.total_pago, 0)           AS saldo_atual
  FROM public.contas_bancarias cb
  LEFT JOIN (
    SELECT conta_bancaria_id,
           SUM(CASE WHEN status = 'pago'         THEN COALESCE(valor_pago, valor)
                    WHEN status = 'pago_parcial'  THEN COALESCE(valor_pago, 0)
                    ELSE 0 END) AS total_recebido
    FROM public.contas_receber
    WHERE status IN ('pago','pago_parcial') AND conta_bancaria_id IS NOT NULL
    GROUP BY conta_bancaria_id
  ) cr ON cr.conta_bancaria_id = cb.id
  LEFT JOIN (
    SELECT conta_bancaria_id, SUM(COALESCE(valor_pago, valor)) AS total_pago
    FROM public.contas_pagar
    WHERE status = 'pago' AND conta_bancaria_id IS NOT NULL
    GROUP BY conta_bancaria_id
  ) cp ON cp.conta_bancaria_id = cb.id;

DROP VIEW IF EXISTS public.v_fluxo_caixa;
CREATE VIEW public.v_fluxo_caixa
WITH (security_invoker = true) AS
  SELECT
    empresa_id,
    data_vencimento AS data,
    'receber' AS tipo,
    SUM(CASE WHEN status = 'pago'         THEN COALESCE(valor_pago, valor)
             WHEN status = 'pago_parcial'  THEN COALESCE(valor_pago, 0)
             ELSE 0 END) AS realizado,
    SUM(CASE WHEN status = 'pendente'      THEN valor
             WHEN status = 'pago_parcial'  THEN (valor - COALESCE(valor_pago, 0))
             ELSE 0 END) AS previsto
  FROM public.contas_receber
  GROUP BY empresa_id, data_vencimento
  UNION ALL
  SELECT
    empresa_id,
    data_vencimento,
    'pagar',
    SUM(CASE WHEN status = 'pago' THEN COALESCE(valor_pago, valor) ELSE 0 END),
    SUM(CASE WHEN status IN ('pendente','aprovado') THEN valor ELSE 0 END)
  FROM public.contas_pagar
  GROUP BY empresa_id, data_vencimento;

-- ─────────────────────────────────────────────────────────────────────
-- 1. TABELA DE AUDITORIA (imutável — sem UPDATE/DELETE por ninguém)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id   UUID,
  tabela       TEXT NOT NULL,
  registro_id  TEXT,
  operacao     TEXT NOT NULL CHECK (operacao IN ('INSERT','UPDATE','DELETE')),
  usuario_id   UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  campos       TEXT[],
  dados_antes  JSONB,
  dados_depois JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_empresa_data ON public.audit_log(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabela       ON public.audit_log(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_usuario      ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_registro     ON public.audit_log(registro_id);

-- ─────────────────────────────────────────────────────────────────────
-- 2. HELPER: usuário logado é admin?
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid() AND 'admin' = ANY(u.roles)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. FUNÇÃO DE TRIGGER GENÉRICA — captura INSERT/UPDATE/DELETE com diff
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old   JSONB;
  v_new   JSONB;
  v_emp   UUID;
  v_reg   TEXT;
  v_campos TEXT[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- campos efetivamente alterados (ignora updated_at)
    SELECT array_agg(n.key) INTO v_campos
    FROM jsonb_each(v_new) n
    WHERE n.value IS DISTINCT FROM (v_old -> n.key) AND n.key <> 'updated_at';
    IF v_campos IS NULL THEN
      RETURN NULL;  -- nada relevante mudou
    END IF;
  END IF;

  -- empresa_id (para a tabela empresas, usa o próprio id)
  v_emp := COALESCE(
    (COALESCE(v_new, v_old) ->> 'empresa_id')::UUID,
    CASE WHEN TG_TABLE_NAME = 'empresas' THEN (COALESCE(v_new, v_old) ->> 'id')::UUID END
  );
  v_reg := COALESCE(v_new, v_old) ->> 'id';

  INSERT INTO public.audit_log
    (empresa_id, tabela, registro_id, operacao, usuario_id, campos, dados_antes, dados_depois)
  VALUES
    (v_emp, TG_TABLE_NAME, v_reg, TG_OP, auth.uid(), v_campos, v_old, v_new);

  RETURN NULL;  -- AFTER trigger: retorno ignorado
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. ANEXA O TRIGGER ÀS TABELAS DE NEGÓCIO (só nas que existem)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  alvos TEXT[] := ARRAY[
    'clientes','produtos','fornecedores','veiculos','categorias','tabelas_preco','precos_produto',
    'contas_receber','contas_pagar','contas_bancarias','plano_contas','centros_custo',
    'caixas','movimentos_caixa','reaberturas_caixa','aprovacoes_credito',
    'orcamentos','orcamento_itens','pedidos','pedido_itens','ordens_servico','os_itens',
    'movimentacoes_estoque','nfe_importadas','historico_cobrancas',
    'usuarios','permissoes_papel','empresas','unidades','convites'
  ];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit()', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RLS — somente ADMIN lê (e ninguém edita/apaga: log imutável)
--    Os INSERTs vêm da fn_audit (SECURITY DEFINER), que ignora a RLS.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin ON public.audit_log
  FOR SELECT USING (empresa_id = get_empresa_id() AND public.is_admin());
