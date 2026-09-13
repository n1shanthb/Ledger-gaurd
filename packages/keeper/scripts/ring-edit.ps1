# Decrypt Key Ring → edit in Notepad → re-enroll → delete plaintext.
# Usage (from anywhere):
#   cd e:\ledgergaurd\packages\keeper
#   $env:WALLET_PASS = 'your-pass'
#   .\scripts\ring-edit.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not $env:WALLET_PASS) {
  Write-Host "Set WALLET_PASS first:  `$env:WALLET_PASS = '…'" -ForegroundColor Yellow
  exit 1
}

Write-Host "[lga] decrypt → secrets.env"
npm run ring:export
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$plain = Join-Path (Get-Location) "secrets.env"
if (-not (Test-Path $plain)) {
  Write-Host "secrets.env missing after export" -ForegroundColor Red
  exit 1
}

Write-Host "[lga] opening Notepad — save + close when done"
Write-Host "  set SUBGRAPH_QUERY_URL=https://gateway.thegraph.com/api/subgraphs/id/GfvNLa3ym7X6bNDNm6oyqvHGgW2anbzTKhEo7cFPjhvz"
Write-Host "  keep GRAPH_API_KEY = your Studio API key"
Start-Process -FilePath notepad.exe -ArgumentList $plain -Wait

Write-Host "[lga] enroll → secrets.env.enc"
npm run ring:enroll
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $plain -Force -ErrorAction SilentlyContinue
Write-Host "[lga] done — secrets.env deleted. Restart keeper with WALLET_PASS."
