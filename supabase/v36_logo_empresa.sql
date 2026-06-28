-- v36 — Logo da empresa (white-label)
-- Permite cada empresa ter seu próprio logo.
-- Idempotente.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Bucket para logos (público para exibição)
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresa-logos', 'empresa-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS empresa_logo_select ON storage.objects;
CREATE POLICY empresa_logo_select ON storage.objects FOR SELECT
  USING (bucket_id = 'empresa-logos');

DROP POLICY IF EXISTS empresa_logo_insert ON storage.objects;
CREATE POLICY empresa_logo_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'empresa-logos' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);

DROP POLICY IF EXISTS empresa_logo_delete ON storage.objects;
CREATE POLICY empresa_logo_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'empresa-logos' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);
