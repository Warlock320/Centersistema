-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v21 — ORÇAMENTO NO BALCÃO
-- A comanda pode virar ORÇAMENTO (fica guardado) ou VENDA (vai ao caixa).
-- Execute APÓS o v17 (idempotente).
-- =====================================================================

-- Novo status 'orcamento'
ALTER TABLE public.comandas DROP CONSTRAINT IF EXISTS comandas_status_check;
ALTER TABLE public.comandas ADD CONSTRAINT comandas_status_check
  CHECK (status IN ('aberta','orcamento','aguardando_caixa','faturada','cancelada'));

-- Salvar a comanda como ORÇAMENTO (não vai ao caixa)
CREATE OR REPLACE FUNCTION public.salvar_orcamento(p_comanda_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
  v_numero  BIGINT;
  v_total   NUMERIC;
  v_itens   INT;
BEGIN
  SELECT status, numero INTO v_status, v_numero
  FROM public.comandas WHERE id = p_comanda_id AND empresa_id = v_empresa;
  IF v_numero IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_status NOT IN ('aberta','orcamento','aguardando_caixa') THEN RAISE EXCEPTION 'Esta comanda já foi finalizada.'; END IF;

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO v_itens, v_total
  FROM public.comanda_itens WHERE comanda_id = p_comanda_id;
  IF v_itens = 0 THEN RAISE EXCEPTION 'Adicione ao menos um item.'; END IF;

  UPDATE public.comandas SET status = 'orcamento', total = v_total, updated_at = now()
  WHERE id = p_comanda_id;
  RETURN v_numero;
END;
$$;

-- Enviar ao caixa (vira VENDA a receber) — aceita vindo de aberta OU orçamento
CREATE OR REPLACE FUNCTION public.enviar_comanda_caixa(p_comanda_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa UUID := get_empresa_id();
  v_status  TEXT;
  v_numero  BIGINT;
  v_total   NUMERIC;
  v_itens   INT;
BEGIN
  SELECT status, numero INTO v_status, v_numero
  FROM public.comandas WHERE id = p_comanda_id AND empresa_id = v_empresa;
  IF v_numero IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada.'; END IF;
  IF v_status NOT IN ('aberta','orcamento','aguardando_caixa') THEN RAISE EXCEPTION 'Esta comanda já foi finalizada.'; END IF;

  SELECT COUNT(*), COALESCE(SUM(total),0) INTO v_itens, v_total
  FROM public.comanda_itens WHERE comanda_id = p_comanda_id;
  IF v_itens = 0 THEN RAISE EXCEPTION 'Adicione ao menos um item antes de finalizar.'; END IF;

  UPDATE public.comandas
  SET status = 'aguardando_caixa', total = v_total, updated_at = now()
  WHERE id = p_comanda_id;
  RETURN v_numero;
END;
$$;
