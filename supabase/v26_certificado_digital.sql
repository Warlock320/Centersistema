-- v26 — Certificado digital A1 (e-CNPJ) por empresa
-- O arquivo .pfx fica no Storage privado; a senha vai CRIPTOGRAFADA (AES-256-GCM,
-- chave em env do servidor — CERT_ENC_KEY). Nada sensível é exposto ao cliente.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.certificados_digitais (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID         NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  arquivo_path   TEXT         NOT NULL,           -- caminho no bucket 'certificados'
  titular_nome   TEXT,
  titular_cnpj   TEXT,
  validade       DATE,                            -- data de expiração (notAfter)
  senha_cipher   TEXT         NOT NULL,           -- senha do .pfx criptografada (hex)
  senha_iv       TEXT         NOT NULL,
  senha_tag      TEXT         NOT NULL,
  ativo          BOOLEAN      NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.certificados_digitais ENABLE ROW LEVEL SECURITY;

-- Leitura: a empresa pode ver os METADADOS do próprio certificado (sem senha exposta
-- no app — o front só seleciona colunas não sensíveis). Escrita só via service_role (API).
DROP POLICY IF EXISTS certificados_select ON public.certificados_digitais;
CREATE POLICY certificados_select ON public.certificados_digitais
  FOR SELECT USING (empresa_id = get_empresa_id());

-- =====================================================================
-- Storage: bucket privado para os arquivos .pfx
-- Caminho: {empresa_id}/cert.pfx  → 1º segmento isola por empresa
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados', 'certificados', false)
ON CONFLICT (id) DO NOTHING;

-- Só leitura/escrita pelo dono da empresa (na prática a API usa service_role,
-- mas as policies garantem o isolamento caso alguém use o token do usuário).
DROP POLICY IF EXISTS certificados_obj_select ON storage.objects;
CREATE POLICY certificados_obj_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificados' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);

DROP POLICY IF EXISTS certificados_obj_insert ON storage.objects;
CREATE POLICY certificados_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);

DROP POLICY IF EXISTS certificados_obj_delete ON storage.objects;
CREATE POLICY certificados_obj_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificados' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);
