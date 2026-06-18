-- v27 — NF-e EMISSÃO: campos fiscais em empresa/produto + tabela nfe_emitidas
-- Idempotente. Execute APÓS v26.

-- =====================================================================
-- 1. Campos fiscais na EMPRESA (emitente)
-- =====================================================================
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS inscricao_estadual   TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal  TEXT,
  ADD COLUMN IF NOT EXISTS regime_tributario     SMALLINT DEFAULT 1,  -- 1=Simples Nacional, 2=SN excesso, 3=Regime Normal
  ADD COLUMN IF NOT EXISTS codigo_municipio      VARCHAR(7),          -- código IBGE do município (7 dígitos)
  ADD COLUMN IF NOT EXISTS codigo_uf             VARCHAR(2),          -- código IBGE da UF (2 dígitos)
  ADD COLUMN IF NOT EXISTS cnae                  VARCHAR(7),
  ADD COLUMN IF NOT EXISTS numero                TEXT,                -- número do endereço (separado)
  ADD COLUMN IF NOT EXISTS bairro                TEXT,
  ADD COLUMN IF NOT EXISTS complemento           TEXT,
  ADD COLUMN IF NOT EXISTS nfe_serie             INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfe_ambiente          SMALLINT DEFAULT 2,  -- 1=produção, 2=homologação
  ADD COLUMN IF NOT EXISTS nfe_proximo_numero    INT DEFAULT 1;

-- =====================================================================
-- 2. Campos fiscais no PRODUTO
-- =====================================================================
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS cfop_saida         VARCHAR(4) DEFAULT '5102',  -- CFOP padrão venda interna
  ADD COLUMN IF NOT EXISTS origem             SMALLINT DEFAULT 0,          -- 0=Nacional
  ADD COLUMN IF NOT EXISTS csosn              VARCHAR(3) DEFAULT '102',    -- CSOSN p/ Simples Nacional
  ADD COLUMN IF NOT EXISTS cst_icms           VARCHAR(2),                  -- CST ICMS p/ Regime Normal
  ADD COLUMN IF NOT EXISTS aliquota_icms      NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cest               VARCHAR(7),
  ADD COLUMN IF NOT EXISTS cst_pis            VARCHAR(2) DEFAULT '99',
  ADD COLUMN IF NOT EXISTS cst_cofins         VARCHAR(2) DEFAULT '99',
  ADD COLUMN IF NOT EXISTS aliquota_pis       NUMERIC(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota_cofins    NUMERIC(5,4) DEFAULT 0;

-- =====================================================================
-- 3. Campos fiscais no CLIENTE (destinatário)
-- =====================================================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_municipio   VARCHAR(7),     -- IBGE do município
  ADD COLUMN IF NOT EXISTS bairro             TEXT,
  ADD COLUMN IF NOT EXISTS complemento        TEXT,
  ADD COLUMN IF NOT EXISTS indicador_ie       SMALLINT DEFAULT 9;  -- 1=contribuinte, 2=isento, 9=não contribuinte

-- =====================================================================
-- 4. Tabela NF-e EMITIDAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.nfe_emitidas (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_id              UUID          REFERENCES public.pedidos(id) ON DELETE SET NULL,
  numero                 INT           NOT NULL,
  serie                  INT           NOT NULL DEFAULT 1,
  chave_acesso           VARCHAR(44)   NOT NULL,
  protocolo_autorizacao  TEXT,
  status                 TEXT          NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente','processando','autorizada','rejeitada','cancelada','denegada')),
  motivo                 TEXT,                    -- motivo de rejeição/denegação
  xml_envio              TEXT,                    -- XML enviado à SEFAZ
  xml_autorizada         TEXT,                    -- XML com protocolo (retorno autorizado)
  destinatario_nome      TEXT,
  destinatario_doc       TEXT,
  valor_total            NUMERIC(12,2),
  data_emissao           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS nfe_emitidas_chave_uniq
  ON public.nfe_emitidas (chave_acesso);

CREATE INDEX IF NOT EXISTS nfe_emitidas_empresa_idx
  ON public.nfe_emitidas (empresa_id, numero DESC);

CREATE INDEX IF NOT EXISTS nfe_emitidas_pedido_idx
  ON public.nfe_emitidas (pedido_id) WHERE pedido_id IS NOT NULL;

ALTER TABLE public.nfe_emitidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfe_emitidas_policy ON public.nfe_emitidas;
CREATE POLICY nfe_emitidas_policy ON public.nfe_emitidas
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

-- =====================================================================
-- 5. Vínculo pedido → NF-e (referência rápida)
-- =====================================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS nfe_id UUID REFERENCES public.nfe_emitidas(id) ON DELETE SET NULL;
