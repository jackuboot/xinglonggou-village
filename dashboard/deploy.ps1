# ============================================================
# Dashboard one-click: build -> deploy to CloudBase hosting /app/
# Usage: powershell -ExecutionPolicy Bypass -File deploy.ps1
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Build failed, deploy cancelled." -ForegroundColor Red; exit 1 }

tcb hosting deploy dist /app -e bigfish-2026-d4gixfnab6e09d0f2
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Deploy failed." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "[OK] Dashboard live: https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.tcloudbaseapp.com/app/" -ForegroundColor Green
Write-Host ""

# ---------- First super admin (run once; press Enter to skip) ----------
Write-Host "[Super admin] Enter the phone number of the first super admin." -ForegroundColor Yellow
Write-Host "  (Press Enter to skip: an admin already exists, or set it up later.)"
$phone = Read-Host "  Super admin phone"
if ($phone) {
  chcp 65001 | Out-Null
  node scripts\set-super-admin.mjs $phone
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Super admin configured." -ForegroundColor Green
  } else {
    Write-Host "[!] Setup failed - see message above. Retry later: node scripts\set-super-admin.mjs <phone>" -ForegroundColor Yellow
  }
} else {
  Write-Host "[i] Skipped. Run later: node scripts\set-super-admin.mjs <phone>" -ForegroundColor DarkGray
}
