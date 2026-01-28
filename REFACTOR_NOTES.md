# ASG.Director 组件包重构说明

## 概述

本次重构解决了 ASG.Director 中组件包功能依赖 PowerShell 的问题，改用纯 Node.js 方案实现跨平台支持。

## 主要改进

### 1. 跨平台压缩解压模块 (`utils/archive.js`)

**新特性：**
- 使用 `archiver` 库进行 ZIP 压缩（已有）
- 使用 `yauzl` 库进行 ZIP 解压（新增）
- 备用方案使用 `adm-zip` 库
- 最后备用方案使用系统命令（tar/unzip/.NET）

**优势：**
- 不依赖 PowerShell，避免中文路径、权限等问题
- 支持 Windows、macOS、Linux
- 多层备用方案确保可靠性
- 支持文件完整性验证

### 2. 布局包管理模块 (`utils/packManager.js`)

**功能：**
- `exportPack()` - 导出布局包
- `importPack()` - 导入布局包
- `installFromStore()` - 从商店安装布局包
- `resetLayout()` - 重置布局
- `refreshWindows()` - 刷新所有窗口
- `getInstalledPacks()` - 获取已安装的包列表
- `saveInstalledPack()` - 保存安装记录

**优势：**
- 模块化设计，易于维护
- 统一的错误处理
- 自动临时文件清理
- 窗口状态同步

### 3. HTTP 下载工具模块 (`utils/downloader.js`)

**功能：**
- `httpGet()` - GET 请求获取 JSON
- `httpPost()` - POST 请求
- `downloadFile()` - 下载文件（支持断点续传）
- `getFileSize()` - 获取远程文件大小
- `formatSize()` - 格式化文件大小

**优势：**
- 支持断点续传
- 自动重试机制（最多3次）
- 进度回调
- 重定向处理
- 超时控制

### 4. 更新模块重构 (`updater-v2.js`)

**新特性：**
- 本地版本比较验证
- "跳过此版本"选项
- 下载完整性校验（支持 SHA256）
- 更友好的进度显示
- 安装前确认对话框
- 多下载源支持（可扩展）

**改进：**
- 更健壮的错误处理
- 断点续传支持
- 用户体验优化

## 新增依赖

```json
{
  "dependencies": {
    "yauzl": "^3.1.3",
    "adm-zip": "^0.5.10"
  }
}
```

## 文件结构

```
ASG.Director/
├── main.js                 # 主进程（已更新）
├── preload.js              # 预加载脚本（已更新）
├── updater.js              # 旧更新模块（保留）
├── updater-v2.js           # 新更新模块
└── utils/
    ├── archive.js          # 压缩解压模块
    ├── downloader.js       # 下载工具模块
    └── packManager.js      # 布局包管理模块
```

## API 变更

### 渲染进程 API

```javascript
// 应用更新
electronAPI.checkForUpdate()      // 检查更新
electronAPI.manualCheckUpdate()   // 手动检查更新（显示对话框）
electronAPI.getAppVersion()       // 获取当前版本

// 布局包（无变化）
electronAPI.exportBpPack()
electronAPI.importBpPack()
electronAPI.resetLayout()
```

## 迁移指南

1. **安装新依赖：**
   ```bash
   cd ASG.Director
   npm install yauzl adm-zip
   ```

2. **重新构建应用：**
   ```bash
   npm run build:win
   ```

## 故障排除

### 解压失败

如果遇到解压失败，模块会自动尝试以下备用方案：
1. yauzl 库
2. adm-zip 库
3. Windows tar 命令
4. .NET ZipFile API

### 下载失败

- 自动重试最多3次
- 支持断点续传
- 提供"在浏览器中下载"备选方案

### 更新检查失败

- 检查网络连接
- 检查 API 服务是否可用
- 查看控制台日志获取详细错误信息

## 注意事项

1. 旧版 `updater.js` 保留用于兼容，但主程序已切换到 `updater-v2.js`
2. 所有临时文件会在操作完成后自动清理
3. 布局包格式不变，仍使用 `.bppack` 扩展名（实际为 ZIP 格式）

## 版本历史

- **v1.2.0** - 重构组件包功能，移除 PowerShell 依赖
- **v1.1.0** - 添加布局包商店功能
- **v1.0.0** - 初始版本
