# ASG.Director 自动更新功能

## 功能概述

本功能实现了 ASG.Director 应用的自动更新检测和版本管理系统，包含三个部分：

1. **后端API** (ASG.Api) - 版本数据存储和管理接口
2. **管理后台** (ASG.Admin) - 版本管理界面，支持智能版本号自增
3. **客户端** (ASG.Director) - 启动时自动检测更新

---

## 1. 后端 API

### 数据模型

文件: [ASG.Api/Models/AppVersion.cs](ASG.Api/Models/AppVersion.cs)

```csharp
public class AppVersion
{
    public int Id { get; set; }
    public string AppName { get; set; }        // 应用名称 (ASG.Director, ASG.Web 等)
    public string Version { get; set; }         // 版本号 (如 1.2.3)
    public int Major { get; set; }              // 主版本号
    public int Minor { get; set; }              // 次版本号
    public int Patch { get; set; }              // 修订号
    public string DownloadUrl { get; set; }     // 下载地址
    public string ReleaseNotes { get; set; }    // 更新日志
    public bool ForceUpdate { get; set; }       // 是否强制更新
    public string MinimumVersion { get; set; }  // 最低兼容版本
    public long? FileSize { get; set; }         // 文件大小
    public string FileMd5 { get; set; }         // MD5 校验
    public DateTime PublishedAt { get; set; }   // 发布时间
    public bool IsActive { get; set; }          // 是否启用
}
```

### API 端点

文件: [ASG.Api/Controllers/AppVersionsController.cs](ASG.Api/Controllers/AppVersionsController.cs)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/app-versions/check` | 检查更新 | 公开 |
| GET | `/api/app-versions/latest/{appName}` | 获取最新版本 | 公开 |
| GET | `/api/app-versions/apps` | 获取应用列表 | 公开 |
| GET | `/api/app-versions` | 获取版本列表 | 管理员 |
| GET | `/api/app-versions/{id}` | 获取版本详情 | 管理员 |
| POST | `/api/app-versions` | 创建版本 | 管理员 |
| POST | `/api/app-versions/quick-release` | 快速发布 | 管理员 |
| PUT | `/api/app-versions/{id}` | 更新版本 | 管理员 |
| DELETE | `/api/app-versions/{id}` | 删除版本 | 管理员 |
| GET | `/api/app-versions/next-version` | 预览下一版本号 | 管理员 |

### 检查更新接口示例

**请求:**
```
GET /api/app-versions/check?appName=ASG.Director&currentVersion=1.0.0
```

**响应:**
```json
{
  "hasUpdate": true,
  "forceUpdate": false,
  "currentVersion": "1.0.0",
  "latestVersion": "1.1.0",
  "downloadUrl": "https://example.com/download/ASG.Director-1.1.0-setup.exe",
  "releaseNotes": "- 新增自动更新功能\n- 修复若干问题",
  "fileSize": 52428800,
  "publishedAt": "2025-12-17T10:00:00Z"
}
```

---

## 2. 管理后台 (ASG.Admin)

### 功能入口

在管理后台左侧菜单「系统管理」分类下新增「版本管理」入口。

文件: [ASG.Admin/src/views/AppVersionsView.vue](ASG.Admin/src/views/AppVersionsView.vue)

### 主要功能

#### 2.1 版本列表
- 查看所有版本记录
- 按应用筛选
- 分页显示

#### 2.2 新建版本
- 选择应用名称
- **智能版本号自增**:
  - 开启「自动自增版本号」选项
  - 选择增量类型: Patch (x.x.+1), Minor (x.+1.0), Major (+1.0.0)
  - 系统自动计算下一个版本号
- 填写下载地址、更新说明
- 设置强制更新、最低兼容版本等

#### 2.3 快速发布
- 一键发布新版本
- 自动基于最新版本递增版本号
- 可复用上一版本的下载地址

#### 2.4 编辑/删除版本
- 修改版本信息
- 启用/禁用版本
- 删除版本

---

## 3. 客户端 (ASG.Director)

### 更新模块

文件: [ASG.Director/updater.js](ASG.Director/updater.js)

### 功能特性

#### 3.1 启动时自动检测
- 应用启动后自动检查更新
- 发现更新时弹出对话框提示用户

#### 3.2 更新对话框
- 显示新版本号和当前版本
- 显示更新说明
- 显示文件大小
- 提供「立即更新」和「稍后提醒」选项

#### 3.3 强制更新
- 如果服务器标记为强制更新，用户必须更新才能继续使用
- 强制更新对话框只有「立即更新」按钮
- 关闭对话框会退出应用

#### 3.4 手动检查更新
- 主界面显示当前版本号
- 提供「检查更新」按钮
- 发现更新后按钮变为「发现新版本 x.x.x」

### 界面位置

在主界面标题下方显示版本信息栏：
- 当前版本号
- 检查更新按钮
- 发现更新时按钮高亮显示

---

## 使用流程

### 发布新版本

1. 登录 ASG.Admin 管理后台
2. 进入「系统管理」→「版本管理」
3. 点击「快速发布」或「新建版本」
4. 选择应用 `ASG.Director`
5. 选择版本增量类型 (通常选 Patch)
6. 填写下载地址（上传安装包后的链接）
7. 填写更新说明
8. 如需强制用户更新，勾选「强制更新」
9. 点击「发布」

### 版本号管理

ASG.Director 的版本号自动从 `package.json` 读取，你有两种更新版本号的方式：

#### 方式一：手动修改 (适合小版本)
```json
// ASG.Director/package.json
{
  "version": "1.0.1"  // 直接修改此处
}
```

#### 方式二：自动同步脚本 (推荐用于 CI/CD)
提供了 `version-sync.js` 脚本，自动将后端最新版本同步到 `package.json`：

```bash
# 开发环境
npm run sync-version

