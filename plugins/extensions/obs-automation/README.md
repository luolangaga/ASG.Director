# OBS 自动化插件

🎬 为 ASG.Director 提供 OBS WebSocket 自动化控制功能，支持根据 BP 事件、比赛事件自动切换 OBS 场景。

## ✨ 功能特点

- **OBS WebSocket 5.x 支持** - 完整支持 OBS WebSocket 5.x 协议
- **事件驱动自动化** - 监听 BP、比赛、房间等各种事件
- **可视化规则配置** - 图形化界面配置自动化规则
- **延迟执行** - 支持操作延迟，实现精准的时间控制
- **多种操作类型** - 场景切换、文本设置、推流录制控制等
- **变量模板** - 支持在操作参数中使用动态变量

## 📦 安装

### 方法一：直接安装（推荐）

1. 确保插件文件在 `ASG.Director/plugins/obs-automation` 目录
2. 打开终端，运行安装命令：
   ```powershell
   cd "C:\Users\luolan\ASG\ASG.Director\plugins\obs-automation"
   npm install
   ```
3. 重启 ASG.Director
4. 插件会自动加载并在主页显示卡片

### 方法二：开发目录安装

1. 将 `obs-automation` 文件夹复制到 ASG.Director 的 `plugins` 目录
2. 在插件目录运行 `npm install`
3. 重启 ASG.Director

**注意：** 插件需要 `ws` (WebSocket) 依赖，必须先运行 `npm install` 安装依赖。

## 🔧 OBS 设置

1. 打开 OBS Studio
2. 菜单 -> 工具 -> WebSocket 服务器设置
3. 勾选"启用 WebSocket 服务器"
4. 设置端口（默认 4455）和密码
5. 点击确定

## 🎯 支持的触发事件

### BP 事件
| 事件 | 说明 |
|------|------|
| `bp:started` | BP 开始时触发 |
| `bp:ended` | BP 结束时触发 |
| `bp:hunter-selected` | 监管者选择完成时触发 |
| `bp:survivor-selected` | 每个求生者选择时触发 |
| `bp:all-survivors-selected` | 所有求生者选择完成时触发 |
| `bp:character-banned` | 角色被 Ban 时触发 |
| `bp:round-changed` | 回合变化时触发 |

### 比赛事件
| 事件 | 说明 |
|------|------|
| `match:started` | 比赛开始时触发 |
| `match:ended` | 比赛结束时触发 |
| `match:score-updated` | 比分更新时触发 |
| `match:map-changed` | 地图变化时触发 |

### 房间事件
| 事件 | 说明 |
|------|------|
| `room:connected` | 连接到房间时触发 |
| `room:disconnected` | 断开房间连接时触发 |
| `room:updated` | 房间数据更新时触发 |

## 🎬 支持的操作类型

| 操作 | 说明 | 参数 |
|------|------|------|
| `switch-scene` | 切换场景 | `sceneName` - 场景名称 |
| `delay` | 延迟等待 | `duration` - 毫秒数 |
| `set-text` | 设置文本源 | `sourceName`, `text` |
| `set-image` | 设置图像源 | `sourceName`, `file` - 文件路径 |
| `set-browser-url` | 设置浏览器源 URL | `sourceName`, `url` |
| `refresh-browser` | 刷新浏览器源 | `sourceName` |
| `set-source-settings` | **[新]** 通用源设置修改 | `sourceName`, `settings` - 设置对象, `overlay` - 是否覆盖（可选） |
| `set-source-transform` | **[新]** 设置源变换属性 | `sceneName`, `sourceName`/`sceneItemId`, `transform` - 变换对象 |
| `set-filter-settings` | **[新]** 设置滤镜属性 | `sourceName`, `filterName`, `settings` |
| `set-filter-enabled` | **[新]** 启用/禁用滤镜 | `sourceName`, `filterName`, `enabled` |
| `start-stream` | 开始推流 | - |
| `stop-stream` | 停止推流 | - |
| `start-record` | 开始录制 | - |
| `stop-record` | 停止录制 | - |

## 📝 示例规则

