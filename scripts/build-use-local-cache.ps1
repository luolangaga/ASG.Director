# Use local app-builder binaries to avoid external downloads
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-use-local-cache.ps1

Write-Host 'Using project-local app-builder cache...'
$projectRoot = Get-Location
$localCache = Join-Path $projectRoot 'node_modules\app-builder-bin'
if (-Not (Test-Path $localCache)) {
    Write-Host 'Local app-builder-bin not found:' $localCache
    exit 1
}

# Ensure expected winCodeSign file exists in local cache
$expected = Join-Path $localCache 'winCodeSign-2.6.0.7z'
if (-Not (Test-Path $expected)) {
    # try copying from win/x64 if present
    $src = Join-Path $localCache 'win\x64\winCodeSign-2.6.0.7z'
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $expected -Force
        Write-Host 'Copied' $src '->' $expected
    } else {
        Write-Host 'winCodeSign not found in local cache. Please place winCodeSign-2.6.0.7z into' $localCache
        exit 1
    }
} else {
    Write-Host 'Found local winCodeSign:' $expected
}

# Set session env to use this cache
$env:ELECTRON_BUILDER_CACHE = $localCache
$env:NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR = ''

Write-Host 'ELECTRON_BUILDER_CACHE set to' $env:ELECTRON_BUILDER_CACHE

# Ensure cert password env (adjust if you used another password)
if (-not $env:MSIX_CERT_PASSWORD) { $env:MSIX_CERT_PASSWORD = 'ASGTempPass!2026' }

Write-Host 'Running build (nsis target via build:msix script)...'
npm run build:msix