# 生产环境
npm run sync-version:prod
```

**工作原理:**
1. 脚本调用 `/api/app-versions/latest/ASG.Director` 获取后端最新版本
2. 自动更新本地 `package.json` 的版本号
3. 然后运行 `npm run build:win` 构建安装包
4. 生成的安装包版本号与后端最新版本保持同步

**完整的 CI/CD 工作流:**
```bash
# 1. 在后台发布新版本（如 1.0.1）
# 在 ASG.Admin 中快速发布

# 2. 同步版本号
npm run sync-version

# 3. 构建应用
npm run build:win

# 4. 上传安装包，在后台更新下载链接
```

### 用户更新流程

1. 用户启动 ASG.Director
2. 应用自动检测更新
3. 如有更新，弹出更新对话框
4. 用户点击「立即更新」
5. 浏览器打开下载链接
6. 用户下载安装包
7. 关闭应用，运行安装包更新

### 下载地址建议

可以使用以下方式托管安装包：
- GitHub Releases
- 阿里云 OSS / 腾讯云 COS
- 自建文件服务器
- ASG.Api 的文件上传接口 (`/api/files`)

---

## 文件清单

### 后端
- `ASG.Api/Models/AppVersion.cs` - 版本数据模型
- `ASG.Api/Controllers/AppVersionsController.cs` - API 控制器
- `ASG.Api/Data/ApplicationDbContext.cs` - 数据库上下文 (已添加 DbSet)
- `ASG.Api/Configuration/DatabaseInitializer.cs` - 数据库初始化 (已添加建表)

### 管理后台
- `ASG.Admin/src/services/appVersions.js` - API 调用服务
- `ASG.Admin/src/views/AppVersionsView.vue` - 版本管理页面
- `ASG.Admin/src/router/index.js` - 路由配置 (已添加)
- `ASG.Admin/src/App.vue` - 导航菜单 (已添加入口)

### 客户端
- `ASG.Director/updater.js` - 更新检测模块
- `ASG.Director/main.js` - 主进程 (已集成更新检测)
- `ASG.Director/preload.js` - 预加载脚本 (已添加 API)
- `ASG.Director/pages/main.html` - 主界面 (已添加版本显示)

---

## 注意事项

1. **首次使用需启动后端**: 确保 ASG.Api 正常运行，数据库会自动创建 `AppVersions` 表

2. **版本号格式**: 使用语义化版本 (Semantic Versioning): `主版本.次版本.修订号`
   - Major: 不兼容的 API 修改
   - Minor: 向下兼容的功能性新增
   - Patch: 向下兼容的问题修正

3. **下载地址**: 建议使用 HTTPS 链接，确保下载安全

4. **强制更新**: 谨慎使用，仅在重大安全更新或破坏性变更时启用

5. **测试建议**: 在开发环境先测试更新流程，确保下载链接有效后再发布到生产环境
