# Run build with proxy and binaries mirror (session-only env vars)
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-build-with-proxy.ps1

# Ensure local app-builder cache dir
$cache = Join-Path $env:LOCALAPPDATA 'app-builder'
if (-Not (Test-Path $cache)) { New-Item -ItemType Directory -Path $cache | Out-Null; Write-Host 'Created' $cache } else { Write-Host 'Exists' $cache }

# Download winCodeSign via proxy mirror if not exists
$winFile = Join-Path $cache 'winCodeSign-2.6.0.7z'
$url = 'https://proxy.pipers.cn/https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z'
if (-Not (Test-Path $winFile)) {
    Write-Host 'Downloading' $url '->' $winFile
    try {
        Invoke-WebRequest -Uri $url -OutFile $winFile -UseBasicParsing -TimeoutSec 300
        Write-Host 'Downloaded to' $winFile
    } catch {
        Write-Host 'Download failed:' $_.Exception.Message
    }
} else {
    Write-Host 'Binary already exists:' $winFile
}

# Session env variables for electron-builder
$env:NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR = 'https://proxy.pipers.cn/https://github.com/electron-userland/electron-builder-binaries/releases/download/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = $env:NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR
$env:HTTPS_PROXY = 'http://proxy.pipers.cn:80'
$env:HTTP_PROXY = 'http://proxy.pipers.cn:80'

# Use cert password we used earlier; if different, set manually before running this script
if (-not $env:MSIX_CERT_PASSWORD) { $env:MSIX_CERT_PASSWORD = 'ASGTempPass!2026' }

Write-Host 'Environment set. Running npm install (short) and build:msix...'
npm install --no-audit --no-fund
npm run build:msix
