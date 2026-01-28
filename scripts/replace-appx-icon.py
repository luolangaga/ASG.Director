#!/usr/bin/env python3
"""
修改AppX包中的图标
AppX其实就是一个ZIP文件，我们可以解包、替换图标、再重新打包
"""

import zipfile
import os
from pathlib import Path

def replace_appx_icon():
    appx_path = r"C:\Users\luolan\ASG\ASG.Director\dist\Idvevent导播端 1.4.1.appx"
    icon_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.png"
    
    if not os.path.exists(appx_path):
        print(f"✗ AppX文件不存在: {appx_path}")
        return False
    
    if not os.path.exists(icon_path):
        print(f"✗ 图标文件不存在: {icon_path}")
        return False
    
    try:
        # 创建备份
        backup_path = appx_path + ".backup"
        if os.path.exists(backup_path):
            os.remove(backup_path)
        os.rename(appx_path, backup_path)
        print(f"✓ 创建备份: {backup_path}")
        
        # 解包AppX
        temp_dir = r"C:\Users\luolan\ASG\ASG.Director\dist\appx_temp"
        if os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)
        
        with zipfile.ZipFile(backup_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        print(f"✓ 解包AppX")
        
        # 替换logo
        logo_path = os.path.join(temp_dir, "Assets", "logo.png")
        if os.path.exists(logo_path):
            os.remove(logo_path)
            with open(icon_path, 'rb') as src:
                with open(logo_path, 'wb') as dst:
                    dst.write(src.read())
            print(f"✓ 替换logo: Assets/logo.png")
        
        # 重新打包
        with zipfile.ZipFile(appx_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)
        
        print(f"✓ 重新打包AppX")
        
        # 清理
        import shutil
        shutil.rmtree(temp_dir)
        os.remove(backup_path)
        
        file_size_mb = os.path.getsize(appx_path) / (1024*1024)
        print(f"✓ AppX图标已更新: {file_size_mb:.2f} MB")
        return True
        
    except Exception as e:
        print(f"✗ 失败: {e}")
        return False

if __name__ == "__main__":
    replace_appx_icon()
