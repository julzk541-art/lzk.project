Param(
  [switch]$SkipInstall
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$skipArg = if ($SkipInstall) { '-SkipInstall' } else { '' }

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$projectRoot\start-backend.ps1`"", $skipArg
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$projectRoot\start-frontend.ps1`"", $skipArg

Write-Host 'Backend and frontend launch commands have been started in two new PowerShell windows.' -ForegroundColor Green
