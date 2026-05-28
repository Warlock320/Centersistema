-- =====================================================================
-- CENTER AUTO PEÇAS GESTÃO - SCHEMA PRINCIPAL
-- Execute no Supabase SQL Editor
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função auxiliar: retorna empresa_id do usuário autenticado via RLS
CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid());
END;
$$;

-- Função auxiliar: retorna role do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN (SELECT role FROM public.usuarios WHERE id = auth.uid());
END;
$$;

-- 1. EMPRESAS (TENANTS)
CREATE TABLE IF NOT EXISTS public.empresas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  razao_social  TEXT        NOT NULL,
  cnpj          VARCHAR(14) NOT NULL UNIQUE,
  email         TEXT,
  telefone      TEXT,
  endereco      TEXT,
  cidade        TEXT,
  estado        VARCHAR(2),
  cep           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. USUÁRIOS E PERMISSÕES
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id  UUID    NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  role        TEXT    NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin','vendedor','aprovador')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID         NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo          TEXT,
  nome            TEXT         NOT NULL,
  categoria       UUID         REFERENCES public.categorias(id) ON DELETE SET NULL,
  preco           NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  custo           NUMERIC(12,4) DEFAULT 0.0000,
  estoque         NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  estoque_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0.000,
  ativo           BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 5. MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID          NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id      UUID          NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo            VARCHAR(7)    NOT NULL CHECK (tipo IN ('entrada','saida')),
  quantidade      NUMERIC(12,3) NOT NULL,
  custo_unitario  NUMERIC(12,4) NOT NULL,
  referencia_tipo TEXT          NOT NULL,
  referencia_id   UUID,
  observacao      TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- 6. CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
  id          UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID       NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT       NOT NULL,
  tipo        VARCHAR(8) NOT NULL DEFAULT 'juridica' CHECK (tipo IN ('fisica','juridica')),
  cpf_cnpj    TEXT,
  email       TEXT,
  telefone    TEXT,
  endereco    TEXT,
  cidade      TEXT,
  estado      VARCHAR(2),
  cep         TEXT,
  observacoes TEXT,
  ativo       BOOLEAN    NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ORÇAMENTOS
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID     NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id  UUID     NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  usuario_id  UUID     NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  numero      BIGSERIAL NOT NULL,
  status      TEXT     NOT NULL DEFAULT 'criado' CHECK (status IN (
                'criado','orcamento_enviado','aguardando_aprovacao',
                'aprovado','aguardando_pecas','enviado','cancelado'
              )),
  validade    DATE,
  observacoes TEXT,
  total       NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ITENS DO ORÇAMENTO
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id     UUID          NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  produto_id       UUID          REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao        TEXT          NOT NULL,
  quantidade       NUMERIC(12,3) NOT NULL DEFAULT 1.000,
  preco_unitario   NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  desconto         NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  ordem            INT           NOT NULL DEFAULT 0
);

-- 9. PEDIDOS
CREATE TABLE IF NOT EXISTS public.pedidos (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID     NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id   UUID     NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  orcamento_id UUID     REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  numero       BIGSERIAL NOT NULL,
  status       TEXT     NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','faturado','cancelado')),
  observacoes  TEXT,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. ITENS DO PEDIDO
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id      UUID          NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id     UUID          REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao      TEXT          NOT NULL,
  quantidade     NUMERIC(12,3) NOT NULL DEFAULT 1.000,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

-- 11. CONVITES
CREATE TABLE IF NOT EXISTS public.convites (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID    NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  email       TEXT    NOT NULL,
  role        TEXT    NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin','vendedor','aprovador')),
  token       TEXT    NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'),
  usado       BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. NOTAS FISCAIS (HISTÓRICO XML)
CREATE TABLE IF NOT EXISTS public.nfe_importadas (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID         NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave_acesso   VARCHAR(44)  NOT NULL UNIQUE,
  numero_nota    INT          NOT NULL,
  emitente_nome  TEXT         NOT NULL,
  valor_total    NUMERIC(12,2) NOT NULL,
  xml_conteudo   TEXT         NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.empresas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_importadas   ENABLE ROW LEVEL SECURITY;

-- Políticas de empresas: usuário vê apenas sua empresa
CREATE POLICY empresas_policy ON public.empresas
  USING (id = get_empresa_id())
  WITH CHECK (id = get_empresa_id());

-- Políticas de usuários
CREATE POLICY usuarios_policy ON public.usuarios
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

-- Políticas padrão multi-tenant (isolamento por empresa_id)
CREATE POLICY categorias_policy ON public.categorias
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY produtos_policy ON public.produtos
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY movimentacoes_policy ON public.movimentacoes_estoque
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY clientes_policy ON public.clientes
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY orcamentos_policy ON public.orcamentos
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY orcamento_itens_policy ON public.orcamento_itens
  USING (orcamento_id IN (SELECT id FROM public.orcamentos WHERE empresa_id = get_empresa_id()))
  WITH CHECK (orcamento_id IN (SELECT id FROM public.orcamentos WHERE empresa_id = get_empresa_id()));

CREATE POLICY pedidos_policy ON public.pedidos
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY pedido_itens_policy ON public.pedido_itens
  USING (pedido_id IN (SELECT id FROM public.pedidos WHERE empresa_id = get_empresa_id()))
  WITH CHECK (pedido_id IN (SELECT id FROM public.pedidos WHERE empresa_id = get_empresa_id()));

CREATE POLICY convites_policy ON public.convites
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY nfe_importadas_policy ON public.nfe_importadas
  USING (empresa_id = get_empresa_id()) WITH CHECK (empresa_id = get_empresa_id());
