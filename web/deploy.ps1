# ============================================================
# One-click: build content -> deploy dist/ to CloudBase hosting
# Usage: powershell -ExecutionPolicy Bypass -File deploy.ps1
# ============================================================
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

node scripts\build.js
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Build failed, deploy cancelled." -ForegroundColor Red; exit 1 }

tcb hosting deploy dist /9e3840e6-7054-452d-b9f5-5462917056e2 -e bigfish-2026-d4gixfnab6e09d0f2
if ($LASTEXITCODE -ne 0) { Write-Host "[X] Deploy failed." -ForegroundColor Red; exit 1 }

# robots.txt 必须位于域名根目录才会被爬虫识别（官网本体在子路径下）
tcb hosting deploy dist\robots.txt /robots.txt -e bigfish-2026-d4gixfnab6e09d0f2
if ($LASTEXITCODE -eq 0) { Write-Host "[ok] robots.txt -> domain root" -ForegroundColor DarkGray } else { Write-Host "[!] root robots.txt deploy failed (non-fatal)" -ForegroundColor DarkYellow }

Write-Host ""
Write-Host "[OK] Live: https://bigfish-2026-d4gixfnab6e09d0f2-1253692163.tcloudbaseapp.com/9e3840e6-7054-452d-b9f5-5462917056e2" -ForegroundColor Green
