/**
 * CenterEngine — Especificação da API REST local
 *
 * O engine Tauri deve servir estas rotas em http://127.0.0.1:9090
 * Todas as respostas são JSON com Content-Type: application/json
 * CORS deve permitir o domínio do sistema web (render.com + localhost)
 *
 * O engine é SOMENTE LEITURA para o sistema web.
 * Escritas vão direto pro Supabase — o engine apenas cacheia.
 */

// ── GET /ping ────────────────────────────────────────────────────────
// Health check — o sistema web chama isso para detectar o engine.
export interface PingResponse {
  ok: true;
  version: string;        // "1.0.0"
  lastSync: string | null; // ISO timestamp da última sincronização
  cacheSize: number;       // tamanho do SQLite em bytes
  uptime: number;          // segundos desde que o engine iniciou
}

// ── GET /api/produtos ────────────────────────────────────────────────
// Retorna todos os produtos ativos do cache local.
export interface ProdutoCache {
  id: string;
  codigo: string | null;
  ref: string | null;
  nome: string;
  preco: number;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  aplicacoes: string[];
  codigos_auxiliares: string[];
  categoria_nome: string | null;
  fornecedor_nome: string | null;
  imagem_url: string | null;
}

// ── GET /api/clientes ────────────────────────────────────────────────
export interface ClienteCache {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  celular: string | null;
  cidade: string | null;
  estado: string | null;
}

// ── GET /api/categorias ──────────────────────────────────────────────
export interface CategoriaCache {
  id: string;
  nome: string;
}

// ── POST /sync ───────────────────────────────────────────────────────
// Força sincronização imediata com o Supabase.
// Resposta: { ok: true, synced: number } (quantidade de registros)
export interface SyncResponse {
  ok: boolean;
  synced: number;
  duration: number; // ms
}

// ── POST /cache/clear ────────────────────────────────────────────────
// Limpa todo o cache local. Próximo sync recarrega tudo.
export interface ClearResponse {
  ok: boolean;
}

// ── GET /api/search?q=termo ──────────────────────────────────────────
// Busca fulltext local em produtos (nome, codigo, ref, aplicacoes).
// Muito mais rápido que ir ao Supabase.

// ── GET /logs ────────────────────────────────────────────────────────
// Retorna últimos N logs do engine (sync, erros, etc.)
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

// ── GET /config ──────────────────────────────────────────────────────
// ── PUT /config ──────────────────────────────────────────────────────
// Lê/salva configurações do engine.
export interface EngineConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  syncIntervalSeconds: number; // padrão: 120
  port: number;                // padrão: 9090
  autoStart: boolean;          // iniciar com o sistema
  logLevel: 'info' | 'warn' | 'error';
}
