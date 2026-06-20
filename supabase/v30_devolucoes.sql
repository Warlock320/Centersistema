-- v30 — DEVOLUÇÕES E TROCAS: registro de devoluções com itens
-- Idempotente. Execute APÓS v29.

-- =====================================================================
-- 1. Tabela de devoluções
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.devolucoes (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_id    UUID          NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  cliente_id   UUID          NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo         TEXT          NOT NULL CHECK (tipo IN ('devolucao','troca')),
  motivo       TEXT          NOT NULL,
  valor_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT          NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente','aprovada','concluida','cancelada')),
  aprovado_por UUID          REFERENCES public.usuarios(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devolucoes_empresa_idx
  ON public.devolucoes (empresa_id);

CREATE INDEX IF NOT EXISTS devolucoes_pedido_idx
  ON public.devolucoes (pedido_id);

CREATE INDEX IF NOT EXISTS devolucoes_cliente_idx
  ON public.devolucoes (cliente_id);

ALTER TABLE public.devolucoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devolucoes_policy ON public.devolucoes;
CREATE POLICY devolucoes_policy ON public.devolucoes
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- =====================================================================
-- 2. Itens da devolução
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.devolucao_itens (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id    UUID          NOT NULL REFERENCES public.devolucoes(id) ON DELETE CASCADE,
  produto_id      UUID          REFERENCES public.produtos(id),
  descricao       TEXT          NOT NULL,
  quantidade      NUMERIC(12,3) NOT NULL,
  valor_unitario  NUMERIC(12,2) NOT NULL,
  total           NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS devolucao_itens_devolucao_idx
  ON public.devolucao_itens (devolucao_id);

ALTER TABLE public.devolucao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devolucao_itens_policy ON public.devolucao_itens;
CREATE POLICY devolucao_itens_policy ON public.devolucao_itens
  USING (
    EXISTS (
      SELECT 1 FROM public.devolucoes d
      WHERE d.id = devolucao_itens.devolucao_id AND d.empresa_id = get_empresa_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devolucoes d
      WHERE d.id = devolucao_itens.devolucao_id AND d.empresa_id = get_empresa_id()
    )
  );
