-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v13 — PAPEL "OPERADOR DE CAIXA"
-- Execute APÓS os scripts anteriores
-- Adiciona o papel 'caixa' aos CHECKs de usuários, convites e permissões.
-- =====================================================================

-- usuarios.roles[] — aceita o novo papel
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_roles_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_roles_check
  CHECK (roles <@ ARRAY['admin','gestor','financeiro','vendedor','caixa']::TEXT[] AND array_length(roles, 1) >= 1);

-- usuarios.role (legado) — amplia para não bloquear inserts (roles[0])
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('admin','gestor','financeiro','vendedor','caixa','aprovador'));

-- convites.role / roles
ALTER TABLE public.convites DROP CONSTRAINT IF EXISTS convites_role_check;
ALTER TABLE public.convites ADD CONSTRAINT convites_role_check
  CHECK (role IN ('admin','gestor','financeiro','vendedor','caixa','aprovador'));

-- permissoes_papel.papel — aceita 'caixa'
ALTER TABLE public.permissoes_papel DROP CONSTRAINT IF EXISTS permissoes_papel_papel_check;
ALTER TABLE public.permissoes_papel ADD CONSTRAINT permissoes_papel_papel_check
  CHECK (papel IN ('admin','gestor','financeiro','vendedor','caixa'));
