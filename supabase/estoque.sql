-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO - AUTOMAÇÃO DE ESTOQUE
-- =====================================================================

-- Trigger: soma estoque na entrada, subtrai na saída
CREATE OR REPLACE FUNCTION public.processar_movimentacao_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.produtos SET estoque = estoque + NEW.quantidade WHERE id = NEW.produto_id;
  ELSIF NEW.tipo = 'saida' THEN
    UPDATE public.produtos SET estoque = estoque - NEW.quantidade WHERE id = NEW.produto_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_atualizar_estoque
  AFTER INSERT ON public.movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.processar_movimentacao_estoque();

-- Trigger: estorna estoque quando movimentação é deletada
CREATE OR REPLACE FUNCTION public.estornar_movimentacao_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tipo = 'entrada' THEN
    UPDATE public.produtos SET estoque = estoque - OLD.quantidade WHERE id = OLD.produto_id;
  ELSIF OLD.tipo = 'saida' THEN
    UPDATE public.produtos SET estoque = estoque + OLD.quantidade WHERE id = OLD.produto_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_estornar_estoque
  AFTER DELETE ON public.movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.estornar_movimentacao_estoque();

-- Trigger: atualiza updated_at em produtos
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- View: produtos abaixo do estoque mínimo
CREATE OR REPLACE VIEW public.v_produtos_abaixo_minimo AS
  SELECT * FROM public.produtos
  WHERE ativo = true AND estoque_minimo > 0 AND estoque < estoque_minimo;
