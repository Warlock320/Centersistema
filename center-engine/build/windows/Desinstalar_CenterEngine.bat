@echo off
chcp 65001 >nul
title CenterEngine - Desinstalar

echo.
echo   Desinstalando CenterEngine...
echo.

:: Matar processo
taskkill /f /im node.exe /fi "WINDOWTITLE eq CenterEngine" 2>nul

:: Remover atalhos
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CenterEngine.lnk" 2>nul
del "%USERPROFILE%\Desktop\CenterEngine.lnk" 2>nul

:: Remover instalação
rmdir /s /q "%LOCALAPPDATA%\CenterEngine" 2>nul

echo   ✓ CenterEngine removido.
echo   Dados mantidos em: %USERPROFILE%\.center-engine\
echo   (delete manualmente se quiser)
echo.
pause
