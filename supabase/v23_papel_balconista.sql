-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v23 — PAPEL "BALCONISTA"
-- Vende só no balcão (monta a pré-venda); não recebe nem vê o resto.
-- Execute APÓS os scripts anteriores (idempotente).
-- =====================================================================

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_roles_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_roles_check
  CHECK (roles <@ ARRAY['admin','gestor','financeiro','vendedor','caixa','balconista']::TEXT[] AND array_length(roles, 1) >= 1);

ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('admin','gestor','financeiro','vendedor','caixa','balconista','aprovador'));

ALTER TABLE public.convites DROP CONSTRAINT IF EXISTS convites_role_check;
ALTER TABLE public.convites ADD CONSTRAINT convites_role_check
  CHECK (role IN ('admin','gestor','financeiro','vendedor','caixa','balconista','aprovador'));

ALTER TABLE public.permissoes_papel DROP CONSTRAINT IF EXISTS permissoes_papel_papel_check;
ALTER TABLE public.permissoes_papel ADD CONSTRAINT permissoes_papel_papel_check
  CHECK (papel IN ('admin','gestor','financeiro','vendedor','caixa','balconista'));
