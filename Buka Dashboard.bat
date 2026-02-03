@echo off
title PPID Bot Assistant
color 0A
cls

echo ============================================
echo   PPID Bot Assistant - Starting...
echo ============================================
echo.

:: Start Ollama if not running
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo [..] Memulai Ollama...
    start /B "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    timeout /t 3 >nul
)

echo [..] Memulai Dashboard...
echo.
echo     Tutup window ini untuk menghentikan bot.
echo.

npm start
