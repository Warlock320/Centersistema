-- v37 — Restrição de horário por usuário específico
-- Só os usuários da lista são afetados pelo horário de acesso.
-- Idempotente.

ALTER TABLE public.politicas_seguranca
  ADD COLUMN IF NOT EXISTS usuarios_horario_restrito UUID[] DEFAULT '{}';
