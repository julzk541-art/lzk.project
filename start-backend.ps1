Param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $projectRoot 'backend')

if (-not $SkipInstall) {
  Write-Host 'Installing backend dependencies...' -ForegroundColor Cyan
  npm install
}

Write-Host 'Starting backend on http://localhost:4000 ...' -ForegroundColor Green
npm run dev
