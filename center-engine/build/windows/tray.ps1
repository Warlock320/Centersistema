Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configFile = "$env:USERPROFILE\.center-engine\config.json"

# Ler URL do sistema da config
function Get-SystemUrl {
    try {
        if (Test-Path $configFile) {
            $cfg = Get-Content $configFile | ConvertFrom-Json
            if ($cfg.systemUrl) { return $cfg.systemUrl }
        }
    } catch {}
    return "http://127.0.0.1:9090"
}

# Ícone (usa ícone de engrenagem do Windows)
$icon = [System.Drawing.SystemIcons]::Application

# Criar NotifyIcon
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $icon
$tray.Text = "CenterEngine - Center Auto Peças"
$tray.Visible = $true

# Menu de contexto
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$itemAbrir = $menu.Items.Add("Abrir Sistema")
$itemAbrir.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$itemAbrir.Add_Click({ Start-Process (Get-SystemUrl) })

$menu.Items.Add("-") | Out-Null

$itemConfig = $menu.Items.Add("Configurações")
$itemConfig.Add_Click({ Start-Process "http://127.0.0.1:9090" })

$itemSync = $menu.Items.Add("Sincronizar Agora")
$itemSync.Add_Click({
    try { Invoke-RestMethod -Uri "http://127.0.0.1:9090/sync" -Method Post | Out-Null } catch {}
    $tray.ShowBalloonTip(2000, "CenterEngine", "Sincronização concluída!", [System.Windows.Forms.ToolTipIcon]::Info)
})

$menu.Items.Add("-") | Out-Null

$itemStatus = $menu.Items.Add("Status: Verificando...")
$itemStatus.Enabled = $false

$menu.Items.Add("-") | Out-Null

$itemSair = $menu.Items.Add("Fechar Engine")
$itemSair.Add_Click({
    $tray.Visible = $false
    $tray.Dispose()
    # Matar o processo do engine
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        try { (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue).LocalPort -contains 9090 } catch { $false }
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu

# Duplo-clique no ícone abre o sistema
$tray.Add_DoubleClick({ Start-Process (Get-SystemUrl) })

# Mostrar balão de notificação ao iniciar
$tray.ShowBalloonTip(3000, "CenterEngine", "Agente local rodando. Clique para abrir o sistema.", [System.Windows.Forms.ToolTipIcon]::Info)

# Timer para atualizar status a cada 30s
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 30000
$timer.Add_Tick({
    try {
        $ping = Invoke-RestMethod -Uri "http://127.0.0.1:9090/ping" -TimeoutSec 3
        $lastSync = if ($ping.lastSync) { (Get-Date $ping.lastSync).ToString("HH:mm") } else { "nunca" }
        $cache = [math]::Round($ping.cacheSize / 1024, 0)
        $itemStatus.Text = "Online | Sync: $lastSync | Cache: ${cache}KB"
        $tray.Text = "CenterEngine - Online"
    } catch {
        $itemStatus.Text = "Status: Offline"
        $tray.Text = "CenterEngine - Offline"
    }
})
$timer.Start()
# Checar status imediatamente
$timer.Tag = "first"
try {
    $ping = Invoke-RestMethod -Uri "http://127.0.0.1:9090/ping" -TimeoutSec 5
    $itemStatus.Text = "Online | Cache: $([math]::Round($ping.cacheSize / 1024, 0))KB"
} catch {
    $itemStatus.Text = "Status: Aguardando engine..."
}

# Loop principal
[System.Windows.Forms.Application]::Run()
