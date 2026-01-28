
# 使用.NET API直接修改Windows EXE文件的图标资源
# 这需要使用Windows API调用

# 首先，尝试使用rcedit npm包
Write-Host "尝试使用rcedit修改icon..."

$exePath = "C:\Users\luolan\ASG\ASG.Director\dist\Idvevent导播端 Setup 1.4.1.exe"
$iconPath = "C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"

if (-not (Test-Path $exePath)) {
    Write-Host "✗ EXE文件不存在"
    exit 1
}

if (-not (Test-Path $iconPath)) {
    Write-Host "✗ Icon文件不存在"
    exit 1
}

try {
    # 方法1：尝试直接使用rcedit (如果已安装)
    $rceditPath = "C:\Users\luolan\AppData\Local\npm\rcedit.cmd"
    if (Test-Path $rceditPath) {
        Write-Host "使用本地rcedit..."
        & $rceditPath "$exePath" --set-icon "$iconPath"
        Write-Host "✓ 图标已更新"
    } else {
        Write-Host "! rcedit未安装，将尝试npx..."
        
        # 方法2：使用npx（需要npm）
        cd "C:\Users\luolan\ASG\ASG.Director"
        npx rcedit "dist\Idvevent导播端 Setup 1.4.1.exe" --set-icon "assets\icon.ico"
    }
} catch {
    Write-Host "✗ 修改失败: $_"
    Write-Host "请手动安装rcedit: npm install -g rcedit"
}
