Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$installDir = "$env:LOCALAPPDATA\CenterEngine"
$nodeDir = "$installDir\node"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Janela principal ──────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text = "CenterEngine - Instalador"
$form.Size = New-Object System.Drawing.Size(480, 340)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$form.ForeColor = [System.Drawing.Color]::White
$form.TopMost = $true

# Título
$title = New-Object System.Windows.Forms.Label
$title.Text = "CenterEngine v1.0.0"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(30, 20)
$title.Size = New-Object System.Drawing.Size(400, 35)
$form.Controls.Add($title)

# Subtítulo
$sub = New-Object System.Windows.Forms.Label
$sub.Text = "Agente desktop local — Center Auto Peças"
$sub.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$sub.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$sub.Location = New-Object System.Drawing.Point(30, 55)
$sub.Size = New-Object System.Drawing.Size(400, 20)
$form.Controls.Add($sub)

# Status
$status = New-Object System.Windows.Forms.Label
$status.Text = "Pronto para instalar"
$status.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$status.Location = New-Object System.Drawing.Point(30, 100)
$status.Size = New-Object System.Drawing.Size(400, 25)
$form.Controls.Add($status)

# Barra de progresso
$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(30, 135)
$progress.Size = New-Object System.Drawing.Size(400, 25)
$progress.Style = "Continuous"
$progress.Minimum = 0
$progress.Maximum = 100
$progress.Value = 0
$form.Controls.Add($progress)

# Detalhe
$detail = New-Object System.Windows.Forms.Label
$detail.Text = ""
$detail.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$detail.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$detail.Location = New-Object System.Drawing.Point(30, 168)
$detail.Size = New-Object System.Drawing.Size(400, 20)
$form.Controls.Add($detail)

# Botão instalar
$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = "Instalar"
$btnInstall.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$btnInstall.Location = New-Object System.Drawing.Point(30, 210)
$btnInstall.Size = New-Object System.Drawing.Size(195, 45)
$btnInstall.BackColor = [System.Drawing.Color]::FromArgb(59, 130, 246)
$btnInstall.ForeColor = [System.Drawing.Color]::White
$btnInstall.FlatStyle = "Flat"
$btnInstall.FlatAppearance.BorderSize = 0
$btnInstall.Cursor = [System.Windows.Forms.Cursors]::Hand
$form.Controls.Add($btnInstall)

# Botão fechar
$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = "Fechar"
$btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$btnClose.Location = New-Object System.Drawing.Point(235, 210)
$btnClose.Size = New-Object System.Drawing.Size(195, 45)
$btnClose.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$btnClose.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$btnClose.FlatStyle = "Flat"
$btnClose.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnClose.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# Rodapé
$footer = New-Object System.Windows.Forms.Label
$footer.Text = "Center Auto Peças © 2026"
$footer.Font = New-Object System.Drawing.Font("Segoe UI", 7)
$footer.ForeColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
$footer.Location = New-Object System.Drawing.Point(30, 270)
$footer.Size = New-Object System.Drawing.Size(400, 15)
$footer.TextAlign = "MiddleCenter"
$form.Controls.Add($footer)

# ── Função de instalação ──────────────────────────────────────────────
function Update-UI($pct, $msg, $det) {
    $progress.Value = $pct
    $status.Text = $msg
    $detail.Text = $det
    $form.Refresh()
}

$btnInstall.Add_Click({
    $btnInstall.Enabled = $false
    $btnInstall.Text = "Instalando..."
    $btnInstall.BackColor = [System.Drawing.Color]::FromArgb(100, 116, 139)

    try {
        # Criar pasta
        Update-UI 5 "Preparando instalação..." "Criando diretórios..."
        if (!(Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir -Force | Out-Null }

        # Baixar Node.js
        if (!(Test-Path "$nodeDir\node.exe")) {
            Update-UI 10 "Baixando Node.js..." "nodejs.org/dist/v20.18.1 (~30MB)"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $nodeZip = "$installDir\node.zip"
            Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip" -OutFile $nodeZip

            Update-UI 50 "Extraindo Node.js..." "Descompactando..."
            Expand-Archive -Path $nodeZip -DestinationPath "$installDir\temp" -Force
            if (!(Test-Path $nodeDir)) { New-Item -ItemType Directory -Path $nodeDir -Force | Out-Null }
            Copy-Item "$installDir\temp\node-v20.18.1-win-x64\node.exe" "$nodeDir\node.exe" -Force
            Remove-Item "$installDir\temp" -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item $nodeZip -Force -ErrorAction SilentlyContinue
        } else {
            Update-UI 50 "Node.js já instalado" ""
        }

        # Copiar engine
        Update-UI 60 "Copiando engine..." ""
        Copy-Item "$scriptDir\engine.cjs" "$installDir\engine.cjs" -Force
        Copy-Item "$scriptDir\CenterEngine.vbs" "$installDir\CenterEngine.vbs" -Force

        # Criar atalho Desktop
        Update-UI 75 "Criando atalhos..." "Área de trabalho"
        $ws = New-Object -ComObject WScript.Shell
        $desktopLnk = $ws.CreateShortcut("$env:USERPROFILE\Desktop\CenterEngine.lnk")
        $desktopLnk.TargetPath = "$installDir\CenterEngine.vbs"
        $desktopLnk.WorkingDirectory = $installDir
        $desktopLnk.Description = "CenterEngine - Center Auto Peças"
        $desktopLnk.Save()

        # Criar atalho Startup
        Update-UI 85 "Configurando auto-start..." "Iniciar com Windows"
        $startupLnk = $ws.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\CenterEngine.lnk")
        $startupLnk.TargetPath = "$installDir\CenterEngine.vbs"
        $startupLnk.WorkingDirectory = $installDir
        $startupLnk.Description = "CenterEngine"
        $startupLnk.Save()

        # Iniciar engine
        Update-UI 95 "Iniciando CenterEngine..." "Em background"
        Start-Process "wscript" -ArgumentList """$installDir\CenterEngine.vbs""" -WindowStyle Hidden

        Update-UI 100 "Instalação concluída!" "CenterEngine rodando em background"

        $status.ForeColor = [System.Drawing.Color]::FromArgb(74, 222, 128)
        $btnInstall.Text = "Instalado!"
        $btnInstall.BackColor = [System.Drawing.Color]::FromArgb(5, 150, 105)
        $btnClose.Text = "Concluir"

        # Abrir config no navegador
        Start-Sleep -Seconds 3
        Start-Process "http://127.0.0.1:9090"

    } catch {
        Update-UI 0 "Erro na instalação" $_.Exception.Message
        $status.ForeColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
        $btnInstall.Text = "Tentar novamente"
        $btnInstall.Enabled = $true
        $btnInstall.BackColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
    }
})

$form.ShowDialog()
