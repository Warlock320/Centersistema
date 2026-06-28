@echo off
chcp 65001 >nul
title CenterEngine - Instalador

echo.
echo   ======================================
echo     Instalador CenterEngine v1.0.0
echo     Center Auto Pecas
echo   ======================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\CenterEngine"
set "NODE_DIR=%INSTALL_DIR%\node"
set "ENGINE_FILE=%INSTALL_DIR%\engine.cjs"
set "VBS_FILE=%INSTALL_DIR%\CenterEngine.vbs"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CenterEngine.lnk"
set "DESKTOP=%USERPROFILE%\Desktop\CenterEngine.lnk"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

if not exist "%NODE_DIR%\node.exe" (
    echo   [1/4] Baixando Node.js portatil...
    echo         Isso pode levar alguns segundos...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile '%INSTALL_DIR%\node.zip'"
    if not exist "%INSTALL_DIR%\node.zip" (
        echo   ERRO: Falha ao baixar Node.js. Verifique sua internet.
        pause
        exit /b 1
    )
    echo   [2/4] Extraindo Node.js...
    powershell -NoProfile -Command "Expand-Archive -Path '%INSTALL_DIR%\node.zip' -DestinationPath '%INSTALL_DIR%\temp' -Force"
    if not exist "%NODE_DIR%" mkdir "%NODE_DIR%"
    copy /Y "%INSTALL_DIR%\temp\node-v20.18.1-win-x64\node.exe" "%NODE_DIR%\node.exe" >nul
    rmdir /s /q "%INSTALL_DIR%\temp" 2>nul
    del "%INSTALL_DIR%\node.zip" 2>nul
    echo   OK Node.js instalado
) else (
    echo   [1/4] Node.js ja instalado OK
)

echo   [3/4] Copiando arquivos...
copy /Y "%~dp0engine.cjs" "%ENGINE_FILE%" >nul
copy /Y "%~dp0CenterEngine.vbs" "%VBS_FILE%" >nul
echo   OK Engine copiado

echo   [4/4] Criando atalhos...
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut('%DESKTOP%'); $lnk.TargetPath='%VBS_FILE%'; $lnk.WorkingDirectory='%INSTALL_DIR%'; $lnk.Description='CenterEngine'; $lnk.Save()"
echo   OK Atalho na area de trabalho

powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $lnk=$ws.CreateShortcut('%STARTUP%'); $lnk.TargetPath='%VBS_FILE%'; $lnk.WorkingDirectory='%INSTALL_DIR%'; $lnk.Description='CenterEngine'; $lnk.Save()"
echo   OK Auto-start configurado

echo.
echo   ======================================
echo     Instalacao concluida!
echo   ======================================
echo.
echo   Atalho CenterEngine na area de trabalho
echo   Inicia automaticamente com o Windows
echo   Config: http://127.0.0.1:9090
echo.

echo   Iniciando CenterEngine...
wscript "%VBS_FILE%"

echo   Abrindo configuracao no navegador...
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:9090"

echo.
echo   Pronto! Pode fechar esta janela.
echo.
pause
