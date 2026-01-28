# Copy app-builder binaries from project node_modules into %LOCALAPPDATA% cache
$src = Join-Path (Get-Location) 'node_modules\app-builder-bin\win\x64'
$dstRoot = Join-Path $env:LOCALAPPDATA 'app-builder'
$dst = Join-Path $dstRoot 'winCodeSign-2.6.0'
Write-Host 'Source:' $src
Write-Host 'Destination:' $dst
if (-Not (Test-Path $src)) { Write-Host 'Source not found:' $src; exit 1 }
if (-Not (Test-Path $dstRoot)) { New-Item -ItemType Directory -Path $dstRoot | Out-Null; Write-Host 'Created' $dstRoot }
if (-Not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null; Write-Host 'Created' $dst }

# Copy files
Get-ChildItem -Path $src -File | ForEach-Object { Copy-Item -Path $_.FullName -Destination $dst -Force }
Write-Host 'Copied files to' $dst

# Also copy the 7z if exists
$zipSrc = Join-Path $src 'winCodeSign-2.6.0.7z'
if (Test-Path $zipSrc) { Copy-Item -Path $zipSrc -Destination (Join-Path $dstRoot 'winCodeSign-2.6.0.7z') -Force; Write-Host 'Copied 7z to cache' }
Write-Host 'Done.'