# CenterEngine — Agente Desktop Local

Acelerador opcional para o sistema Center Auto Peças.
Cacheia dados localmente em SQLite para consultas instantâneas (5ms vs 200-500ms via internet).

## O que faz

- 🔄 Sincroniza produtos, clientes e categorias do Supabase para cache local
- 🚀 Serve API REST em `localhost:9090` para o sistema web consultar
- 📦 Cache SQLite local (~5ms de resposta)
- 📋 Log de operações
- ⚙️ Configurável via arquivo JSON

## Instalar e rodar

### Mac
```bash
cd center-engine
npm install
npm run build
npm run pkg:mac
./build/mac/CenterEngine
```

### Windows
```bash
cd center-engine
npm install
npm run build
npm run pkg:win
.\build\windows\CenterEngine.exe
```

### Desenvolvimento
```bash
npm run dev
```

## Configuração

Na primeira execução, o engine cria:
```
~/.center-engine/
├── config.json   ← configurações
├── cache.db      ← SQLite com dados
└── engine.log    ← log de operações
```

Edite `config.json`:
```json
{
  "supabaseUrl": "https://xxxx.supabase.co",
  "supabaseAnonKey": "eyJ...",
  "syncIntervalSeconds": 120,
  "port": 9090
}
```

## API

| Rota | Método | Descrição |
|------|--------|-----------|
| `/ping` | GET | Health check + status |
| `/api/produtos` | GET | Lista produtos do cache |
| `/api/clientes` | GET | Lista clientes do cache |
| `/api/categorias` | GET | Lista categorias do cache |
| `/api/search?q=termo` | GET | Busca fulltext em produtos |
| `/sync` | POST | Força sincronização imediata |
| `/cache/clear` | POST | Limpa todo o cache |
| `/logs` | GET | Últimos 50 logs |
| `/config` | GET/PUT | Ler/salvar configuração |

## Integração com o sistema web

O sistema web detecta automaticamente o engine em `localhost:9090`.
Quando detectado, leituras usam o cache local (mais rápido).
Escritas sempre vão direto pro Supabase (seguro).

O engine é 100% opcional — sem ele, tudo funciona normalmente.
