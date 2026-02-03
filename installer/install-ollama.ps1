# PPID Bot Assistant - Ollama Installer Script
# This script downloads and installs Ollama with required models

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   PPID Bot Assistant - Ollama Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama is already installed
$ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"

if (Test-Path $ollamaPath) {
    Write-Host "[OK] Ollama sudah terinstall" -ForegroundColor Green
} else {
    Write-Host "[...] Mengunduh Ollama..." -ForegroundColor Yellow
    
    $installerUrl = "https://ollama.com/download/OllamaSetup.exe"
    $installerPath = "$env:TEMP\OllamaSetup.exe"
    
    try {
        Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
        Write-Host "[OK] Download selesai" -ForegroundColor Green
        
        Write-Host "[...] Menginstall Ollama..." -ForegroundColor Yellow
        Start-Process -FilePath $installerPath -Args "/S" -Wait
        Write-Host "[OK] Ollama terinstall" -ForegroundColor Green
        
        # Wait for Ollama to be ready
        Start-Sleep -Seconds 5
    }
    catch {
        Write-Host "[ERROR] Gagal mengunduh Ollama: $_" -ForegroundColor Red
        Write-Host "Silakan download manual dari: https://ollama.com/download" -ForegroundColor Yellow
        Read-Host "Tekan Enter setelah install Ollama manual..."
    }
}

# Ensure Ollama is running
Write-Host ""
Write-Host "[...] Memastikan Ollama berjalan..." -ForegroundColor Yellow

$ollamaProcess = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if (-not $ollamaProcess) {
    Start-Process -FilePath $ollamaPath -Args "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

Write-Host "[OK] Ollama berjalan" -ForegroundColor Green

# Pull required models
Write-Host ""
Write-Host "[...] Mengunduh model AI (llama3.2:3b)..." -ForegroundColor Yellow
Write-Host "Ini mungkin memakan waktu beberapa menit..." -ForegroundColor Gray

try {
    & $ollamaPath pull llama3.2:3b
    Write-Host "[OK] Model llama3.2:3b siap" -ForegroundColor Green
}
catch {
    Write-Host "[WARNING] Gagal download llama3.2:3b" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[...] Mengunduh model embedding..." -ForegroundColor Yellow

try {
    & $ollamaPath pull nomic-embed-text
    Write-Host "[OK] Model nomic-embed-text siap" -ForegroundColor Green
}
catch {
    Write-Host "[WARNING] Gagal download nomic-embed-text" -ForegroundColor Yellow
}

# Create custom model
Write-Host ""
Write-Host "[...] Membuat model PPID Assistant..." -ForegroundColor Yellow

$modelfilePath = Join-Path $PSScriptRoot "..\Modelfile.ppid"
if (Test-Path $modelfilePath) {
    try {
        & $ollamaPath create ppid-assistant -f $modelfilePath
        Write-Host "[OK] Model ppid-assistant siap" -ForegroundColor Green
    }
    catch {
        Write-Host "[WARNING] Gagal membuat model ppid-assistant" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Setup Ollama Selesai!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Anda sekarang bisa menjalankan PPID Bot Assistant" -ForegroundColor White
