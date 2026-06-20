-- v32 — Incremento atômico do número da NF-e
-- Previne duplicatas fiscais em acessos concorrentes.

CREATE OR REPLACE FUNCTION public.incrementar_nfe_numero(p_empresa_id UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_numero INT;
BEGIN
  UPDATE public.empresas
  SET nfe_proximo_numero = COALESCE(nfe_proximo_numero, 1) + 1
  WHERE id = p_empresa_id
  RETURNING nfe_proximo_numero - 1 INTO v_numero;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada: %', p_empresa_id;
  END IF;

  RETURN v_numero;
END;
$$;

-- RPC para estorno atômico de estoque (devoluções)
CREATE OR REPLACE FUNCTION public.estornar_estoque_devolucao(
  p_empresa_id UUID,
  p_itens JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    IF v_item->>'produto_id' IS NOT NULL THEN
      INSERT INTO public.movimentacoes_estoque
        (empresa_id, produto_id, tipo, quantidade, custo_unitario, referencia_tipo, observacao)
      VALUES (
        p_empresa_id,
        (v_item->>'produto_id')::UUID,
        'entrada',
        (v_item->>'quantidade')::NUMERIC,
        0,
        'devolucao',
        'Estorno por devolução — ' || COALESCE(v_item->>'descricao', '')
      );
    END IF;
  END LOOP;
END;
$$;
