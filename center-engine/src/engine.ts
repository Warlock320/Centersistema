import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
// @ts-expect-error sql-asm.js não tem tipos
import initSqlJs from 'sql.js/dist/sql-asm.js';
type SqlJsDb = { run: (sql: string, params?: unknown[]) => void; exec: (sql: string) => unknown[]; prepare: (sql: string) => { bind: (p: unknown[]) => void; step: () => boolean; getAsObject: () => Record<string, unknown>; free: () => void; run: (p: unknown[]) => void }; export: () => Uint8Array; close: () => void };

// ── Configuração ─────────────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.center-engine');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DB_FILE = path.join(CONFIG_DIR, 'cache.db');
const LOG_FILE = path.join(CONFIG_DIR, 'engine.log');

interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  syncIntervalSeconds: number;
  port: number;
  autoStart: boolean;
}

const DEFAULT_CONFIG: Config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  syncIntervalSeconds: 120,
  port: 9090,
  autoStart: true,
};

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig(): Config {
  ensureDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
  } catch {}
  saveConfig(DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

function saveConfig(config: Config) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── Logger ───────────────────────────────────────────────────────────
function log(level: string, msg: string) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
  console.log(line);
  try {
    ensureDir();
    fs.appendFileSync(LOG_FILE, line + '\n');
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 5 * 1024 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old');
  } catch {}
}

// ── SQLite (sql.js — puro JavaScript) ────────────────────────────────
let db: SqlJsDb;