### 监管者选完后切换场景
```json
{
  "name": "监管者选完切场景",
  "triggerType": "bp:hunter-selected",
  "actions": [
    { "type": "delay", "params": { "duration": 3000 } },
    { "type": "switch-scene", "params": { "sceneName": "游戏场景" } }
  ]
}
```

### 所有求生者选完后切换
```json
{
  "name": "求生者选完切场景",
  "triggerType": "bp:all-survivors-selected",
  "actions": [
    { "type": "delay", "params": { "duration": 2000 } },
    { "type": "switch-scene", "params": { "sceneName": "游戏场景" } }
  ]
}
```

### 比赛开始时更新文本
```json
{
  "name": "比赛开始更新标题",
  "triggerType": "match:started",
  "actions": [
    { "type": "set-text", "params": { "sourceName": "比赛标题", "text": "{{matchTeamA}} vs {{matchTeamB}}" } },
    { "type": "switch-scene", "params": { "sceneName": "比赛场景" } }
  ]
}
```
```json
{
  "name": "比赛开始更新标题",
  "triggerType": "match:started",
  "actions": [
    { "type": "set-text", "params": { "sourceName": "比赛标题", "text": "{{matchTitle}}" } },
    { "type": "set-text", "params": { "sourceName": "比分显示", "text": "{{matchScore}}" } },
    { "type": "switch-scene", "params": { "sceneName": "比赛场景" } }
  ]
}
```

### ✨ 新功能示例

#### 显示 BP 角色信息
```json
{
  "name": "更新 BP 角色显示",
  "triggerType": "bp:hunter-selected",
  "actions": [
    { 
      "type": "set-text", 
      "params": { 
        "sourceName": "监管者文本", 
        "text": "监管者: {{bpHunter}}" 
      } 
    },
    { 
      "type": "set-text", 
      "params": { 
        "sourceName": "求生者文本", 
        "text": "求生者: {{bpSurvivorsText}}" 
      } 
    }
  ]
}
```

#### 设置角色头像图片
```json
{
  "name": "显示角色头像",
  "triggerType": "bp:hunter-selected",
  "actions": [
    { 
      "type": "set-image", 
      "params": { 
        "sourceName": "监管者头像", 
        "file": "D:/OBS/Characters/{{bpHunter}}.png" 
      } 
    }
  ]
}
```

#### 通用源设置修改（文本颜色）
```json
{
  "name": "修改文本样式",
  "triggerType": "bp:hunter-selected",
  "actions": [
    { 
      "type": "set-source-settings", 
      "params": { 
        "sourceName": "标题文本",
        "settings": {
          "color": 4294901760,
          "font": {
            "size": 72,
            "face": "微软雅黑"
          }
        }
      } 
    }
  ]
}
```

#### 源变换（移动和缩放）
```json
{
  "name": "移动角色卡片",
  "triggerType": "bp:survivor-selected",
  "actions": [
    { 
      "type": "set-source-transform", 
      "params": { 
        "sceneName": "BP场景",
        "sourceName": "求生者1",
        "transform": {
          "positionX": 100,
          "positionY": 200,
          "scaleX": 1.5,
          "scaleY": 1.5,
          "rotation": 0
        }
      } 
    }
  ]
}
```

#### 启用/禁用滤镜
```json
{
  "name": "启用模糊滤镜",
  "triggerType": "match:started",
  "actions": [
    { 
      "type": "set-filter-enabled", 
      "params": { 
        "sourceName": "背景图",
        "filterName": "模糊",
        "enabled": true
      } 
    }
  ]
}
```


## 🔤 变量模板

在操作参数中可以使用 `{{变量名}}` 语法插入动态内容：

### BP 相关变量
| 变量 | 说明 |
|------|------|
| `{{bpHunter}}` | 当前选择的监管者 |
| `{{bpSurvivors}}` | 当前选择的求生者数组 |
| `{{bpSurvivors.0}}` - `{{bpSurvivors.3}}` | **[新]** 单个求生者（索引访问） |
| `{{bpSurvivorsText}}` | **[新]** 求生者列表文本（逗号分隔） |
| `{{bpBannedSurvivors}}` | 禁用的求生者数组 |
| `{{bpBannedSurvivorsText}}` | **[新]** 禁用求生者文本 |
| `{{bpBannedHunters}}` | 禁用的监管者数组 |
| `{{bpBannedHuntersText}}` | **[新]** 禁用监管者文本 |
| `{{bpRound}}` | **[新]** 当前回合数 |
| `{{bpTeamA}}`, `{{bpTeamB}}` | **[新]** 队伍名称 |

