# Idvevent Director 新手引导系统

## 概述

Idvevent Director 新手引导系统为首次使用的用户提供交互式教程，重点帮助用户走完一条完整工作流：

- **本地 BP 模式** - 作为整场导播的主控入口
- **自定义页面（OBS）** - 直接输出 BP 前台、比分板、角色展示等浏览器源 URL
- **OBS 侧边栏** - 通过自定义浏览器停靠栏挂入 OBS BP 控制和 OBS 自动化侧边栏
- **3D 角色展示** - 打开独立 3D 窗口并交给 OBS 窗口捕获

## 文件说明

### `onboarding.js`
主页面 (`main.html`) 的新手引导脚本，包含：
- 流程化的新手教程（从本地 BP 到 OBS）
- 通过按钮直接打开本地 BP 教程窗口
- OBS 浏览器源操作说明
- OBS 自定义浏览器停靠栏操作说明
- 在主页面教程弹窗中直接插入网络图片
- 3D 角色展示入口说明
- **3D 角色展示专属教程**（`startModel3DTutorial`，同时兼容 `startMMDTutorial`）

### `frontend-onboarding.js`
前台页面 (`frontend.html`) 的编辑模式引导脚本，包含：
- F2 编辑模式切换说明
- 组件拖拽与缩放操作
- 右键菜单功能介绍
- 布局保存与导出

### `localbp-onboarding.js`
本地 BP 控制台 (`local-bp.html`) 的专属引导脚本，包含：
- BP 控制面板使用方法
- 对局基础信息设置
- 天赋与技能配置
- 比分管理功能
- 赛后数据录入

## 使用方法

### 自动触发
- 用户首次打开应用时自动显示主页面教程
- 是否自动显示由 `OKTeach.txt` 控制；完成或跳过后会在用户数据目录写入该文件
- 当前步骤仍保存在 `localStorage`

### 手动触发
- **主页面引导**：点击侧边栏底部的 ❓ 帮助按钮
- **本地 BP 引导**：点击顶部菜单栏的 ❓ 帮助按钮
- **3D 角色展示专属教程**：在控制台执行 `ASGOnboarding.startModel3DTutorial()`
- **前台引导**：首次打开前台窗口时自动触发

### 开发者调试
```javascript
// 重置主页引导
ASGOnboarding.reset()
ASGOnboarding.forceStart()

// 启动 3D 角色展示专属教程
ASGOnboarding.startModel3DTutorial()

// 兼容旧调用名
ASGOnboarding.startMMDTutorial()

// 重置前台引导
FrontendOnboarding.forceStart()

// 重置本地 BP 引导
LocalBPOnboarding.reset()
LocalBPOnboarding.forceStart()
```

## 存储 Key

| Key | 说明 |
|-----|------|
| `asg_onboarding_completed` | 主页面引导完成状态 |
| `asg_onboarding_current_step` | 主页面引导当前步骤 |
| `asg_frontend_onboarding_completed` | 前台编辑引导完成状态 |
| `asg_localbp_onboarding_completed` | 本地 BP 引导完成状态 |

## 自定义

### 添加新步骤
在 `steps` 数组中添加新对象：

```javascript
{
  id: 'step-id',           // 唯一标识
  title: '步骤标题 🎉',     // 支持 emoji
  content: `<p>HTML内容</p>`, // 支持 HTML
  target: '#element-id',   // 可选，高亮的目标元素选择器
  position: 'bottom',      // 可选，卡片相对于目标的位置：top/bottom/left/right/center
  highlight: true          // 可选，是否高亮目标元素
}
```

### 样式定制
所有样式都内联在引导脚本中，可直接修改 CSS 变量和类名。

## 设计特点

1. **流程优先** - 主教程围绕“控制 BP -> 交给 OBS -> 挂侧边栏 -> 打开 3D”展开
2. **高亮聚焦** - 聚光灯效果突出真实入口元素
3. **跨视图导航** - 教程步骤会自动切到首页或设置中心对应区域
4. **断点续航** - 中断后可继续上次进度
5. **响应式** - 自动适配不同屏幕尺寸
