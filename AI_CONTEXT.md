# ASG.Director 项目速览（AI专用）

- 目标：基于 Electron 的“第五人格赛事导播端”，为 OBS 直播提供 BP 展示、比分板与赛后数据等可视化窗口
- 核心：主进程创建多个渲染窗口（前台、后台、比分板、地图展示、赛后数据等），渲染端通过 preload 暴露的安全 API 与主进程通信

## 技术与运行
- 技术栈：Electron 28+，原生 HTML/CSS/JS，SignalR（与 ASG.Api 通信）
- 开发运行：`npm start` 或 `npm run dev`
- 打包：`npm run build:win` / `npm run build:mac`
- 主进程入口：[main.js](file:///c:/Users/luolan/ASG/ASG.Director/main.js)，预加载脚本：[preload.js](file:///c:/Users/luolan/ASG/ASG.Director/preload.js)
- 依赖与构建配置：[package.json](file:///c:/Users/luolan/ASG/ASG.Director/package.json)

## 目录速览
- 页面与逻辑：[pages](file:///c:/Users/luolan/ASG/ASG.Director/pages)
  - 主窗口：[main.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/main.html)；逻辑：[main-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/main-logic.js)
  - 前台窗口（OBS 捕获）：[frontend.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/frontend.html)；逻辑：[frontend-main.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/frontend-main.js)
  - 后台管理：[backend.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/backend.html)；逻辑：[backend-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/backend-logic.js)
  - 本地 BP 系统：[local-bp.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/local-bp.html)；逻辑：[local-bp-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/local-bp-logic.js)
  - 比分板：[scoreboard.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/scoreboard.html)；逻辑：[scoreboard-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/scoreboard-logic.js)
  - 总览比分板：[scoreboard-overview.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/scoreboard-overview.html)；逻辑：[scoreboard-overview-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/scoreboard-overview-logic.js)
  - 赛后数据：[postmatch.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/postmatch.html)；逻辑：[postmatch-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/postmatch-logic.js)
  - 插件管理与商店：[plugins.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/plugins.html)、[plugin-store.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/plugin-store.html)
- 静态资源：图标与角色/地图图片在 [assets](file:///c:/Users/luolan/ASG/ASG.Director/assets)
- 插件系统：核心位于 [plugins/core](file:///c:/Users/luolan/ASG/ASG.Director/plugins/core)，启动与桥接在 [plugins/bootstrap.js](file:///c:/Users/luolan/ASG/ASG.Director/plugins/bootstrap.js)
- 工具/脚本：见 [utils](file:///c:/Users/luolan/ASG/ASG.Director/utils)、[scripts](file:///c:/Users/luolan/ASG/ASG.Director/scripts)

## 主进程窗口与流程
- 主窗口：[createMainWindow](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L274-L304) 显示入口与房间创建
- 前台窗口（OBS 捕获）：[createFrontendWindow](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L381-L486) 透明无边框，可拖拽组件，自动保存尺寸
- 后台窗口：管理 BP 流程与控制前台 [createBackendWindow](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L488-L512)
- 地图展示弹窗：[createMapDisplayWindow](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L514-L548) 供 OBS 捕获瞬时地图变化
- 比分板窗口：[createScoreboardWindow](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L550-L603)（A/B 队）
- 总览比分板：[createScoreboardOverviewWindow](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L605-L649)
- 赛后数据窗口：[createPostMatchWindow](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L651-L694)
- 房间创建与打开 BP：`ipcMain.handle('create-room')`、`ipcMain.handle('open-bp-windows')` [main.js](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L699-L722)

## 预加载 API（渲染端可用）
- 暴露对象：`window.electronAPI` 与 `window.plugins` [preload.js](file:///c:/Users/luolan/ASG/ASG.Director/preload.js#L85-L268)
- 关键接口（示例）：
  - 房间与窗口：`createRoom`、`openBpWindows`、`closeBpWindows`、`openScoreboard`、`openPostMatch`
  - 布局持久化：`saveLayout`、`loadLayout`、`exportLayout`、`importLayout`
  - 比分板/总览/赛后布局：`getScoreboardLayout`、`saveScoreboardLayout`、`getScoreboardOverviewLayout`、`saveScoreboardOverviewLayout`、`getPostMatchLayout`、`savePostMatchLayout`
  - 前台控制：`setFrontendAlwaysOnTop`、`setFrontendFullscreen`、`toggleFrontendEditMode`、`resizeWindow`
  - 背景与资源：`selectBackground`、`selectOverviewTexture`、`selectCharacterDisplayBackground`
  - 字体管理：`selectCustomFont`、`getCustomFonts`、`saveFontConfig`、`onCustomFontsChanged`
  - 环境/商店/插件：`getEnvironment`、`switchEnvironment`、`openStore`、`openPluginStore`、`openPluginManager`

## 状态与存储
- 用户数据目录：`app.getPath('userData')`
- 布局文件：`layout.json`（窗口尺寸、透明背景、scoreboardLayouts、scoreboardOverviewLayout、postMatchLayout 等）[main.js 保存/读取](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L754-L819)
- 背景图片目录：`background/`（导入/选择背景时复制到该目录）
- 透明背景开关：`set-transparent-background` 与渲染端刷新 [main.js](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L988-L1027)

## 环境与服务
- 开发/生产环境切换：`API_CONFIG` 与 `switch-environment` [main.js](file:///c:/Users/luolan/ASG/ASG.Director/main.js#L204-L247)
- 与 ASG.Api 通信：SignalR（在 [pages/js/signalr.min.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/signalr.min.js)；按 README 放置）

## 本地 BP 重点
- 页面：[local-bp.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/local-bp.html)；逻辑：[local-bp-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/local-bp-logic.js)
- 常用控件与操作按钮位于页面底部区；例如“开始引导”按钮触发引导流程
- 状态广播：主进程通过 `win.webContents.send('update-data', …)` 推送状态，渲染端通过 `onLocalBpStateUpdate` 订阅

## 插件系统速览
- 渲染暴露：`window.plugins` 提供插件管理/组件/事件等接口 [preload.js](file:///c:/Users/luolan/ASG/ASG.Director/preload.js#L18-L68)
- 管理窗口与商店：从主进程打开 [plugins.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/plugins.html)、[plugin-store.html](file:///c:/Users/luolan/ASG/ASG.Director/pages/plugin-store.html)
- 主进程集成：见 [plugins/bootstrap.js](file:///c:/Users/luolan/ASG/ASG.Director/plugins/bootstrap.js) 与 core 目录

## OBS 捕获要点
- 捕获窗口：选择“导播 - 前台”（透明背景可叠加）
- 编辑模式：前台按 F2 切换编辑，支持拖拽与尺寸调整

## 快速定位
- 主进程：错误/日志桥接与所有 IPC 入口在 [main.js](file:///c:/Users/luolan/ASG/ASG.Director/main.js)
- 渲染端：统一通过 [preload.js](file:///c:/Users/luolan/ASG/ASG.Director/preload.js) 暴露 API
- 前台逻辑：布局保存与组件编辑在 [frontend-main.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/frontend-main.js)
- 后台逻辑：流程控制与房间数据在 [backend-logic.js](file:///c:/Users/luolan/ASG/ASG.Director/pages/js/backend-logic.js)
- 比分板与总览：见对应 HTML 与 logic.js

## 常用脚本
- 开发：`npm start`
- 构建：`npm run build:win`、`npm run build:mac`
- 资源优化与包分析：`npm run optimize:images`、`npm run analyze:bundle`

