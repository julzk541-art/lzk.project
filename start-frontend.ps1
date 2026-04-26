Param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $projectRoot 'frontend')

if (-not $SkipInstall) {
  Write-Host 'Installing frontend dependencies...' -ForegroundColor Cyan
  npm install
}

Write-Host 'Starting frontend on http://localhost:5173 ...' -ForegroundColor Green
npm run dev
