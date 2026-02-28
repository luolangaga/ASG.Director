# Check for Administrator privileges
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "This script requires Administrator privileges to modify QQ files."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$ZipPath = Join-Path $ScriptDir "LiteLoaderQQNT.zip"

try {
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host "   LiteLoaderQQNT Installer (Local)" -ForegroundColor Magenta
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host ""

    # 1. Check Zip
    Write-Host "[1/4] Checking Local File..." -ForegroundColor Yellow
    if (!(Test-Path $ZipPath)) {
        throw "LiteLoaderQQNT.zip not found in $ScriptDir"
    }
    Write-Host "Found: $ZipPath" -ForegroundColor Green

    # 2. Detect QQ Installation
    Write-Host "`n[2/4] Detecting QQ Installation..." -ForegroundColor Yellow
    
    function Get-ShortcutTarget {
        param($ShortcutPath)
        try {
            $WScriptShell = New-Object -ComObject WScript.Shell
            $Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
            return $Shortcut.TargetPath
        } catch {
            return $null
        }
    }

    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $PublicDesktopPath = [Environment]::GetFolderPath("CommonDesktopDirectory")
    $QQShortcut = Join-Path $DesktopPath "QQ.lnk"
    $PublicQQShortcut = Join-Path $PublicDesktopPath "QQ.lnk"
    
    $QQExePath = $null
    if (Test-Path $QQShortcut) { $QQExePath = Get-ShortcutTarget $QQShortcut }
    elseif (Test-Path $PublicQQShortcut) { $QQExePath = Get-ShortcutTarget $PublicQQShortcut }
    
    # Fallback registry check
    if ([string]::IsNullOrEmpty($QQExePath)) {
        try {
            $RegPath = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\QQ"
            $QQExePath = (Get-ItemProperty $RegPath -ErrorAction SilentlyContinue).InstallLocation
            if ($QQExePath) { $QQExePath = Join-Path $QQExePath "QQ.exe" }
        } catch {}
    }

    if ([string]::IsNullOrEmpty($QQExePath) -or !(Test-Path $QQExePath)) {
        throw "Could not find QQ installation. Please install QQNT first."
    }

    Write-Host "Found QQ executable at: $QQExePath" -ForegroundColor Green
    $QQInstallDir = Split-Path -Parent $QQExePath
    Write-Host "QQ Install Directory: $QQInstallDir" -ForegroundColor Gray

    # 3. Install Files (Safe Extraction)
    Write-Host "`n[3/4] Installing Files..." -ForegroundColor Yellow
    
    $CentralResourcesApp = Join-Path $QQInstallDir "resources\app"
    if (!(Test-Path $CentralResourcesApp)) {
        New-Item -ItemType Directory -Path $CentralResourcesApp -Force | Out-Null
    }
    
    $LiteLoaderDest = Join-Path $CentralResourcesApp "LiteLoaderQQNT"
    
    # Cleanup old installation
    if (Test-Path $LiteLoaderDest) {
        Remove-Item -Path $LiteLoaderDest -Recurse -Force
        Write-Host "Removed old installation." -ForegroundColor Gray
    }

    # Extract to temp folder to handle different zip structures
    $TempExtractDir = Join-Path $CentralResourcesApp "temp_liteloader_extract"
    if (Test-Path $TempExtractDir) { Remove-Item $TempExtractDir -Recurse -Force }
    New-Item -ItemType Directory -Path $TempExtractDir -Force | Out-Null

    Write-Host "Extracting zip..." -ForegroundColor Gray
    Expand-Archive -Path $ZipPath -DestinationPath $TempExtractDir -Force

    # Analyze structure
    $Items = Get-ChildItem $TempExtractDir
    $TargetDir = $null

    if ($Items.Count -eq 1 -and $Items[0].PSIsContainer) {
        # Case A: Zip contains a single folder (e.g., LiteLoaderQQNT-main)
        $TargetDir = $Items[0].FullName
        Write-Host "Detected nested folder structure." -ForegroundColor Gray
    } else {
        # Case B: Zip contains files directly (flat structure)
        $TargetDir = $TempExtractDir
        Write-Host "Detected flat file structure." -ForegroundColor Gray
    }

    # Verify validity (check for package.json or manifest.json)
    if (!(Test-Path (Join-Path $TargetDir "package.json")) -and !(Test-Path (Join-Path $TargetDir "manifest.json"))) {
        # Loose check, maybe it's valid but different structure? warning only
        Write-Warning "Warning: standard config files (package.json/manifest.json) not found in extracted files."
    }

    # Move to final destination
    Write-Host "Moving to final destination..." -ForegroundColor Gray
    Move-Item -Path $TargetDir -Destination $LiteLoaderDest -Force

    # Cleanup temp
    if (Test-Path $TempExtractDir) { Remove-Item $TempExtractDir -Recurse -Force }
    
    if (Test-Path $LiteLoaderDest) {
        Write-Host "Files installed to: $LiteLoaderDest" -ForegroundColor Green
    } else {
        throw "Installation failed: Destination folder not found."
    }

    # 4. Patch Versions
    Write-Host "`n[4/4] Patching Versions..." -ForegroundColor Yellow
    $PatchTargets = @()
    $VersionsDir = Join-Path $QQInstallDir "versions"

    if (Test-Path $VersionsDir) {
        $Versions = Get-ChildItem $VersionsDir -Directory
        foreach ($V in $Versions) {
            $Target = Join-Path $V.FullName "resources\app"
            $PatchTargets += $Target
        }
    } else {
        $PatchTargets += $CentralResourcesApp
    }
    
    if ($PatchTargets.Count -eq 0) {
        $PatchTargets += $CentralResourcesApp
    }

    foreach ($AppPath in $PatchTargets) {
        Write-Host "Patching: $AppPath" -ForegroundColor Cyan
        
        if (!(Test-Path $AppPath)) {
            New-Item -ItemType Directory -Path $AppPath -Force | Out-Null
        }

        # 4.1 Create app_launcher/LiteLoader.js
        $AppLauncherDir = Join-Path $AppPath "app_launcher"
        if (!(Test-Path $AppLauncherDir)) {
            New-Item -ItemType Directory -Path $AppLauncherDir -Force | Out-Null
        }

        $LiteLoaderJsPath = Join-Path $AppLauncherDir "LiteLoader.js"
        # Use String.raw with backticks for path safety
        $JsContent = "require(String.raw`$LiteLoaderDest`)"
        Set-Content -Path $LiteLoaderJsPath -Value $JsContent -Encoding UTF8

        # 4.2 Patch package.json
        $PackageJsonPath = Join-Path $AppPath "package.json"
        if (Test-Path $PackageJsonPath) {
            $JsonContent = Get-Content $PackageJsonPath -Raw
            $Pattern = '"main"\s*:\s*"[^"]*"'
            $Replacement = '"main": "./app_launcher/LiteLoader.js"'
            
            if ($JsonContent -match $Pattern) {
                if ($JsonContent -notmatch '"main": "./app_launcher/LiteLoader.js"') {
                    $NewJsonContent = $JsonContent -replace $Pattern, $Replacement
                    Set-Content -Path $PackageJsonPath -Value $NewJsonContent -Encoding UTF8
                    Write-Host "  Success: package.json patched" -ForegroundColor Green
                } else {
                    Write-Host "  Skip: package.json already patched" -ForegroundColor Gray
                }
            } else {
                Write-Warning "  Warning: 'main' field not found in package.json"
            }
        } else {
            Write-Warning "  Warning: package.json not found at $PackageJsonPath"
        }
    }

    Write-Host "`n==========================================" -ForegroundColor Green
    Write-Host "   Installation Successful!" -ForegroundColor Green
    Write-Host "   Please restart QQ." -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Read-Host "Press Enter to exit..."

} catch {
    Write-Host "`n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "   INSTALLATION FAILED" -ForegroundColor Red
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Location: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor DarkRed
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}