; NSIS Custom Installation Script for PPID Bot Assistant
; This script runs after electron-builder installs the main app

!macro customInstall
  ; Run Ollama installer script
  DetailPrint "Setting up Ollama AI Engine..."
  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\resources\installer\install-ollama.ps1"'
!macroend

!macro customUnInstall
  ; Clean up Ollama data (optional - keep models for other apps)
  ; RMDir /r "$LOCALAPPDATA\Ollama"
!macroend
