#!/usr/bin/env python3
"""检查并修复icon.ico - 确保包含所有必要分辨率"""

from PIL import Image
import os

ico_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"

try:
    # 打开ICO文件
    img = Image.open(ico_path)
    
    print(f"当前ICO信息:")
    print(f"  格式: {img.format}")
    print(f"  模式: {img.mode}")
    print(f"  大小: {img.size}")
    
    # 检查是否有多个帧（分辨率）
    print(f"\nICO包含的分辨率:")
    try:
        for i in range(img.n_frames):
            img.seek(i)
            print(f"  帧 {i}: {img.size}")
    except:
        print(f"  只有一个分辨率: {img.size}")
    
except Exception as e:
    print(f"✗ 读取失败: {e}")
