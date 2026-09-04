# Install Foundry to E:\foundry (Windows, no Git Bash required)
# Run in PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts/install-foundry-e.ps1

$ErrorActionPreference = "Stop"
$foundryRoot = "E:\foundry"
$binDir = Join-Path $foundryRoot "bin"
$tmpZip = Join-Path $foundryRoot "foundry.zip"

New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$release = Invoke-RestMethod -Headers @{"User-Agent"="Cursor" } -Uri "https://api.github.com/repos/foundry-rs/foundry/releases/latest"
$asset = $release.assets | Where-Object { $_.name -eq "foundry_nightly_win32_amd64.zip" }

Write-Host "Downloading $($asset.name)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpZip
Expand-Archive -Path $tmpZip -DestinationPath (Join-Path $foundryRoot "extract") -Force

Get-ChildItem (Join-Path $foundryRoot "extract") -Recurse -Include forge.exe,cast.exe,anvil.exe,chisel.exe |
  ForEach-Object { Copy-Item $_.FullName (Join-Path $binDir $_.Name) -Force }

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
}
[Environment]::SetEnvironmentVariable("FOUNDRY_DIR", $foundryRoot, "User")

Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $foundryRoot "extract") -Recurse -Force -ErrorAction SilentlyContinue

& (Join-Path $binDir "forge.exe") --version
Write-Host "Done. Restart terminal, then run: forge --version"
