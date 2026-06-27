#!/bin/bash
# Instalador CenterEngine para macOS
# Copia o executável para /usr/local/bin e configura auto-start

set -e

APP_NAME="CenterEngine"
INSTALL_DIR="/usr/local/bin"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.center.engine.plist"
ENGINE_PATH="$INSTALL_DIR/$APP_NAME"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Instalador CenterEngine - macOS    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Verificar se o executável existe
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/build/mac/CenterEngine"

if [ ! -f "$SOURCE" ]; then
  SOURCE="$SCRIPT_DIR/CenterEngine"
fi

if [ ! -f "$SOURCE" ]; then
  echo "  ❌ Executável não encontrado."
  echo "  Coloque este script na mesma pasta do CenterEngine."
  exit 1
fi

# Copiar para /usr/local/bin
echo "  → Instalando em $INSTALL_DIR..."
sudo cp "$SOURCE" "$ENGINE_PATH"
sudo chmod +x "$ENGINE_PATH"
echo "  ✅ Executável instalado em $ENGINE_PATH"

# Criar LaunchAgent (auto-start com o sistema)
echo "  → Configurando auto-start..."
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$LAUNCH_AGENT" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.center.engine</string>
    <key>ProgramArguments</key>
    <array>
        <string>$ENGINE_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/.center-engine/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.center-engine/stderr.log</string>
</dict>
</plist>
EOF

# Carregar o agente
launchctl unload "$LAUNCH_AGENT" 2>/dev/null || true
launchctl load "$LAUNCH_AGENT"

echo "  ✅ Auto-start configurado"
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Instalação concluída!              ║"
echo "  ╠══════════════════════════════════════╣"
echo "  ║   • Engine rodando em background     ║"
echo "  ║   • Inicia automaticamente com o Mac ║"
echo "  ║   • Config: http://127.0.0.1:9090   ║"
echo "  ║   • Dados: ~/.center-engine/         ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Para desinstalar: bash uninstall-mac.sh"
echo ""
