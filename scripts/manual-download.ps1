# Manual download script for electron-builder binaries
$ErrorActionPreference = 'Stop'

function Download-Binary {
    param($Url, $Dir, $FileName)
    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
    $target = Join-Path $Dir $FileName
    Write-Host "Downloading $FileName from $Url..."
    Invoke-WebRequest -Uri $Url -OutFile $target -Verbose
    Write-Host "Download complete: $target"
}

$cacheRoot = Join-Path $env:LOCALAPPDATA "app-builder\Cache"

# winCodeSign
$winCodeSignDir = Join-Path $cacheRoot "winCodeSign\winCodeSign-2.6.0"
Download-Binary -Url "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z" -Dir $winCodeSignDir -FileName "winCodeSign-2.6.0.7z"

# nsis
$nsisDir = Join-Path $cacheRoot "nsis\nsis-3.0.4.1"
Download-Binary -Url "https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z" -Dir $nsisDir -FileName "nsis-3.0.4.1.7z"

# nsis-resources
$nsisResDir = Join-Path $cacheRoot "nsis-resources\nsis-resources-3.4.1"
Download-Binary -Url "https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-resources-3.4.1/nsis-resources-3.4.1.7z" -Dir $nsisResDir -FileName "nsis-resources-3.4.1.7z"

Write-Host "All downloads complete. Try running the build again."
