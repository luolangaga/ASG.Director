# 使用PNG生成多分辨率的高质量ICO文件
Add-Type -AssemblyName System.Drawing

$pngPath = "C:\Users\luolan\ASG\ASG.Director\assets\icon.png"
$icoPath = "C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"

try {
    # 加载PNG图标
    $baseBitmap = [System.Drawing.Image]::FromFile($pngPath)
    Write-Host "源PNG尺寸: $($baseBitmap.Width)x$($baseBitmap.Height)"
    
    # 创建多个分辨率的版本
    $sizes = @(256, 128, 64, 32, 16)
    $bitmaps = @()
    
    foreach ($size in $sizes) {
        $resized = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($resized)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($baseBitmap, 0, 0, $size, $size)
        $graphics.Dispose()
        $bitmaps += $resized
        Write-Host "  ✓ 创建 $size x $size 版本"
    }
    
    # 创建ICO图标
    $icon = [System.Drawing.Icon]::new($bitmaps[0])
    
    # 保存为ICO文件
    $stream = [System.IO.File]::Create($icoPath)
    $icon.Save($stream)
    $stream.Close()
    $icon.Dispose()
    
    # 清理
    foreach ($bmp in $bitmaps) {
        $bmp.Dispose()
    }
    $baseBitmap.Dispose()
    
    Write-Host "✓ 已生成高质量ICO文件: $icoPath"
    Write-Host "  文件大小: $(((Get-Item $icoPath).Length / 1KB).ToString('F2')) KB"
    
} catch {
    Write-Host "✗ 转换失败: $_" -ForegroundColor Red
}
