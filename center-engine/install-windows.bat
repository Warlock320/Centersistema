@echo off
REM Instalador CenterEngine para Windows
REM Copia o executável e configura auto-start

echo.
echo   ======================================
echo     Instalador CenterEngine - Windows
echo   ======================================
echo.

set INSTALL_DIR=%LOCALAPPDATA%\CenterEngine
set STARTUP_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CenterEngine.lnk
set DESKTOP_LINK=%USERPROFILE%\Desktop\CenterEngine.lnk

REM Criar pasta de instalação
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM Copiar executável
echo   → Instalando em %INSTALL_DIR%...
copy /Y "%~dp0build\windows\CenterEngine.exe" "%INSTALL_DIR%\CenterEngine.exe" >nul
if errorlevel 1 (
    copy /Y "%~dp0CenterEngine.exe" "%INSTALL_DIR%\CenterEngine.exe" >nul
)
echo   ✓ Executavel copiado

REM Criar atalho na Startup (auto-start)
echo   → Configurando auto-start...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_LINK%'); $s.TargetPath = '%INSTALL_DIR%\CenterEngine.exe'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'CenterEngine - Agente desktop local'; $s.Save()"
echo   ✓ Auto-start configurado

REM Criar atalho na Desktop
echo   → Criando atalho na area de trabalho...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP_LINK%'); $s.TargetPath = '%INSTALL_DIR%\CenterEngine.exe'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'CenterEngine - Agente desktop local'; $s.Save()"
echo   ✓ Atalho criado

REM Iniciar o engine
echo   → Iniciando CenterEngine...
start "" "%INSTALL_DIR%\CenterEngine.exe"

echo.
echo   ======================================
echo     Instalacao concluida!
echo   ======================================
echo.
echo   * Engine rodando em background
echo   * Inicia automaticamente com o Windows
echo   * Config: http://127.0.0.1:9090
echo   * Atalho na area de trabalho
echo.
pause
