-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v7 — TABELAS DE PREÇO + ESTOQUE CONFIGURÁVEL
-- Execute APÓS os scripts anteriores
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. CONFIG DA EMPRESA: permitir estoque negativo
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS permite_estoque_negativo BOOLEAN NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────
-- 2. TABELAS DE PREÇO (Varejo, Atacado, Oficina...)
--    ajuste_percentual: ajuste sobre o preço base do produto (ex: -15 = 15% off)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tabelas_preco (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome               TEXT NOT NULL,
  ajuste_percentual  NUMERIC(6,2) NOT NULL DEFAULT 0,
  padrao             BOOLEAN NOT NULL DEFAULT false,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. OVERRIDE DE PREÇO POR PRODUTO/TABELA (opcional)
--    Quando existe, sobrepõe o cálculo base*(1+ajuste%).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.precos_produto (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id       UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tabela_preco_id  UUID NOT NULL REFERENCES public.tabelas_preco(id) ON DELETE CASCADE,
  preco            NUMERIC(12,2) NOT NULL,
  UNIQUE (produto_id, tabela_preco_id)
);

CREATE INDEX IF NOT EXISTS idx_precos_produto_produto ON public.precos_produto(produto_id);
CREATE INDEX IF NOT EXISTS idx_precos_produto_tabela  ON public.precos_produto(tabela_preco_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.tabelas_preco  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precos_produto ENABLE ROW LEVEL SECURITY;

CREATE POLICY tabelas_preco_policy  ON public.tabelas_preco
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY precos_produto_policy ON public.precos_produto
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- 5. VIEW: preço final de cada produto em cada tabela
--    (override quando existe; senão base * (1 + ajuste%))
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_precos_produto AS
  SELECT
    p.id              AS produto_id,
    p.empresa_id,
    t.id              AS tabela_preco_id,
    t.nome            AS tabela_nome,
    t.padrao          AS tabela_padrao,
    ROUND(COALESCE(pp.preco, p.preco * (1 + t.ajuste_percentual / 100.0)), 2) AS preco,
    (pp.preco IS NOT NULL) AS preco_customizado
  FROM public.produtos p
  JOIN public.tabelas_preco t ON t.empresa_id = p.empresa_id AND t.ativo = true
  LEFT JOIN public.precos_produto pp ON pp.produto_id = p.id AND pp.tabela_preco_id = t.id
  WHERE p.ativo = true;

-- ─────────────────────────────────────────────────────────────────────
-- 6. SEED: garante uma tabela "Varejo" padrão para empresas existentes
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.tabelas_preco (empresa_id, nome, ajuste_percentual, padrao)
SELECT e.id, 'Varejo', 0, true
FROM public.empresas e
WHERE NOT EXISTS (SELECT 1 FROM public.tabelas_preco t WHERE t.empresa_id = e.id);

-- ─────────────────────────────────────────────────────────────────────
-- 7. setup_initial_account: criar tabela "Varejo" padrão em novas empresas
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

  INSERT INTO public.tabelas_preco (empresa_id, nome, ajuste_percentual, padrao)
  VALUES (v_empresa_id, 'Varejo', 0, true);

  PERFORM public.seed_plano_contas(v_empresa_id);

  RETURN v_empresa_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 8. faturar_pedido: valida estoque negativo conforme config da empresa
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.faturar_pedido(p_pedido_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pedido         RECORD;
  v_item           RECORD;
  v_plano_id       UUID;
  v_conta_rec_id   UUID;
  v_permite_neg    BOOLEAN;
  v_estoque_atual  NUMERIC;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado: %', p_pedido_id; END IF;
  IF v_pedido.status = 'faturado' THEN RETURN NULL; END IF;

  SELECT permite_estoque_negativo INTO v_permite_neg FROM public.empresas WHERE id = v_pedido.empresa_id;

  -- Se a loja NÃO permite estoque negativo, valida antes de baixar
  IF NOT COALESCE(v_permite_neg, true) THEN
    FOR v_item IN
      SELECT pi.produto_id, pi.quantidade, pr.nome, pr.estoque
      FROM public.pedido_itens pi
      JOIN public.produtos pr ON pr.id = pi.produto_id
      WHERE pi.pedido_id = p_pedido_id AND pi.produto_id IS NOT NULL
    LOOP
      IF v_item.estoque < v_item.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, necessário %',
          v_item.nome, v_item.estoque, v_item.quantidade;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.pedidos SET status = 'faturado', updated_at = now() WHERE id = p_pedido_id;

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

  IF v_pedido.orcamento_id IS NOT NULL THEN
    UPDATE public.orcamentos SET status = 'enviado', updated_at = now()
    WHERE id = v_pedido.orcamento_id AND status IN ('aprovado','aguardando_pecas');
  END IF;

  SELECT id INTO v_plano_id FROM public.plano_contas
  WHERE empresa_id = v_pedido.empresa_id AND codigo = '1.1' AND ativo = true LIMIT 1;

  INSERT INTO public.contas_receber
    (empresa_id, cliente_id, pedido_id, plano_contas_id, descricao, valor, data_vencimento)
  VALUES
    (v_pedido.empresa_id, v_pedido.cliente_id, p_pedido_id, v_plano_id,
     'Pedido #' || v_pedido.numero, v_pedido.total, CURRENT_DATE + INTERVAL '30 days')
  RETURNING id INTO v_conta_rec_id;

  RETURN v_conta_rec_id;
END;
$$;
