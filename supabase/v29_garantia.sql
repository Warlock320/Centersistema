-- v29 — CONTROLE DE GARANTIA: prazo em itens de pedido + tabela de garantias
-- Idempotente. Execute APÓS v28.

-- =====================================================================
-- 1. Coluna de garantia nos itens do pedido
-- =====================================================================
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS garantia_dias INT DEFAULT 90;

-- =====================================================================
-- 2. Tabela de garantias
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.garantias (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_id           UUID          NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  pedido_item_id      UUID          REFERENCES public.pedido_itens(id) ON DELETE SET NULL,
  cliente_id          UUID          NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  produto_descricao   TEXT          NOT NULL,
  data_venda          DATE          NOT NULL,
  data_expiracao      DATE          NOT NULL,
  status              TEXT          NOT NULL DEFAULT 'ativa'
                      CHECK (status IN ('ativa','expirada','acionada','cancelada')),
  motivo_acionamento  TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS garantias_empresa_idx
  ON public.garantias (empresa_id);

CREATE INDEX IF NOT EXISTS garantias_cliente_idx
  ON public.garantias (cliente_id);

CREATE INDEX IF NOT EXISTS garantias_status_idx
  ON public.garantias (empresa_id, status);

ALTER TABLE public.garantias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS garantias_policy ON public.garantias;
CREATE POLICY garantias_policy ON public.garantias
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
