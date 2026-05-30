-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v12 — VEÍCULOS + ORDEM DE SERVIÇO
-- Execute APÓS os scripts anteriores
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. VEÍCULOS (do cliente)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.veiculos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id   UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  marca        TEXT,
  modelo       TEXT NOT NULL,
  placa        TEXT,
  ano          TEXT,
  cor          TEXT,
  km           INT,
  chassi       TEXT,
  observacoes  TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_veiculos_empresa ON public.veiculos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_cliente ON public.veiculos(cliente_id);

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY veiculos_policy ON public.veiculos
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 2. ORDENS DE SERVIÇO
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  unidade_id          UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  cliente_id          UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  veiculo_id          UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
  tecnico_id          UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  numero              BIGSERIAL NOT NULL,
  status              TEXT NOT NULL DEFAULT 'aberta'
                        CHECK (status IN ('aberta','em_execucao','concluida','entregue','cancelada')),
  descricao_problema  TEXT,
  diagnostico         TEXT,
  observacoes         TEXT,
  km_entrada          INT,
  total_pecas         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_servicos      NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_entrada        TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_conclusao      TIMESTAMPTZ,
  data_entrega        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_os_empresa ON public.ordens_servico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_os_status  ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_cliente ON public.ordens_servico(cliente_id);

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_policy ON public.ordens_servico
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE OR REPLACE TRIGGER trg_os_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 3. ITENS DA OS (peças e serviços/mão de obra)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.os_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id          UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo           VARCHAR(8) NOT NULL CHECK (tipo IN ('peca','servico')),
  produto_id     UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao      TEXT NOT NULL,
  quantidade     NUMERIC(12,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem          INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_os_itens_os ON public.os_itens(os_id);

ALTER TABLE public.os_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_itens_policy ON public.os_itens
  USING (os_id IN (SELECT id FROM public.ordens_servico WHERE empresa_id = get_empresa_id()))
  WITH CHECK (os_id IN (SELECT id FROM public.ordens_servico WHERE empresa_id = get_empresa_id()));

-- ─────────────────────────────────────────────────────────────────────
-- 4. RPC: faturar OS (baixa estoque das peças + gera conta a receber)
--    Respeita a config de estoque negativo da empresa.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.faturar_os(p_os_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_os          RECORD;
  v_item        RECORD;
  v_plano_id    UUID;
  v_conta_id    UUID;
  v_permite_neg BOOLEAN;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  IF v_os.status = 'entregue' THEN RETURN NULL; END IF;

  SELECT permite_estoque_negativo INTO v_permite_neg FROM public.empresas WHERE id = v_os.empresa_id;

  -- valida estoque das peças se a loja não permite negativo
  IF NOT COALESCE(v_permite_neg, true) THEN
    FOR v_item IN
      SELECT oi.quantidade, pr.nome, pr.estoque
      FROM public.os_itens oi JOIN public.produtos pr ON pr.id = oi.produto_id
      WHERE oi.os_id = p_os_id AND oi.tipo = 'peca' AND oi.produto_id IS NOT NULL
    LOOP
      IF v_item.estoque < v_item.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, necessário %', v_item.nome, v_item.estoque, v_item.quantidade;
      END IF;
    END LOOP;
  END IF;

  -- baixa estoque das peças
  FOR v_item IN
    SELECT oi.*, pr.custo FROM public.os_itens oi
    LEFT JOIN public.produtos pr ON pr.id = oi.produto_id
    WHERE oi.os_id = p_os_id AND oi.tipo = 'peca' AND oi.produto_id IS NOT NULL
  LOOP
    INSERT INTO public.movimentacoes_estoque
      (empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, referencia_id, observacao)
    VALUES
      (v_os.empresa_id, v_item.produto_id, 'saida', v_item.quantidade, COALESCE(v_item.custo, 0),
       'os', p_os_id, 'OS #' || v_os.numero);
  END LOOP;

  -- marca como entregue
  UPDATE public.ordens_servico
  SET status = 'entregue', data_entrega = now(), updated_at = now()
  WHERE id = p_os_id;

  -- gera conta a receber
  SELECT id INTO v_plano_id FROM public.plano_contas
  WHERE empresa_id = v_os.empresa_id AND tipo = 'receita' AND ativo = true ORDER BY codigo LIMIT 1;

  INSERT INTO public.contas_receber
    (empresa_id, unidade_id, cliente_id, plano_contas_id, descricao, valor, data_vencimento)
  VALUES
    (v_os.empresa_id, v_os.unidade_id, v_os.cliente_id, v_plano_id,
     'OS #' || v_os.numero, v_os.total, CURRENT_DATE)
  RETURNING id INTO v_conta_id;

  RETURN v_conta_id;
END;
$$;
