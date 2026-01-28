# 转换ICO到PNG用于AppX
Add-Type -AssemblyName System.Drawing

$icoPath = "C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"
$pngPath = "C:\Users\luolan\ASG\ASG.Director\assets\icon.png"

try {
    # 加载ICO文件
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($icoPath)
    
    # 提取最大尺寸的bitmap并保存为PNG
    $bitmap = $icon.ToBitmap()
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    
    Write-Host "✓ 已生成PNG图标: $pngPath"
    Write-Host "  分辨率: $($bitmap.Width)x$($bitmap.Height)"
} catch {
    Write-Host "✗ 转换失败: $_" -ForegroundColor Red
}
