# Idvevent 导播端（ASG.Director）

面向《第五人格》赛事直播的本地导播工具，基于 Electron 开发。

> 正式版在gitee分发：[Gitee 3.1.3](https://gitee.com/luolangaga/asg-director/releases/download/11/Idvevent%E5%AF%BC%E6%92%AD%E7%AB%AF%20Setup%203.1.3.exe).
> 及时编译版在GitHub Release下载

## 当前版本重点

本项目已升级为以**本地 BP 导播**为核心的工作流，开箱即用，适合 OBS 直播、录播和复盘场景。

### 核心能力

- 本地 BP 流程控制（单机快速开局）
- 前台展示窗口（适配 OBS 捕获）
- 比分板与总览比分板
- 赛后数据展示页
- 地图展示页
- 角色展示与字体自定义
- 布局自动保存、导入、导出、重置
- 插件系统与插件商店
- 自定义页面映射（本地 HTML → OBS 可用 URL）
- AI 生成单页 HTML（可直接加入本地页面列表）

## 安装与运行

```bash
# 安装依赖
npm install

# 开发启动
npm run dev
# 或
npm start

# 构建
npm run build:win   # Windows
npm run build:mac   # macOS
```

## 推荐使用流程（本地 BP）

1. 启动程序进入「本地 BP」。
2. 打开前台展示窗口并在 OBS 中添加窗口捕获或浏览器源。
3. 根据赛事需求调整布局（位置、字体、背景、组件）。
4. 在比分管理与赛后数据页面录入内容并实时展示。
5. 通过导出布局功能沉淀模板，供后续赛事复用。

## OBS 使用建议

- 优先使用浏览器源（更稳定、占用更低）
- 常用页面可映射为本地 URL 后直接粘贴到 OBS
- 如果使用透明背景窗口，按实际画面增加色键/遮罩滤镜

## 项目结构（简版）

```text
ASG.Director/
├─ main.js                 # Electron 主进程
├─ preload.js              # 渲染进程安全桥
├─ pages/                  # 各功能页面（前台/比分板/赛后/地图等）
├─ plugins/                # 插件系统
├─ utils/                  # 布局包、下载、校验等工具
├─ assets/                 # 图标与静态资源
└─ scripts/                # 构建与资源处理脚本
```

## 说明

- 本仓库 README 仅保留当前主流程与常用功能说明。
- 如需赛事合作或反馈问题，可通过官网联系。
