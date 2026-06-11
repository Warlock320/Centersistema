-- v25 — Notas fiscais de SAÍDA (emitidas por fora, enviadas só para consulta/arquivo)
-- + bucket de Storage para os arquivos (XML/PDF). Idempotente.

-- =====================================================================
-- Tabela de notas de saída
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notas_saida (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID         NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave_acesso      VARCHAR(44),
  numero_nota       TEXT,
  destinatario_nome TEXT,
  destinatario_doc  TEXT,
  cliente_id        UUID         REFERENCES public.clientes(id) ON DELETE SET NULL,
  valor_total       NUMERIC(12,2),
  data_emissao      DATE,
  arquivo_path      TEXT         NOT NULL,
  arquivo_nome      TEXT         NOT NULL,
  arquivo_tipo      TEXT,                       -- 'xml' | 'pdf' | 'outro'
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Evita duplicar a mesma nota (quando há chave de acesso) dentro da empresa
CREATE UNIQUE INDEX IF NOT EXISTS notas_saida_chave_uniq
  ON public.notas_saida (empresa_id, chave_acesso) WHERE chave_acesso IS NOT NULL;

CREATE INDEX IF NOT EXISTS notas_saida_empresa_idx ON public.notas_saida (empresa_id, data_emissao DESC);

ALTER TABLE public.notas_saida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notas_saida_policy ON public.notas_saida;
CREATE POLICY notas_saida_policy ON public.notas_saida
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- =====================================================================
-- Storage: bucket privado para os arquivos das notas
-- Caminho dos arquivos: {empresa_id}/{uuid}_{nome do arquivo}
-- O 1º segmento do path (a pasta) é o empresa_id — usado para isolar por empresa.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS notas_fiscais_select ON storage.objects;
CREATE POLICY notas_fiscais_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notas-fiscais' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);

DROP POLICY IF EXISTS notas_fiscais_insert ON storage.objects;
CREATE POLICY notas_fiscais_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notas-fiscais' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);

DROP POLICY IF EXISTS notas_fiscais_delete ON storage.objects;
CREATE POLICY notas_fiscais_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notas-fiscais' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);