### 比赛相关变量
| 变量 | 说明 |
|------|------|
| `{{matchTeamA}}`, `{{matchTeamB}}` | 队伍名称 |
| `{{matchScoreA}}`, `{{matchScoreB}}` | 队伍比分 |
| `{{matchScore}}` | **[新]** 格式化比分（如 "2:1"） |
| `{{matchTitle}}` | **[新]** 比赛标题（如 "队伍A vs 队伍B"） |
| `{{matchScoreText}}` | **[新]** 完整比分文本 |
| `{{matchMap}}` | 当前地图 |
| `{{matchRound}}` | **[新]** 当前回合 |

### 房间相关变量
| 变量 | 说明 |
|------|------|
| `{{roomId}}` | **[新]** 房间 ID |
| `{{roomName}}` | **[新]** 房间名称 |
| `{{roomStatus}}` | **[新]** 房间状态 |

### 通用变量
| 变量 | 说明 |
|------|------|
| `{{timestamp}}` | 当前时间戳 |
| `{{eventData.xxx}}` | 事件数据中的任意字段 |

> 📚 **查看完整变量参考**：[VARIABLES.md](VARIABLES.md) - 包含所有变量的详细说明、类型、示例值和使用场景。


## 🔌 插件 API

其他插件可以通过 API 调用此插件的功能：

```javascript
// 获取插件实例
const obsPlugin = await api.plugins.getExports('obs-automation')

// 连接 OBS
await obsPlugin.connect({ host: 'localhost', port: 4455, password: '' })

// 检查连接状态
const isConnected = obsPlugin.isConnected()

// 切换场景
await obsPlugin.switchScene('游戏场景')

// 获取场景列表
const scenes = await obsPlugin.getSceneList()

// 添加自动化规则
obsPlugin.addRule({
  name: '自定义规则',
  triggerType: 'bp:hunter-selected',
  actions: [
    { type: 'switch-scene', params: { sceneName: '游戏场景' } }
  ]
})

// 手动触发事件
obsPlugin.triggerEvent('bp:hunter-selected', { hunter: '红蝶' })

// 获取 OBS 原始实例（高级用法）
const obs = obsPlugin.getOBS()
await obs.request('GetVersion')
```

## 📋 更新日志

### v1.1.0

**新功能**
- ✨ 添加通用源设置修改操作 (`SET_SOURCE_SETTINGS`)
- ✨ 添加源变换属性操作 (`SET_SOURCE_TRANSFORM`) - 支持位置、大小、旋转等
- ✨ 添加滤镜设置和控制操作 (`SET_FILTER_SETTINGS`, `SET_FILTER_ENABLED`)
- ✨ 大幅增强 BP 数据变量系统
  - 数组索引访问：`{{bpSurvivors.0}}` - `{{bpSurvivors.3}}`
  - 格式化文本：`{{bpSurvivorsText}}`, `{{bpBannedSurvivorsText}}` 等
  - 队伍信息：`{{bpTeamA}}`, `{{bpTeamB}}`
- ✨ 增强比赛变量系统
  - 格式化比分：`{{matchScore}}` (如 "2:1")
  - 比赛标题：`{{matchTitle}}` (如 "队伍A vs 队伍B")
  - 完整比分文本：`{{matchScoreText}}`
- ✨ 添加房间相关变量：`{{roomId}}`, `{{roomName}}`, `{{roomStatus}}`

**文档更新**
- 📝 更新操作类型说明，添加新功能示例
- 📝 扩展变量模板文档
- 📝 新增 [VARIABLES.md](VARIABLES.md) 完整变量参考文档

### v1.0.0
- 初始版本
- OBS WebSocket 5.x 支持
- BP/比赛/房间事件监听
- 可视化规则配置
- 延迟执行支持


## 🐛 问题反馈

如遇到问题，请在 ASG 社区反馈或提交 Issue。

## 📄 许可证

MIT License
