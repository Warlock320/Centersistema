-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO v20 — LOGIN POR NOME DE USUÁRIO
-- Permite login simples (ex: "jean") além de e-mail.
-- Execute APÓS os scripts anteriores (idempotente).
-- =====================================================================

-- Guarda o login digitado (nome simples ou e-mail). O e-mail real do Auth
-- é sintetizado (jean -> jean@centersistema.app) na criação/login.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS login TEXT;

-- Preenche o login dos usuários existentes com a parte antes do @ do e-mail
UPDATE public.usuarios
SET login = split_part(email, '@', 1)
WHERE login IS NULL AND email IS NOT NULL;
