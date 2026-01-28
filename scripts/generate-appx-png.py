#!/usr/bin/env python3
"""为AppX生成高质量的大尺寸PNG"""

try:
    from PIL import Image
    import os
    
    # 路径定义
    png_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.png"
    ico_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"
    
    # 打开原始icon.ico
    img = Image.open(ico_path)
    print(f"原始ICO分辨率: {img.size}")
    
    # 转换为RGB（如需要）
    if img.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', img.size, (255, 255, 255))
        if 'transparency' in img.info:
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else img)
        else:
            background.paste(img)
        img = background
    
    # 生成1024x1024的高质量PNG（AppX推荐）
    png_large = img.resize((1024, 1024), Image.Resampling.LANCZOS)
    png_large.save(png_path, format='PNG', quality=95)
    
    file_size_kb = os.path.getsize(png_path) / 1024
    print(f"✓ 已生成 1024x1024 PNG: {png_path}")
    print(f"  文件大小: {file_size_kb:.2f} KB")
    
    # 也生成512x512和310x310的版本（AppX特定需求）
    sizes_map = {
        'assets/icon-512.png': 512,
        'assets/icon-310.png': 310
    }
    
    for fname, size in sizes_map.items():
        fpath = os.path.join(r"C:\Users\luolan\ASG\ASG.Director", fname)
        img_resized = img.resize((size, size), Image.Resampling.LANCZOS)
        img_resized.save(fpath, format='PNG', quality=95)
        print(f"✓ 已生成 {size}x{size} PNG: {fname}")
    
except Exception as e:
    print(f"✗ 失败: {e}")
