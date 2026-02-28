# OBS 自动化插件 - 安装说明

## 快速安装

### 方法一：自动安装（推荐）

在插件目录运行：
```powershell
cd "C:\Users\luolan\ASG\ASG.Director\plugins\obs-automation"
npm install
```

### 方法二：手动安装依赖到用户目录

如果插件已经被复制到用户目录，还需要在那里安装依赖：
```powershell
cd "$env:APPDATA\asg-director\plugins\obs-automation"
npm install
```

## 验证安装

重启 ASG.Director，如果在主页看到 "OBS 自动化" 卡片，说明安装成功。

## 常见问题

### Q: 提示 "Cannot find module 'ws'"
**A:** 运行上面的安装命令即可解决。

### Q: 插件没有出现在主页
**A:** 
1. 检查插件目录是否正确
2. 查看终端是否有错误信息
3. 确保已运行 `npm install`

### Q: 无法连接 OBS
**A:**
1. 确保 OBS Studio 已开启 WebSocket 服务器（工具 -> WebSocket 服务器设置）
2. 检查端口和密码是否正确（默认端口 4455）
3. 如果 OBS 在本机，使用 `localhost` 作为地址

## 依赖说明

本插件需要以下 npm 包：
- `ws` ^8.16.0 - WebSocket 客户端库

这些依赖会在运行 `npm install` 时自动安装。
