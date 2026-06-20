-- v31 — Imagem de produto (foto da peça)
-- Armazenada no Supabase Storage, URL salva no registro do produto.
-- Idempotente.

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Bucket para imagens de produtos (público para exibição)
INSERT INTO storage.buckets (id, name, public)
VALUES ('produto-imagens', 'produto-imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Qualquer autenticado da empresa pode ler/escrever
DROP POLICY IF EXISTS produto_img_select ON storage.objects;
CREATE POLICY produto_img_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'produto-imagens');

DROP POLICY IF EXISTS produto_img_insert ON storage.objects;
CREATE POLICY produto_img_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produto-imagens' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);

DROP POLICY IF EXISTS produto_img_delete ON storage.objects;
CREATE POLICY produto_img_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'produto-imagens' AND (storage.foldername(name))[1] = public.get_empresa_id()::text);
