#!/usr/bin/env python3
"""生成多分辨率的高质量ICO文件"""

try:
    from PIL import Image
    import os
    
    # 路径定义
    png_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.png"
    ico_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"
    
    # 打开PNG文件
    img = Image.open(png_path)
    
    # 转换为RGB（ICO需要）
    if img.mode in ('RGBA', 'LA', 'P'):
        # 创建白色背景
        background = Image.new('RGB', img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    
    # 创建多个分辨率的版本
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    
    # 使用LANCZOS重采样创建高质量缩小版本
    icon_images = []
    for size in sizes:
        resized = img.resize(size, Image.Resampling.LANCZOS)
        icon_images.append(resized)
        print(f"✓ 创建 {size[0]}x{size[1]} 版本")
    
    # 保存为ICO文件
    icon_images[0].save(ico_path, format='ICO', sizes=sizes)
    
    file_size_kb = os.path.getsize(ico_path) / 1024
    print(f"✓ 已生成高质量ICO文件: {ico_path}")
    print(f"  文件大小: {file_size_kb:.2f} KB")
    
except ImportError:
    print("✗ 需要安装Pillow库")
    print("  运行: pip install Pillow")
except Exception as e:
    print(f"✗ 转换失败: {e}")
