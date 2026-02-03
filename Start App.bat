@echo off
title PPID Bot Desktop App
color 0B
cls

echo ============================================
echo   PPID Bot Assistant (Desktop App)
echo ============================================
echo.

:: Start Ollama if not running
echo [1/2] Mengecek Ollama...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo [..] Ollama tidak berjalan. Memulai Ollama...
    start /B "" "ollama" serve
    
    :: Fallback specific path if not in PATH
    if errorlevel 1 (
         start /B "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    )
    timeout /t 5 >nul
) else (
    echo [OK] Ollama sudah berjalan.
)

echo.
echo [2/2] Memulai Aplikasi...
npm start

echo.
echo Aplikasi ditutup.
pause
