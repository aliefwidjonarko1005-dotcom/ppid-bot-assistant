@echo off
title PPID Bot Assistant - Setup
color 0B
cls

echo ============================================
echo   PPID Bot Assistant - Easy Setup
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js tidak ditemukan.
    echo     Download dari: https://nodejs.org
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

echo [OK] Node.js ditemukan
echo.

:: Check if Ollama is installed
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    echo [OK] Ollama ditemukan
) else (
    echo [!] Ollama belum terinstall
    echo [..] Membuka halaman download Ollama...
    start https://ollama.com/download
    echo.
    echo     Silakan install Ollama, lalu jalankan script ini lagi.
    pause
    exit /b 1
)

echo.
echo [..] Menginstall dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [X] Gagal install dependencies
    pause
    exit /b 1
)

echo.
echo [..] Memastikan Ollama berjalan...
start /B "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve

:: Wait for Ollama to start
timeout /t 3 >nul

echo.
echo [..] Mengunduh model AI...
echo     Ini mungkin memakan waktu beberapa menit...
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull llama3.2:3b
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull nomic-embed-text

echo.
echo [..] Membuat model PPID Assistant...
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" create ppid-assistant -f Modelfile.ppid

echo.
echo ============================================
echo   Setup Selesai!
echo ============================================
echo.
echo   Untuk menjalankan bot:
echo   1. Jalankan "Jalankan Bot.bat"
echo   2. Scan QR code dengan WhatsApp
echo.
echo   Untuk membuka dashboard:
echo   1. Jalankan "Buka Dashboard.bat"
echo.
pause
