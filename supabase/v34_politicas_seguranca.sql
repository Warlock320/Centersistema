-- v34 — Políticas de segurança configuráveis por empresa
-- Idempotente.

-- =====================================================================
-- 1. Tabela de políticas de segurança (uma por empresa)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.politicas_seguranca (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID         NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- Auto-logout por inatividade (em segundos, 0 = desativado)
  timeout_inatividade   INT          NOT NULL DEFAULT 900,    -- 15 minutos padrão
  -- Força de senha
  senha_min_caracteres  INT          NOT NULL DEFAULT 6,
  senha_exigir_numero   BOOLEAN      NOT NULL DEFAULT false,
  senha_exigir_especial BOOLEAN      NOT NULL DEFAULT false,
  -- Bloqueio por tentativas
  max_tentativas_login  INT          NOT NULL DEFAULT 5,      -- 0 = sem limite
  tempo_bloqueio_min    INT          NOT NULL DEFAULT 15,     -- minutos de bloqueio
  -- Sessão única (só 1 sessão ativa por usuário)
  sessao_unica          BOOLEAN      NOT NULL DEFAULT false,
  -- Horário de acesso (vazio = sem restrição)
  horario_inicio        TIME,
  horario_fim           TIME,
  -- Metadata
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.politicas_seguranca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS politicas_seguranca_policy ON public.politicas_seguranca;
CREATE POLICY politicas_seguranca_policy ON public.politicas_seguranca
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- =====================================================================
-- 2. Log de acesso (login/logout)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.log_acesso (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID         REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id   UUID         REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_nome TEXT,
  tipo         TEXT         NOT NULL CHECK (tipo IN ('login','logout','bloqueio','tentativa_falha')),
  ip           TEXT,
  user_agent   TEXT,
  detalhes     TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS log_acesso_empresa_idx ON public.log_acesso (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS log_acesso_usuario_idx ON public.log_acesso (usuario_id, created_at DESC);

ALTER TABLE public.log_acesso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS log_acesso_policy ON public.log_acesso;
CREATE POLICY log_acesso_policy ON public.log_acesso
  USING (empresa_id = get_empresa_id());

-- Permitir INSERT sem restrição (para logar tentativas de login mesmo antes de autenticar)
DROP POLICY IF EXISTS log_acesso_insert ON public.log_acesso;
CREATE POLICY log_acesso_insert ON public.log_acesso
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- 3. Campos de bloqueio no usuário
-- =====================================================================
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS tentativas_login    INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_ate       TIMESTAMPTZ;
