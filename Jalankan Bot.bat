@echo off
title PPID Bot - Terminal Mode
color 0E
cls

echo ============================================
echo   PPID Bot - Terminal Mode
echo ============================================
echo.

:: Start Ollama if not running
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo [..] Memulai Ollama...
    start /B "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    timeout /t 3 >nul
)

echo [..] Memulai Bot WhatsApp...
echo.
echo     Scan QR code yang muncul dengan WhatsApp.
echo     Tekan Ctrl+C untuk berhenti.
echo.

npm run bot
