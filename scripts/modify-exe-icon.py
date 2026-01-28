#!/usr/bin/env python3
"""
使用rcedit直接修改EXE的图标资源
"""

import subprocess
import os

appx_path = r"C:\Users\luolan\ASG\ASG.Director\dist\Idvevent导播端 1.4.1.appx"
exe_path = r"C:\Users\luolan\ASG\ASG.Director\dist\win-unpacked\Idvevent导播端.exe"
icon_path = r"C:\Users\luolan\ASG\ASG.Director\assets\icon.ico"
nsis_exe = r"C:\Users\luolan\ASG\ASG.Director\dist\Idvevent导播端 Setup 1.4.1.exe"

if not os.path.exists(exe_path):
    print(f"✗ EXE不存在: {exe_path}")
    exit(1)

if not os.path.exists(icon_path):
    print(f"✗ 图标不存在: {icon_path}")
    exit(1)

# 检查是否有rcedit
try:
    result = subprocess.run(['where', 'rcedit'], capture_output=True, text=True)
    if result.returncode == 0:
        rcedit_path = result.stdout.strip()
        print(f"✓ 找到rcedit: {rcedit_path}")
    else:
        print("! rcedit未安装，将从npm安装...")
        # 可以使用npm包
        subprocess.run(['npx', 'rcedit', '--version'], cwd=r'C:\Users\luolan\ASG\ASG.Director')
except:
    print("✗ 无法找到rcedit")
