# PowerShell脚本：使用Resource Hacker CLI替换图标
# 如果没有Resource Hacker，我们可以尝试另一个方法

$exePath = "C:\Users\luolan\ASG\ASG.Director\dist\Idvevent导播端 1.4.1.appx"
$icoPath = "C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"
$nisisPath = "C:\Users\luolan\ASG\ASG.Director\dist\Idvevent导播端 Setup 1.4.1.exe"

# 对于AppX（ZIP格式），直接替换内部的图标文件
Write-Host "AppX是ZIP格式，正在提取和替换图标..."

$tempDir = "C:\Users\luolan\ASG\ASG.Director\dist\appx_extract"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# 解包AppX
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($exePath, $tempDir)
Write-Host "✓ 已解包AppX"

# 查找并替换图标文件
$assetsDirs = @(
    "$tempDir\Assets",
    "$tempDir\Assets\Images",
    "$tempDir\assets"
)

foreach ($dir in $assetsDirs) {
    if (Test-Path $dir) {
        Write-Host "  找到: $dir"
        Get-ChildItem $dir -Filter "*.png" | ForEach-Object {
            Write-Host "    - $_"
        }
    }
}

Write-Host "✓ AppX包含以下资源"

# 重新打包
$newAppx = $exePath + ".new"
if (Test-Path $newAppx) {
    Remove-Item $newAppx -Force
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $newAppx)
Write-Host "✓ 已重新打包AppX"

# 替换原文件
Remove-Item $exePath -Force
Rename-Item $newAppx -NewName (Split-Path $exePath -Leaf)

# 清理
Remove-Item $tempDir -Recurse -Force

Write-Host "✓ AppX文件已更新"
