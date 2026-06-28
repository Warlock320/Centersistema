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
  systemUrl: string;
  syncIntervalSeconds: number;
  port: number;
  autoStart: boolean;
}

const DEFAULT_CONFIG: Config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  systemUrl: '',
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

// ── Utilitários de sistema ────────────────────────────────────────────
const { execSync, exec: execAsync } = require('child_process') as typeof import('child_process');

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  execAsync(cmd).unref?.();
}

function autoInstall() {
  const isFirstRun = !fs.existsSync(CONFIG_FILE);
  if (!isFirstRun) return;

  log('info', 'Primeira execução — instalando...');
  const exe = process.execPath;

  if (process.platform === 'darwin') {
    // Mac: criar LaunchAgent para auto-start
    try {
      const agentDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
      const agentFile = path.join(agentDir, 'com.center.engine.plist');
      if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
      if (!fs.existsSync(agentFile)) {
        fs.writeFileSync(agentFile, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.center.engine</string>
<key>ProgramArguments</key><array><string>${exe}</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${path.join(CONFIG_DIR, 'stdout.log')}</string>
<key>StandardErrorPath</key><string>${path.join(CONFIG_DIR, 'stderr.log')}</string>
</dict></plist>`);
        try { execSync(`launchctl load "${agentFile}"`); } catch {}
        log('info', 'Auto-start configurado (LaunchAgent)');
      }
    } catch (e) { log('warn', 'Não foi possível configurar auto-start: ' + String(e)); }
  }

  if (process.platform === 'win32') {
    // Windows: criar atalho na Desktop e Startup
    try {
      const desktop = path.join(os.homedir(), 'Desktop', 'CenterEngine.lnk');
      const startup = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'CenterEngine.lnk');
      const createShortcut = (target: string) =>
        `powershell -Command "$ws=New-Object -ComObject WScript.Shell;$s=$ws.CreateShortcut('${target}');$s.TargetPath='${exe}';$s.Description='CenterEngine';$s.Save()"`;
      try { execSync(createShortcut(desktop)); log('info', 'Atalho criado na área de trabalho'); } catch {}
      try { execSync(createShortcut(startup)); log('info', 'Auto-start configurado (Startup)'); } catch {}
    } catch (e) { log('warn', 'Não foi possível criar atalhos: ' + String(e)); }
  }

  log('info', 'Instalação concluída');
}

// ── Página de configuração (HTML embutido) ───────────────────────────
function configPage(config: Config): string {
  const masked = config.supabaseAnonKey ? config.supabaseAnonKey.slice(0, 20) + '...' : '';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CenterEngine — Configuração</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#1e293b;border-radius:16px;padding:32px;width:100%;max-width:500px;box-shadow:0 25px 50px rgba(0,0,0,.5)}
h1{font-size:20px;margin-bottom:4px;color:#fff}
.sub{color:#64748b;font-size:13px;margin-bottom:24px}
.status{display:flex;align-items:center;gap:8px;padding:12px;border-radius:10px;margin-bottom:20px;font-size:13px}
.status.ok{background:#064e3b;color:#6ee7b7}
.status.warn{background:#78350f;color:#fbbf24}
label{display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;margin-top:16px}
input,select{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;outline:none}
input:focus{border-color:#3b82f6}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:20px;width:100%;transition:opacity .2s}
.btn-blue{background:#3b82f6;color:#fff}.btn-blue:hover{opacity:.9}
.btn-green{background:#059669;color:#fff}.btn-green:hover{opacity:.9}
.btn-ghost{background:transparent;border:1px solid #334155;color:#94a3b8;margin-top:8px}.btn-ghost:hover{border-color:#3b82f6;color:#fff}
.msg{padding:10px;border-radius:8px;font-size:13px;margin-top:12px;display:none}
.msg.ok{display:block;background:#064e3b;color:#6ee7b7}
.msg.err{display:block;background:#7f1d1d;color:#fca5a5}
.footer{text-align:center;margin-top:16px;font-size:11px;color:#475569}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
.badge-green{background:#064e3b;color:#6ee7b7}
.badge-amber{background:#78350f;color:#fbbf24}
</style></head><body>
<div class="card">
<h1>⚙️ CenterEngine v1.0.0</h1>
<p class="sub">Agente desktop local — Center Auto Peças</p>

<div class="status ${config.supabaseUrl ? 'ok' : 'warn'}">
${config.supabaseUrl
  ? `<span class="badge badge-green">● Online</span> Conectado ao Supabase`
  : `<span class="badge badge-amber">● Não configurado</span> Configure a URL e chave abaixo`}
</div>

<form id="form">
<label>URL do Supabase *</label>
<input id="url" type="url" placeholder="https://xxxx.supabase.co" value="${config.supabaseUrl}" required>

<label>Anon Key (chave pública) *</label>
<input id="key" type="text" placeholder="eyJhbGciOiJIUzI1NiIs..." value="${config.supabaseAnonKey}" required>
<p style="font-size:11px;color:#475569;margin-top:4px">Encontre em: Supabase → Settings → API → anon public</p>

<label>URL do Sistema (abre ao iniciar)</label>
<input id="sysurl" type="url" placeholder="https://seu-sistema.onrender.com" value="${config.systemUrl || ''}">
<p style="font-size:11px;color:#475569;margin-top:4px">O navegador abre nessa URL quando o engine inicia</p>

<div class="row">
<div><label>Intervalo de sync (seg)</label><input id="interval" type="number" min="30" max="3600" value="${config.syncIntervalSeconds}"></div>
<div><label>Porta</label><input id="port" type="number" min="1024" max="65535" value="${config.port}"></div>
</div>

<button type="button" class="btn btn-green" onclick="testConn()">🔍 Testar Conexão</button>
<button type="submit" class="btn btn-blue">💾 Salvar Configuração</button>
<button type="button" class="btn btn-ghost" onclick="doSync()">🔄 Sincronizar Agora</button>

<div id="msg" class="msg"></div>
</form>

<div class="footer">
Cache: ${(getCacheSize() / 1024).toFixed(0)} KB · Última sync: ${getLastSync() ? new Date(getLastSync()!).toLocaleString('pt-BR') : 'nunca'}<br>
Dados em: ~/.center-engine/
</div>
</div>

<script>
const msg=document.getElementById('msg');
function showMsg(t,ok){msg.className='msg '+(ok?'ok':'err');msg.textContent=t;msg.style.display='block'}

async function testConn(){
  const url=document.getElementById('url').value.trim();
  const key=document.getElementById('key').value.trim();
  if(!url||!key){showMsg('Preencha URL e chave.',false);return}
  showMsg('Testando conexão...',true);
  try{
    const r=await fetch(url+'/rest/v1/empresas?select=id&limit=1',{headers:{apikey:key,Authorization:'Bearer '+key}});
    if(r.ok){const d=await r.json();showMsg('✅ Conexão OK! '+d.length+' empresa(s) encontrada(s).',true)}
    else if(r.status===401) showMsg('❌ Chave inválida. Verifique a Anon Key.',false);
    else showMsg('❌ Erro: HTTP '+r.status,false);
  }catch(e){showMsg('❌ Não foi possível conectar. Verifique a URL.',false)}
}

document.getElementById('form').onsubmit=async(e)=>{
  e.preventDefault();
  const cfg={supabaseUrl:document.getElementById('url').value.trim(),supabaseAnonKey:document.getElementById('key').value.trim(),systemUrl:document.getElementById('sysurl').value.trim(),syncIntervalSeconds:Number(document.getElementById('interval').value)||120,port:Number(document.getElementById('port').value)||9090,autoStart:true};
  try{
    const r=await fetch('/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});
    if(r.ok){showMsg('✅ Configuração salva! Recarregando...',true);setTimeout(()=>location.reload(),1500)}
    else showMsg('Erro ao salvar.',false);
  }catch(e){showMsg('Erro: '+e.message,false)}
};

async function doSync(){
  showMsg('Sincronizando...',true);
  try{
    const r=await fetch('/sync',{method:'POST'});
    const d=await r.json();
    showMsg('✅ Sync completo: '+d.synced+' registros em '+d.duration+'ms',true);
    setTimeout(()=>location.reload(),1500);
  }catch(e){showMsg('Erro: '+e.message,false)}
}
</script>
</body></html>`;
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
      // Página de configuração (relê config do disco para refletir alterações)
      if (p === '/' && req.method === 'GET') {
        cors(res);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(configPage(loadConfig()));
        return;
      }
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

  autoInstall();
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

  if (config.supabaseUrl) {
    await syncAll(config);
    // Abre o sistema da loja no navegador
    if (config.systemUrl) {
      log('info', 'Abrindo sistema: ' + config.systemUrl);
      openBrowser(config.systemUrl);
    }
  } else {
    console.log(`  ⚠️  Supabase não configurado.`);
    console.log(`  Abrindo configuração no navegador...\n`);
    openBrowser(`http://127.0.0.1:${port}`);
  }

  setInterval(() => { if (config.supabaseUrl) syncAll(config); }, config.syncIntervalSeconds * 1000);
  process.on('SIGINT', () => { saveDB(); server.close(); process.exit(0); });
  process.on('SIGTERM', () => { saveDB(); server.close(); process.exit(0); });
}

main().catch((err) => { console.error('Erro fatal:', err); process.exit(1); });
