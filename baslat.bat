@echo off
title Eren AI Masaustu Paneli
echo ========================================================
echo   Eren AI Masaustu Panel Baslatiliyor...
echo ========================================================
echo.

cd /d "%~dp0"

if exist ".node\node.exe" (
    set "PATH=%~dp0.node;%PATH%"
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js bulunamadi. Lutfen once 'kurulum.bat' calistirin.
    echo.
    pause
    exit /b 1
)

echo Masaustu uygulamasi aciliyor...
call npx electron .

if %errorlevel% neq 0 (
    echo.
    echo Bir hata olustu veya uygulama kapatildi.
    echo.
    pause
)
