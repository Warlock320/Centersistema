#!/bin/bash
# Desinstalador CenterEngine para macOS

LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.center.engine.plist"

echo ""
echo "  Desinstalando CenterEngine..."

launchctl unload "$LAUNCH_AGENT" 2>/dev/null || true
rm -f "$LAUNCH_AGENT"
sudo rm -f /usr/local/bin/CenterEngine
echo ""
echo "  ✅ CenterEngine removido."
echo "  Dados mantidos em ~/.center-engine/ (delete manualmente se quiser)."
echo ""
