# Setup do Banco de Dados — Supabase

Guia de instalação do banco para o **Center Auto Peças Gestão**.
Execute os scripts SQL **na ordem exata** abaixo, no **SQL Editor** do seu projeto Supabase.

---

## Ordem de execução

| # | Arquivo | O que cria |
|---|---------|-----------|
| 1 | `schema.sql` | Tabelas principais (empresas, usuários, clientes, produtos, orçamentos, pedidos, NF-e…), RLS e função `get_empresa_id()` |
| 2 | `estoque.sql` | Triggers de estoque (entrada/saída/estorno), `updated_at`, view de estoque mínimo |
| 3 | `functions.sql` | RPCs de fluxo: criar pedido a partir de orçamento, duplicar orçamento, KPIs do dashboard |
| 4 | `melhorias.sql` | Setup inicial da conta, aceitar convite, views de faturamento e LTV de clientes |
| 5 | `v2_improvements.sql` | `faturar_pedido` / `cancelar_pedido` com baixa de estoque + índices de performance |
| 6 | `v3_financeiro.sql` | **Módulo financeiro**: fornecedores, plano de contas, centros de custo, contas bancárias, contas a pagar/receber, régua de cobrança, views e RPCs financeiras |
| 7 | `v4_permissoes.sql` | **Papéis múltiplos** (`roles[]`): migra papel único → array, atualiza setup e convite |
| 8 | `v5_permissoes_config.sql` | **Permissões editáveis por papel**: tabela `permissoes_papel` + RPC de salvar |

> ⚠️ **A ordem importa.** Cada script depende dos anteriores (funções, tabelas e colunas).
> Os scripts são idempotentes (`IF NOT EXISTS` / `CREATE OR REPLACE`) — podem ser reexecutados sem erro.

---

## Passo a passo

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. No menu lateral, vá em **SQL Editor**.
3. Para cada arquivo, na ordem da tabela acima:
   - Abra o arquivo `.sql` desta pasta
   - Copie todo o conteúdo
   - Cole no SQL Editor e clique em **Run**
   - Confirme que rodou sem erros antes de passar para o próximo
4. (Recomendado) Após rodar tudo, vá em **Database → Reload schema cache** ou aguarde alguns segundos para o PostgREST atualizar a tipagem.

---

## Variáveis de ambiente

Após criar o projeto, copie as chaves em **Project Settings → API** e preencha o `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key   # necessária para cadastrar usuários com senha

# Desative o modo demo para usar o banco real:
NEXT_PUBLIC_DEMO_MODE=false
```

> A `SUPABASE_SERVICE_ROLE_KEY` é **secreta** — nunca exponha no client. Ela só é usada na API route `/api/usuarios` (server-side) para criar usuários. No deploy (Render), cadastre as três variáveis no painel de Environment.

---

## Configuração de autenticação

Em **Authentication → Providers → Email**:
- Para desenvolvimento/testes, você pode **desativar "Confirm email"** para logar sem confirmar o e-mail.
- Em produção, mantenha a confirmação ativada.

---

## Primeiro acesso

1. Suba o app (`npm run dev`) e acesse `/login`.
2. Clique em **"Cadastre-se"**, crie sua conta (e-mail + senha).
3. Você será levado para `/setup` — preencha os dados da empresa.
4. O `setup_initial_account` cria automaticamente:
   - a empresa (tenant)
   - seu usuário como **admin**
   - a conta bancária **Caixa**
   - o **plano de contas** e **centros de custo** padrão
5. Pronto — você entra no dashboard como administrador.

---

## Papéis e permissões

- Papéis disponíveis: **admin**, **gestor**, **financeiro**, **vendedor** (um usuário pode ter vários).
- Sem nenhuma linha em `permissoes_papel`, o sistema aplica a **matriz padrão** definida em `src/lib/permissions.ts`.
- O admin pode customizar as permissões de cada papel na tela **Configurações → Permissões por Papel** (salvo por empresa via `salvar_permissoes_papel`).
