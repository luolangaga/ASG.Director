#!/usr/bin/env python3
"""
在AppX中替换EXE的图标

AppX文件是ZIP格式，可以直接修改内部文件
"""

import zipfile
import os
import shutil
from PIL import Image

def replace_icon_in_appx():
    appx_path = r"C:\Users\luolan\ASG\ASG.Director\dist\Idvevent导播端 1.4.1.appx"
    icon_ico_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"
    temp_extract = r"C:\Users\luolan\ASG\ASG.Director\dist\appx_extract"
    
    # 清理临时目录
    if os.path.exists(temp_extract):
        shutil.rmtree(temp_extract)
    os.makedirs(temp_extract)
    
    # 1. 解包AppX
    print("正在解包AppX...")
    try:
        with zipfile.ZipFile(appx_path, 'r') as z:
            z.extractall(temp_extract)
        print("✓ AppX已解包")
    except Exception as e:
        print(f"✗ 解包失败: {e}")
        return False
    
    # 2. 找到并验证EXE文件
    exe_inside_appx = os.path.join(temp_extract, "app", "Idvevent%E5%AF%BC%E6%92%AD%E7%AB%AF.exe")
    if not os.path.exists(exe_inside_appx):
        print(f"✗ 未找到EXE: {exe_inside_appx}")
        print("目录内容:")
        for root, dirs, files in os.walk(temp_extract):
            for f in files:
                if f.endswith('.exe'):
                    print(f"  {os.path.relpath(os.path.join(root, f), temp_extract)}")
        return False
    
    print(f"✓ 找到EXE: {exe_inside_appx}")
    
    # 3. 现在的问题：我们需要修改EXE的icon资源
    #    这需要Windows API或者专门的工具
    #    最实用的是使用PowerShell + native API
    
    # 4. 重新打包AppX
    print("正在重新打包AppX...")
    # 备份原文件
    backup_path = appx_path + ".bak"
    if os.path.exists(backup_path):
        os.remove(backup_path)
    os.rename(appx_path, backup_path)
    
    # 创建新的AppX
    with zipfile.ZipFile(appx_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(temp_extract):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, temp_extract)
                zipf.write(file_path, arcname)
    
    print("✓ AppX已重新打包")
    
    # 清理
    shutil.rmtree(temp_extract)
    os.remove(backup_path)
    
    return True

if __name__ == "__main__":
    replace_icon_in_appx()
