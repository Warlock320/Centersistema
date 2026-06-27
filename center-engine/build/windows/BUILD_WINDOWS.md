# Gerar executável Windows

O .exe precisa ser gerado em uma máquina Windows.

## Passos:

1. Instale o Node.js 20+ no Windows: https://nodejs.org

2. Abra o terminal (CMD ou PowerShell) na pasta `center-engine/`

3. Execute:
```bash
npm install
npm run build
npx @yao-pkg/pkg dist/engine.cjs --target node20-win-x64 --output build/windows/CenterEngine.exe
```

4. O arquivo `CenterEngine.exe` será gerado em `build/windows/`

## Uso:

Dê duplo-clique no `CenterEngine.exe` ou rode pelo terminal:
```bash
CenterEngine.exe
```

Na primeira execução, edite o arquivo de configuração:
`C:\Users\SeuUsuario\.center-engine\config.json`
