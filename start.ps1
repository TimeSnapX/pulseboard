$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Get-NetTCPConnection -LocalPort 4176 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Process -FilePath "python" -ArgumentList "-m","http.server","4176","--bind","127.0.0.1" -WindowStyle Hidden
Start-Sleep -Seconds 1
Start-Process "http://127.0.0.1:4176"
Write-Host "PulseBoard is on http://127.0.0.1:4176"
