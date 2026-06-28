@echo off
chcp 65001 >nul
title CenterEngine

set "INSTALL_DIR=%LOCALAPPDATA%\CenterEngine"
set "NODE_EXE=%INSTALL_DIR%\node\node.exe"
set "ENGINE=%INSTALL_DIR%\engine.cjs"
set "VBS=%INSTALL_DIR%\CenterEngine.vbs"
set "SHORTCUT=%USERPROFILE%\Desktop\CenterEngine.lnk"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CenterEngine.lnk"
set "SCRIPT_DIR=%~dp0"

:: Se já está instalado, só executa
if exist "%NODE_EXE%" if exist "%ENGINE%" (
    echo   CenterEngine iniciando...
    wscript "%VBS%"
    exit
)

:: ══════════════════════════════════════════════════════════
:: INSTALAÇÃO (só roda uma vez)
:: ══════════════════════════════════════════════════════════
echo.
echo   ======================================
echo     CenterEngine - Instalando...
echo   ======================================
echo.

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\node" mkdir "%INSTALL_DIR%\node"

:: Baixar Node.js
echo   Baixando componentes... (pode levar 1 minuto)
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile '%INSTALL_DIR%\node.zip'"

if not exist "%INSTALL_DIR%\node.zip" (
    echo   Erro ao baixar. Verifique sua internet.
    pause
    exit /b 1
)

echo   Extraindo...
powershell -NoProfile -Command "Expand-Archive -Path '%INSTALL_DIR%\node.zip' -DestinationPath '%INSTALL_DIR%\temp' -Force"
copy /Y "%INSTALL_DIR%\temp\node-v20.18.1-win-x64\node.exe" "%NODE_EXE%" >nul
rmdir /s /q "%INSTALL_DIR%\temp" 2>nul
del "%INSTALL_DIR%\node.zip" 2>nul

:: Copiar engine
copy /Y "%SCRIPT_DIR%engine.cjs" "%ENGINE%" >nul
copy /Y "%SCRIPT_DIR%CenterEngine.vbs" "%VBS%" >nul

:: Copiar este .bat para o install dir (para o atalho apontar pra lá)
copy /Y "%~f0" "%INSTALL_DIR%\CenterEngine.bat" >nul

:: Atalho Desktop
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $l=$ws.CreateShortcut('%SHORTCUT%'); $l.TargetPath='%VBS%'; $l.WorkingDirectory='%INSTALL_DIR%'; $l.Description='CenterEngine'; $l.Save()"

:: Atalho Startup
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $l=$ws.CreateShortcut('%STARTUP%'); $l.TargetPath='%VBS%'; $l.WorkingDirectory='%INSTALL_DIR%'; $l.Description='CenterEngine'; $l.Save()"

echo.
echo   Instalacao concluida!
echo   Iniciando CenterEngine...
echo.

:: Iniciar o engine
wscript "%VBS%"

:: Aguardar e abrir config
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:9090"

echo   Pronto! Pode fechar esta janela.
timeout /t 5 /nobreak >nul
