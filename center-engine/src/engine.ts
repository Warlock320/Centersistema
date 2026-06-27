import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';

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
  logLevel: 'info' | 'warn' | 'error';
}

const DEFAULT_CONFIG: Config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  syncIntervalSeconds: 120,
  port: 9090,
  autoStart: true,
  logLevel: 'info',
};

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig(): Config {
  ensureDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
    }
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
    // Rotaciona log se > 5MB
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 5 * 1024 * 1024) {
      fs.renameSync(LOG_FILE, LOG_FILE + '.old');
    }
  } catch {}
}

// ── SQLite Cache ─────────────────────────────────────────────────────
let db: Database.Database;

function initDB() {
  ensureDir();
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');

  db.exec(`
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

function getCacheSize(): number {
  try { return fs.statSync(DB_FILE).size; } catch { return 0; }
}

function getLastSync(): string | null {
  try {
    const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get('last_sync') as { value: string } | undefined;
    return row?.value || null;
  } catch { return null; }
}

function setLastSync() {
  db.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run('last_sync', new Date().toISOString());
}

// ── Sync com Supabase ────────────────────────────────────────────────
async function supabaseFetch(config: Config, table: string, select: string): Promise<unknown[]> {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return [];
  const url = `${config.supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=nome`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as unknown[];
  } catch (err) {
    log('error', `Fetch ${table}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function syncAll(config: Config): Promise<number> {
  if (!config.supabaseUrl) { log('warn', 'Supabase não configurado — sync ignorado'); return 0; }
  log('info', 'Iniciando sincronização...');
  const start = Date.now();
  let total = 0;

  // Produtos
  const produtos = await supabaseFetch(config, 'produtos', 'id,codigo,ref,nome,preco,custo,estoque,estoque_minimo,aplicacoes,codigos_auxiliares,imagem_url,categorias(nome),fornecedores(nome)&ativo=eq.true');
  if (produtos.length > 0) {
    db.exec('DELETE FROM produtos');
    const insert = db.prepare('INSERT INTO produtos VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    const tx = db.transaction(() => {
      for (const p of produtos as Record<string, unknown>[]) {
        const cat = p.categorias as Record<string, unknown> | null;
        const forn = p.fornecedores as Record<string, unknown> | null;
        insert.run(
          p.id, p.codigo, p.ref, p.nome, p.preco, p.custo, p.estoque, p.estoque_minimo,
          JSON.stringify(p.aplicacoes || []), JSON.stringify(p.codigos_auxiliares || []),
          cat?.nome || null, forn?.nome || null, p.imagem_url || null
        );
      }
    });
    tx();
    total += produtos.length;
  }

  // Clientes
  const clientes = await supabaseFetch(config, 'clientes', 'id,nome,cpf_cnpj,telefone,celular,cidade,estado&ativo=eq.true');
  if (clientes.length > 0) {
    db.exec('DELETE FROM clientes');
    const insert = db.prepare('INSERT INTO clientes VALUES (?,?,?,?,?,?,?)');
    const tx = db.transaction(() => {
      for (const c of clientes as Record<string, unknown>[]) {
        insert.run(c.id, c.nome, c.cpf_cnpj, c.telefone, c.celular, c.cidade, c.estado);
      }
    });
    tx();
    total += clientes.length;
  }

  // Categorias
  const categorias = await supabaseFetch(config, 'categorias', 'id,nome');
  if (categorias.length > 0) {
    db.exec('DELETE FROM categorias');
    const insert = db.prepare('INSERT INTO categorias VALUES (?,?)');
    const tx = db.transaction(() => {
      for (const c of categorias as Record<string, unknown>[]) {
        insert.run(c.id, c.nome);
      }
    });
    tx();
    total += categorias.length;
  }

  setLastSync();
  const duration = Date.now() - start;
  log('info', `Sync completo: ${total} registros em ${duration}ms`);
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

function createServer(config: Config) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${config.port}`);
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

    try {
      // Ping
      if (pathname === '/ping') {
        return json(res, {
          ok: true,
          version: '1.0.0',
          lastSync: getLastSync(),
          cacheSize: getCacheSize(),
          uptime: Math.floor((Date.now() - startTime) / 1000),
        });
      }

      // Produtos
      if (pathname === '/api/produtos') {
        const rows = db.prepare('SELECT * FROM produtos ORDER BY nome').all();
        const parsed = (rows as Record<string, unknown>[]).map((r) => ({
          ...r,
          aplicacoes: JSON.parse(String(r.aplicacoes || '[]')),
          codigos_auxiliares: JSON.parse(String(r.codigos_auxiliares || '[]')),
        }));
        return json(res, parsed);
      }

      // Clientes
      if (pathname === '/api/clientes') {
        return json(res, db.prepare('SELECT * FROM clientes ORDER BY nome').all());
      }

      // Categorias
      if (pathname === '/api/categorias') {
        return json(res, db.prepare('SELECT * FROM categorias ORDER BY nome').all());
      }

      // Busca fulltext
      if (pathname === '/api/search') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        if (!q) return json(res, []);
        const rows = db.prepare(
          `SELECT * FROM produtos WHERE lower(nome) LIKE ? OR lower(codigo) LIKE ? OR lower(ref) LIKE ? OR lower(aplicacoes) LIKE ? LIMIT 50`
        ).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        const parsed = (rows as Record<string, unknown>[]).map((r) => ({
          ...r,
          aplicacoes: JSON.parse(String(r.aplicacoes || '[]')),
          codigos_auxiliares: JSON.parse(String(r.codigos_auxiliares || '[]')),
        }));
        return json(res, parsed);
      }

      // Sync manual
      if (pathname === '/sync' && req.method === 'POST') {
        const start = Date.now();
        const synced = await syncAll(config);
        return json(res, { ok: true, synced, duration: Date.now() - start });
      }

      // Limpar cache
      if (pathname === '/cache/clear' && req.method === 'POST') {
        db.exec('DELETE FROM produtos; DELETE FROM clientes; DELETE FROM categorias;');
        log('info', 'Cache limpo.');
        return json(res, { ok: true });
      }

      // Logs
      if (pathname === '/logs') {
        try {
          const content = fs.readFileSync(LOG_FILE, 'utf-8');
          const lines = content.trim().split('\n').slice(-50).reverse();
          const entries = lines.map((l) => {
            const match = l.match(/\[(.+?)\] \[(.+?)\] (.+)/);
            return match ? { timestamp: match[1], level: match[2].toLowerCase(), message: match[3] } : { timestamp: '', level: 'info', message: l };
          });
          return json(res, entries);
        } catch { return json(res, []); }
      }

      // Config
      if (pathname === '/config') {
        if (req.method === 'PUT') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const newConfig = { ...config, ...JSON.parse(body) };
              saveConfig(newConfig);
              return json(res, { ok: true });
            } catch { return json(res, { error: 'JSON inválido' }, 400); }
          });
          return;
        }
        const safe = { ...config, supabaseAnonKey: config.supabaseAnonKey ? '***' : '' };
        return json(res, safe);
      }

      // 404
      json(res, { error: 'Not found' }, 404);
    } catch (err) {
      log('error', `Request error: ${err instanceof Error ? err.message : String(err)}`);
      json(res, { error: 'Internal error' }, 500);
    }
  });

  return server;
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
  initDB();

  const server = createServer(config);

  // Tenta portas 9090-9099
  let port = config.port;
  const tryListen = (p: number): Promise<number> => new Promise((resolve, reject) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && p < config.port + 10) {
        resolve(tryListen(p + 1));
      } else reject(err);
    });
    server.listen(p, '127.0.0.1', () => resolve(p));
  });

  try {
    port = await tryListen(config.port);
    log('info', `Servidor rodando em http://127.0.0.1:${port}`);
    console.log(`  → API local: http://127.0.0.1:${port}`);
    console.log(`  → Config:    ${CONFIG_FILE}`);
    console.log(`  → Cache:     ${DB_FILE}`);
    console.log(`  → Logs:      ${LOG_FILE}`);
    console.log('');
  } catch (err) {
    log('error', `Não foi possível iniciar o servidor: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Sync inicial
  if (config.supabaseUrl) {
    log('info', 'Sync inicial...');
    await syncAll(config);
  } else {
    console.log('  ⚠️  Supabase não configurado.');
    console.log(`  Edite o arquivo: ${CONFIG_FILE}`);
    console.log('  Adicione supabaseUrl e supabaseAnonKey');
    console.log('');
  }

  // Sync periódico
  setInterval(() => {
    if (config.supabaseUrl) syncAll(config);
  }, config.syncIntervalSeconds * 1000);

  // Graceful shutdown
  process.on('SIGINT', () => { log('info', 'Encerrando...'); db.close(); server.close(); process.exit(0); });
  process.on('SIGTERM', () => { log('info', 'Encerrando...'); db.close(); server.close(); process.exit(0); });
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
