@echo off
chcp 65001 >nul
echo ========================================
echo ASG导播端 安装脚本
echo ========================================
echo.

echo 步骤1: 安装npm依赖...
call npm install --ignore-scripts
if errorlevel 1 (
    echo npm install 失败，请检查网络连接
    pause
    exit /b 1
)

echo.
echo 步骤2: 下载SignalR库...
powershell -Command "Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/npm/@microsoft/signalr@8.0.0/dist/browser/signalr.min.js' -OutFile 'pages\js\signalr.min.js'"
if errorlevel 1 (
    echo SignalR下载失败，请手动下载
    echo 下载地址: https://cdn.jsdelivr.net/npm/@microsoft/signalr@8.0.0/dist/browser/signalr.min.js
    echo 保存到: pages\js\signalr.min.js
)

echo.
echo 步骤3: 安装Electron...
call npm install electron --save-dev
if errorlevel 1 (
    echo Electron安装失败
    echo 如果是网络问题，请尝试使用镜像：
    echo set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    echo npm install electron --save-dev
    pause
    exit /b 1
)

echo.
echo ========================================
echo 安装完成！
echo 运行 npm start 启动应用
echo ========================================
pause