async function initDB() {
  ensureDir();
  const SQL = await (initSqlJs as () => Promise<{ Database: new (data?: ArrayLike<number>) => SqlJsDb }>)();

  if (fs.existsSync(DB_FILE)) {
    const buf = fs.readFileSync(DB_FILE);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY, codigo TEXT, ref TEXT, nome TEXT,
      preco REAL, custo REAL, estoque REAL, estoque_minimo REAL,
      aplicacoes TEXT, codigos_auxiliares TEXT,
      categoria_nome TEXT, fornecedor_nome TEXT, imagem_url TEXT
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY, nome TEXT, cpf_cnpj TEXT,
      telefone TEXT, celular TEXT, cidade TEXT, estado TEXT
    );
    CREATE TABLE IF NOT EXISTS categorias (
      id TEXT PRIMARY KEY, nome TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY, value TEXT
    );
  `);

  log('info', `Cache SQLite inicializado: ${DB_FILE}`);
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function getCacheSize(): number {
  try { return fs.statSync(DB_FILE).size; } catch { return 0; }
}

function getLastSync(): string | null {
  try {
    const stmt = db.prepare('SELECT value FROM sync_meta WHERE key = ?');
    stmt.bind(['last_sync']);
    if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return String(row.value || ''); }
    stmt.free();
  } catch {}
  return null;
}

function setLastSync() {
  db.run('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', ['last_sync', new Date().toISOString()]);
  saveDB();
}

function queryAll(sql: string, params?: unknown[]): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── Sync com Supabase ────────────────────────────────────────────────
async function supabaseFetch(config: Config, table: string, select: string): Promise<unknown[]> {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return [];
  const url = `${config.supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=nome`;
  try {
    const res = await fetch(url, {
      headers: { 'apikey': config.supabaseAnonKey, 'Authorization': `Bearer ${config.supabaseAnonKey}`, 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as unknown[];
  } catch (err) {
    log('error', `Fetch ${table}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function syncAll(config: Config): Promise<number> {
  if (!config.supabaseUrl) { log('warn', 'Supabase não configurado'); return 0; }
  log('info', 'Sincronizando...');
  const start = Date.now();
  let total = 0;

  const produtos = await supabaseFetch(config, 'produtos', 'id,codigo,ref,nome,preco,custo,estoque,estoque_minimo,aplicacoes,codigos_auxiliares,imagem_url,categorias(nome),fornecedores(nome)&ativo=eq.true');
  if (produtos.length > 0) {
    db.run('DELETE FROM produtos');
    const stmt = db.prepare('INSERT INTO produtos VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const p of produtos as Record<string, unknown>[]) {
      const cat = p.categorias as Record<string, unknown> | null;
      const forn = p.fornecedores as Record<string, unknown> | null;
      stmt.run([p.id, p.codigo, p.ref, p.nome, p.preco, p.custo, p.estoque, p.estoque_minimo,
        JSON.stringify(p.aplicacoes || []), JSON.stringify(p.codigos_auxiliares || []),
        cat?.nome || null, forn?.nome || null, p.imagem_url || null]);
    }
    stmt.free();
    total += produtos.length;
  }

  const clientes = await supabaseFetch(config, 'clientes', 'id,nome,cpf_cnpj,telefone,celular,cidade,estado&ativo=eq.true');
  if (clientes.length > 0) {
    db.run('DELETE FROM clientes');
    const stmt = db.prepare('INSERT INTO clientes VALUES (?,?,?,?,?,?,?)');
    for (const c of clientes as Record<string, unknown>[]) {
      stmt.run([c.id, c.nome, c.cpf_cnpj, c.telefone, c.celular, c.cidade, c.estado]);
    }
    stmt.free();
    total += clientes.length;
  }

  const categorias = await supabaseFetch(config, 'categorias', 'id,nome');
  if (categorias.length > 0) {
    db.run('DELETE FROM categorias');
    const stmt = db.prepare('INSERT INTO categorias VALUES (?,?)');
    for (const c of categorias as Record<string, unknown>[]) { stmt.run([c.id, c.nome]); }
    stmt.free();
    total += categorias.length;
  }

  setLastSync();
  log('info', `Sync: ${total} registros em ${Date.now() - start}ms`);
  return total;
}

// ── Servidor HTTP ────────────────────────────────────────────────────
const startTime = Date.now();

function cors(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseRows(rows: Record<string, unknown>[]) {
  return rows.map((r) => ({
    ...r,
    aplicacoes: JSON.parse(String(r.aplicacoes || '[]')),
    codigos_auxiliares: JSON.parse(String(r.codigos_auxiliares || '[]')),
  }));
}

function createServer(config: Config) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${config.port}`);
    const p = url.pathname;
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

    try {
      if (p === '/ping') return json(res, { ok: true, version: '1.0.0', lastSync: getLastSync(), cacheSize: getCacheSize(), uptime: Math.floor((Date.now() - startTime) / 1000) });
      if (p === '/api/produtos') return json(res, parseRows(queryAll('SELECT * FROM produtos ORDER BY nome')));
      if (p === '/api/clientes') return json(res, queryAll('SELECT * FROM clientes ORDER BY nome'));
      if (p === '/api/categorias') return json(res, queryAll('SELECT * FROM categorias ORDER BY nome'));
      if (p === '/api/search') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        if (!q) return json(res, []);
        return json(res, parseRows(queryAll('SELECT * FROM produtos WHERE lower(nome) LIKE ?1 OR lower(codigo) LIKE ?1 OR lower(ref) LIKE ?1 OR lower(aplicacoes) LIKE ?1 LIMIT 50', [`%${q}%`])));
      }
      if (p === '/sync' && req.method === 'POST') { const s = Date.now(); const n = await syncAll(config); return json(res, { ok: true, synced: n, duration: Date.now() - s }); }
      if (p === '/cache/clear' && req.method === 'POST') { db.run('DELETE FROM produtos; DELETE FROM clientes; DELETE FROM categorias;'); saveDB(); return json(res, { ok: true }); }
      if (p === '/logs') {
        try {
          const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n').slice(-50).reverse();
          return json(res, lines.map((l) => { const m = l.match(/\[(.+?)\] \[(.+?)\] (.+)/); return m ? { timestamp: m[1], level: m[2].toLowerCase(), message: m[3] } : { timestamp: '', level: 'info', message: l }; }));
        } catch { return json(res, []); }
      }
      if (p === '/config') {
        if (req.method === 'PUT') { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { try { saveConfig({ ...config, ...JSON.parse(b) }); json(res, { ok: true }); } catch { json(res, { error: 'JSON inválido' }, 400); } }); return; }
        return json(res, { ...config, supabaseAnonKey: config.supabaseAnonKey ? '***' : '' });
      }
      json(res, { error: 'Not found' }, 404);
    } catch (err) { log('error', String(err)); json(res, { error: 'Internal error' }, 500); }
  });
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   CenterEngine v1.0.0               ║
  ║   Agente desktop local              ║
  ║   Center Auto Peças                 ║
  ╚══════════════════════════════════════╝
  `);

  const config = loadConfig();
  await initDB();
  const server = createServer(config);

  let port = config.port;
  const tryListen = (p: number): Promise<number> => new Promise((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && p < config.port + 10) resolve(tryListen(p + 1));
      else reject(err);
    });
    server.listen(p, '127.0.0.1', () => resolve(p));
  });

  try {
    port = await tryListen(config.port);
    log('info', `http://127.0.0.1:${port}`);
    console.log(`  → API:    http://127.0.0.1:${port}`);
    console.log(`  → Config: ${CONFIG_FILE}`);
    console.log(`  → Cache:  ${DB_FILE}`);
    console.log(`  → Logs:   ${LOG_FILE}\n`);
  } catch (err) { log('error', String(err)); process.exit(1); }

  if (config.supabaseUrl) { await syncAll(config); } else {
    console.log('  ⚠️  Supabase não configurado.');
    console.log(`  Edite: ${CONFIG_FILE}\n`);
  }

  setInterval(() => { if (config.supabaseUrl) syncAll(config); }, config.syncIntervalSeconds * 1000);
  process.on('SIGINT', () => { saveDB(); server.close(); process.exit(0); });
  process.on('SIGTERM', () => { saveDB(); server.close(); process.exit(0); });
}

main().catch((err) => { console.error('Erro fatal:', err); process.exit(1); });
