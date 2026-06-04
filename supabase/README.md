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
| 9 | `v6_cadastros.sql` | Melhorias de cadastros (categorias, vínculos, busca) |
| 10 | `v7_precos_estoque.sql` | Tabelas de preço por produto e ajustes de estoque |
| 11 | `v8_endereco_numero.sql` | Campo `numero` no endereço dos clientes |
| 12 | `v9_financeiro_fundacao.sql` | Fundação financeira: `unidade_id` (CNPJs) em contas a pagar/receber |
| 13 | `v10_caixa.sql` | **Caixa diário** (versão inicial): `caixas`, `movimentos_caixa`, `fechar_caixa` |
| 14 | `v11_orcamento.sql` | Prazo, observações interna/externa e melhorias de orçamento |
| 15 | `v12_ordem_servico.sql` | **Ordem de Serviço** + veículos |
| 16 | `v13_papel_caixa.sql` | Papel **Operador de Caixa** nos CHECKs de usuários/convites/permissões |
| 17 | `v14_caixa_pro.sql` | **Caixa profissional**: estados (aberto→em conferência→encerrado), sangria/suprimento/recebimento tipados, reabertura auditada, cancelamento sem exclusão, RPCs e flags de **conciliação bancária** |
| 18 | `v15_crediario.sql` | **Crediário**: limite/status/RG/celular no cliente, status `pago_parcial`, `aprovacoes_credito`, views `v_credito_cliente`/`v_parcelas_cliente` (limite, inadimplência, score) e RPC `receber_parcela` (motor único de recebimento, parcial + caixa) |
| 19 | `v16_auditoria.sql` | **Auditoria global** (`audit_log` + trigger genérico em todas as tabelas, `is_admin()`, RLS só admin) + correções de fluxo: `v_saldo_bancario`/`v_fluxo_caixa` consideram `pago_parcial` e passam a usar `security_invoker` (isolamento por empresa) |
| 20 | `v17_comandas.sql` | **Comanda / Pré-venda de balcão**: `aplicacao` no produto, tabelas `comandas`/`comanda_itens`, RPCs `enviar_comanda_caixa`/`faturar_comanda` (baixa estoque + financeiro + caixa, à vista e crediário)/`cancelar_comanda` |

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
