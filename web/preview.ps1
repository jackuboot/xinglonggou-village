# ============================================================
# Build then serve dist/ locally for preview
# Usage: powershell -ExecutionPolicy Bypass -File preview.ps1
# Preview URL: http://localhost:8080 (Ctrl+C to stop)
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

node scripts\build.js
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Build failed." -ForegroundColor Red; exit 1 }

Write-Host "[OK] Preview at http://localhost:8080 (Ctrl+C to stop)" -ForegroundColor Green
npx serve dist -l 8080
