@echo off
chcp 65001 >nul
title CenterEngine - Instalador

echo.
echo   ╔══════════════════════════════════════╗
echo   ║   Instalador CenterEngine v1.0.0     ║
echo   ║   Center Auto Pecas                  ║
echo   ╚══════════════════════════════════════╝
echo.

set INSTALL_DIR=%LOCALAPPDATA%\CenterEngine
set NODE_DIR=%INSTALL_DIR%\node
set ENGINE_FILE=%INSTALL_DIR%\engine.cjs
set STARTER=%INSTALL_DIR%\CenterEngine.bat
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CenterEngine.lnk
set DESKTOP=%USERPROFILE%\Desktop\CenterEngine.lnk

:: Criar pasta
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Baixar Node.js portátil se não existe
if not exist "%NODE_DIR%\node.exe" (
    echo   [1/4] Baixando Node.js portatil...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile '%INSTALL_DIR%\node.zip'" 2>nul
    if errorlevel 1 (
        echo   ❌ Erro ao baixar Node.js. Verifique sua internet.
        pause
        exit /b 1
    )
    echo   [2/4] Extraindo...
    powershell -Command "Expand-Archive -Path '%INSTALL_DIR%\node.zip' -DestinationPath '%INSTALL_DIR%\temp' -Force" 2>nul
    mkdir "%NODE_DIR%" 2>nul
    move "%INSTALL_DIR%\temp\node-v20.18.1-win-x64\node.exe" "%NODE_DIR%\node.exe" >nul
    rmdir /s /q "%INSTALL_DIR%\temp" 2>nul
    del "%INSTALL_DIR%\node.zip" 2>nul
    echo   ✓ Node.js instalado
) else (
    echo   [1/4] Node.js ja instalado ✓
)

:: Copiar engine.cjs
echo   [3/4] Copiando engine...
copy /Y "%~dp0engine.cjs" "%ENGINE_FILE%" >nul
echo   ✓ Engine instalado

:: Criar starter script
echo @echo off > "%STARTER%"
echo title CenterEngine >> "%STARTER%"
echo "%NODE_DIR%\node.exe" "%ENGINE_FILE%" >> "%STARTER%"

:: Criar atalhos
echo   [4/4] Criando atalhos...
powershell -Command "$ws=New-Object -ComObject WScript.Shell;$s=$ws.CreateShortcut('%DESKTOP%');$s.TargetPath='%STARTER%';$s.WorkingDirectory='%INSTALL_DIR%';$s.IconLocation='%NODE_DIR%\node.exe';$s.Description='CenterEngine - Agente desktop local';$s.WindowStyle=7;$s.Save()" 2>nul
echo   ✓ Atalho na area de trabalho

powershell -Command "$ws=New-Object -ComObject WScript.Shell;$s=$ws.CreateShortcut('%STARTUP%');$s.TargetPath='%STARTER%';$s.WorkingDirectory='%INSTALL_DIR%';$s.WindowStyle=7;$s.Description='CenterEngine';$s.Save()" 2>nul
echo   ✓ Auto-start com Windows

echo.
echo   ╔══════════════════════════════════════╗
echo   ║   Instalacao concluida!               ║
echo   ╠══════════════════════════════════════╣
echo   ║   • Atalho criado na area de trabalho ║
echo   ║   • Inicia automaticamente            ║
echo   ║   • Config: http://127.0.0.1:9090    ║
echo   ╚══════════════════════════════════════╝
echo.

:: Iniciar o engine
echo   Iniciando CenterEngine...
start "" "%STARTER%"

echo   Abrindo configuracao no navegador...
timeout /t 3 /nobreak >nul
start http://127.0.0.1:9090

echo.
echo   Pronto! Pode fechar esta janela.
echo.
pause
