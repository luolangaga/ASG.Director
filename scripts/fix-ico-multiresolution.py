#!/usr/bin/env python3
"""生成真正的多分辨率ICO文件（包含所有帧）"""

from PIL import Image
import io

ico_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"
png_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.png"

try:
    # 打开PNG
    img = Image.open(png_path)
    print(f"源PNG: {img.size}")
    
    # 转换为RGB
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'RGBA':
            background.paste(img, mask=img.split()[3])
        else:
            background.paste(img)
        img = background
    
    # 生成多个尺寸
    sizes = [(256, 256), (128, 128), (96, 96), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    icon_images = []
    
    for size in sizes:
        resized = img.resize(size, Image.Resampling.LANCZOS)
        icon_images.append(resized)
        print(f"  ✓ {size[0]:>3}x{size[1]}")
    
    # 使用PIL的ICO保存（支持多帧）
    # 第一个图像作为主图，其他作为替代分辨率
    icon_images[0].save(
        ico_path,
        format='ICO',
        sizes=sizes
    )
    
    print(f"\n✓ 已保存多分辨率ICO: {ico_path}")
    print(f"  文件大小: {open(ico_path, 'rb').read().__len__() / 1024:.1f} KB")
    
except Exception as e:
    import traceback
    print(f"✗ 失败: {e}")
    traceback.print_exc()
