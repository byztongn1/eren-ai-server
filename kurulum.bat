@echo off
title Eren AI - Kurulum Scripti
echo ========================================================
echo   Eren AI Masaustu Paneli - Otomatik Kurulum
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Node.js kontrol ediliyor...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Sistemde Node.js bulunamadi.
    echo Node.js otomatik indiriliyor (Portable)...
    powershell -ExecutionPolicy Bypass -Command "mkdir -Force .node | Out-Null; $url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip'; $zip = '.node\node.zip'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri $url -OutFile $zip; Expand-Archive -Path $zip -DestinationPath .node\temp -Force; Move-Item -Path .node\temp\node-v20.18.0-win-x64\* -Destination .node\ -Force; Remove-Item -Recurse -Force .node\temp, $zip"
    set "PATH=%~dp0.node;%PATH%"
) else (
    echo Node.js sistemde mevcut.
)

echo.
echo [2/3] Paketler yukleniyor (npm install)...
call npm install

echo.
echo [3/3] Klasorler hazirlaniyor...
if not exist "data\photos\selin" mkdir "data\photos\selin"
if not exist "data\photos\mert" mkdir "data\photos\mert"

if not exist ".env" (
    echo GROK_API_KEY=xai-your-key-here > .env
    echo DEEPSEEK_API_KEY=sk-your-key-here >> .env
    echo OPENAI_API_KEY=sk-proj-your-key-here >> .env
    echo CLAUDE_API_KEY=sk-ant-your-key-here >> .env
)

echo.
echo ========================================================
echo   KURULUM TAMAMLANDI!
echo   Uygulamayi calistirmak icin 'baslat.bat' kullanin.
echo ========================================================
echo.
pause
