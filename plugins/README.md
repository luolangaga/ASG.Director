# ASG.Director 插件开发指南 🚀

欢迎来到 ASG.Director 插件系统！本指南将带你从零开始开发一个完整的插件。

## 📋 目录

- [快速开始](#快速开始)
- [完整开发流程](#完整开发流程)
- [插件 API 详解](#插件-api-详解)
- [实战示例](#实战示例)
- [常见问题](#常见问题)

---

## 快速开始

### 5分钟创建你的第一个插件

```bash
# 1. 在任意位置创建插件项目（不要在 ASG.Director 项目内！）
mkdir my-first-plugin
cd my-first-plugin

# 2. 创建 package.json
cat > package.json << 'EOF'
{
  "name": "my-first-plugin",
  "displayName": "我的第一个插件",
  "description": "这是一个测试插件",
  "version": "1.0.0",
  "author": "你的名字",
  "main": "index.js",
  "engines": {
    "asg-director": ">=1.4.0"
  },
  "activationEvents": ["onStartup"],
  "contributes": {
    "commands": [{
      "command": "myPlugin.hello",
      "title": "我的插件：打招呼"
    }]
  }
}
EOF

# 3. 创建 index.js
cat > index.js << 'EOF'
async function activate(context) {
  const { api, log } = context
  
  log('我的第一个插件已激活！')
  
  // 注册命令
  api.commands.registerCommand('myPlugin.hello', async () => {
    api.notifications.showInfo('你好，ASG.Director！', {
      title: '我的第一个插件',
      duration: 3000
    })
  })
  
  return {
    sayHello() {
      return '你好，世界！'
    }
  }
}

function deactivate() {
  console.log('插件已停用')
}

module.exports = { activate, deactivate }
EOF

# 4. 安装到用户目录进行测试
# Windows
xcopy /E /I . "%APPDATA%\asg-director\plugins\my-first-plugin"

# macOS
cp -r . ~/Library/Application\ Support/asg-director/plugins/my-first-plugin

# Linux
cp -r . ~/.config/asg-director/plugins/my-first-plugin

# 5. 启动 ASG.Director，你的插件就会被自动加载！
```

---

## 完整开发流程

### 1. 项目结构设计

一个标准的插件项目结构：

```
my-awesome-plugin/           # 独立的 Git 仓库
├── package.json             # 插件清单（必需）
├── index.js                 # 入口文件（必需）
├── README.md                # 说明文档
├── LICENSE                  # 许可证
├── .gitignore
├── src/                     # 源代码目录
│   ├── commands/            # 命令实现
│   ├── views/               # 视图组件
│   └── utils/               # 工具函数
├── assets/                  # 资源文件
│   ├── icons/
│   └── styles/
└── test/                    # 测试代码
    └── test.js
```

### 2. package.json 配置详解

```json
{
  "name": "my-plugin",                    // 插件ID（必需，全局唯一）
  "displayName": "我的插件",              // 显示名称
  "description": "插件描述",              // 简短描述
  "version": "1.0.0",                     // 版本号（必需）
  "author": "你的名字 <email@example.com>",
  "license": "MIT",
  "main": "index.js",                     // 入口文件（必需）
  
  "engines": {
    "asg-director": ">=1.4.0"             // 最低兼容版本
  },
  
  "activationEvents": [                   // 激活时机
    "onStartup",                          // 应用启动时
    "onCommand:myPlugin.doSomething",     // 执行特定命令时
    "onEvent:match.start"                 // 特定事件发生时
  ],
  
  "contributes": {                        // 扩展点声明
    "commands": [                         // 命令贡献
      {
        "command": "myPlugin.openPanel",
        "title": "我的插件：打开面板",
        "icon": "panel"
      }
    ],
    "menus": {                            // 菜单贡献
      "tools": [
        {
          "command": "myPlugin.openPanel",
          "group": "myPlugin",
          "when": "eventActive"           // 显示条件
        }
      ]
    },
    "configuration": {                    // 配置项
      "title": "我的插件设置",
      "properties": {
        "myPlugin.enabled": {
          "type": "boolean",
          "default": true,
          "description": "是否启用插件"
        },
        "myPlugin.apiKey": {
          "type": "string",
          "default": "",
          "description": "API 密钥"
        }
      }
    }
  },
  
  "keywords": ["asg", "plugin", "esports"],
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/my-plugin"
  },
  "bugs": {
    "url": "https://github.com/yourusername/my-plugin/issues"
  }
}
```

### 3. 入口文件实现（index.js）

```javascript
/**
 * 插件激活函数
 * @param {PluginContext} context - 插件上下文
 * @returns {Object} 插件导出的 API（可选）
 */
async function activate(context) {
  const { api, log, globalState, workspaceState, subscriptions, extensionPath } = context
  
  log('插件正在激活...')
  
  // === 1. 注册命令 ===
  const cmd1 = api.commands.registerCommand('myPlugin.hello', async () => {
    api.notifications.showInfo('Hello!')
  })
  subscriptions.push(cmd1)
  
  // === 2. 监听事件 ===
  const listener = api.events.on('match.start', (data) => {
    log('比赛开始了！', data)
  })
  subscriptions.push(listener)
  
  // === 3. 创建状态栏 ===
  const statusBar = api.statusBar.createStatusBarItem('right', 100)
  statusBar.text = '⚡ 我的插件'
  statusBar.show()
  subscriptions.push(statusBar)
  
  // === 4. 读取/保存状态 ===
  const count = globalState.get('clickCount', 0)
  globalState.set('clickCount', count + 1)
  
  // === 5. 返回公共 API（供其他插件调用）===
  return {
    getCount() {
      return globalState.get('clickCount', 0)
    },
    reset() {
      globalState.set('clickCount', 0)
    }
  }
}

/**
 * 插件停用函数
 */
function deactivate() {
  // 清理资源（大部分资源会自动清理）
  console.log('插件已停用')
}

module.exports = { activate, deactivate }
```

---

## 插件 API 详解

### PluginContext（插件上下文）

传入 `activate()` 函数的上下文对象：

```javascript
{
  api: PluginAPI,              // 插件 API 实例
  log: Function,               // 日志函数 log(message, ...args)
  globalState: StateManager,   // 全局状态管理
  workspaceState: StateManager,// 工作区状态管理
  subscriptions: Array,        // 订阅数组（用于自动清理）
  extensionPath: String        // 插件根目录绝对路径
}
```

---

### 1. 命令系统（Commands）

```javascript
// 注册命令
const disposable = api.commands.registerCommand('myPlugin.action', async (arg1, arg2) => {
  console.log('命令被执行', arg1, arg2)
  // 返回值可以被调用者接收
  return { success: true }
})

// 执行命令
const result = await api.commands.executeCommand('myPlugin.action', 'param1', 'param2')

// 获取所有命令列表
const allCommands = api.commands.getAllCommands()

// 取消注册（一般不需要手动调用）
disposable.dispose()
```

**命令命名规范**：`插件名.动作` （如 `myPlugin.openPanel`）

---

### 2. 事件系统（Events）

```javascript
// 监听事件
const disposable = api.events.on('match.start', (data) => {
  console.log('比赛开始', data)
})

// 监听一次性事件
api.events.once('app.ready', () => {
  console.log('应用已就绪')
})

// 发送自定义事件
api.events.emit('myPlugin.customEvent', { foo: 'bar' })

// 移除监听器
disposable.dispose()
```

**常用系统事件**：

| 事件名 | 触发时机 | 数据 |
|--------|----------|------|
| `app.ready` | 应用启动完成 | - |
| `match.start` | 比赛开始 | `{ matchId, teams }` |
| `match.end` | 比赛结束 | `{ matchId, winner }` |
| `round.start` | 回合开始 | `{ roundId }` |
| `round.end` | 回合结束 | `{ roundId, winner }` |
| `player.join` | 选手加入 | `{ playerId, name }` |
| `config.change` | 配置变更 | `{ key, oldValue, newValue }` |

---

### 3. 状态栏（StatusBar）

```javascript
// 创建状态栏项
// alignment: 'left' | 'right'
// priority: 数字越大越靠前
const item = api.statusBar.createStatusBarItem('right', 100)

// 设置文本（支持 emoji）
item.text = '🎮 当前比分: 2-1'

// 设置提示文本
item.tooltip = '点击查看详情'

// 设置点击命令
item.command = 'myPlugin.showDetails'

// 设置颜色
item.color = '#00ff00'

// 显示/隐藏
item.show()
item.hide()

// 更新（修改属性后调用）
item.update()

// 销毁
item.dispose()
```

---

### 4. 通知系统（Notifications）

```javascript
// 信息通知
api.notifications.showInfo('操作成功', {
  title: '我的插件',
  duration: 3000,  // 显示时长（毫秒）
  actions: [{
    label: '查看详情',
    callback: () => console.log('用户点击了按钮')
  }]
})

// 警告通知
api.notifications.showWarning('网络连接不稳定')

// 错误通知
api.notifications.showError('操作失败', {
  duration: 5000
})

// 成功通知
api.notifications.showSuccess('保存成功')
```

---

### 5. 存储系统（Storage）

```javascript
// === 全局状态（跨工作区持久化）===
const value = context.globalState.get('key', defaultValue)
context.globalState.set('key', value)
context.globalState.delete('key')
context.globalState.has('key')

// === 工作区状态（当前工作区持久化）===
context.workspaceState.get('key', defaultValue)
context.workspaceState.set('key', value)

// 支持的数据类型：字符串、数字、布尔、对象、数组
context.globalState.set('config', {
  enabled: true,
  count: 42,
  list: ['a', 'b', 'c']
})
```

**存储位置**：
- Windows: `%APPDATA%\asg-director\plugins\.storage\your-plugin\`
- macOS: `~/Library/Application Support/asg-director/plugins/.storage/your-plugin/`

---

### 6. 窗口系统（Window）

```javascript
// 创建新窗口
api.window.createWindow({
  url: 'https://example.com',
  width: 800,
  height: 600,
  title: '我的窗口',
  frame: true,
  resizable: true
})

// 打开开发者工具
api.window.openDevTools()

// 显示消息框
const choice = await api.window.showMessageBox({
  type: 'question',
  title: '确认操作',
  message: '确定要删除吗？',
  buttons: ['取消', '确定'],
  defaultId: 1,
  cancelId: 0
})

if (choice.response === 1) {
  console.log('用户点击了确定')
}
```

---

### 7. 对话框（Dialog）

```javascript
// 打开文件对话框
const result = await api.dialog.showOpenDialog({
  title: '选择文件',
  defaultPath: '~/',
  filters: [
    { name: 'JSON 文件', extensions: ['json'] },
    { name: '所有文件', extensions: ['*'] }
  ],
  properties: ['openFile', 'multiSelections']
})

if (!result.canceled) {
  console.log('选择的文件:', result.filePaths)
}

// 保存文件对话框
const saveResult = await api.dialog.showSaveDialog({
  title: '保存文件',
  defaultPath: '~/config.json',
  filters: [
    { name: 'JSON 文件', extensions: ['json'] }
  ]
})

if (!saveResult.canceled) {
  console.log('保存路径:', saveResult.filePath)
}
```

---

### 8. 剪贴板（Clipboard）

```javascript
// 读取剪贴板
const text = await api.clipboard.readText()

// 写入剪贴板
await api.clipboard.writeText('Hello, Clipboard!')

// 写入 HTML（富文本）
await api.clipboard.writeHTML('<b>Bold Text</b>')
```

---

## 实战示例

### 示例 1：比赛计时器插件

创建一个显示比赛时长的插件：

```javascript
// match-timer-plugin/index.js
async function activate(context) {
  const { api, log, globalState, subscriptions } = context
  
  log('比赛计时器插件已激活')
  
  let matchStartTime = null
  let timerInterval = null
  
  // 创建状态栏
  const statusBar = api.statusBar.createStatusBarItem('right', 200)
  statusBar.text = '⏱️ --:--'
  statusBar.tooltip = '比赛计时器'
  statusBar.show()
  subscriptions.push(statusBar)
  
  // 更新计时器显示
  function updateTimer() {
    if (!matchStartTime) {
      statusBar.text = '⏱️ --:--'
      return
    }
    
    const elapsed = Math.floor((Date.now() - matchStartTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    statusBar.text = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`
    statusBar.update()
  }
  
  // 监听比赛开始事件
  api.events.on('match.start', (data) => {
    log('比赛开始', data)
    matchStartTime = Date.now()
    
    // 每秒更新一次
    timerInterval = setInterval(updateTimer, 1000)
    
    api.notifications.showInfo('计时器已启动', { duration: 2000 })
  })
  
  // 监听比赛结束事件
  api.events.on('match.end', (data) => {
    log('比赛结束', data)
    
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    
    // 显示最终时长
    if (matchStartTime) {
      const totalSeconds = Math.floor((Date.now() - matchStartTime) / 1000)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      
      api.notifications.showSuccess(
        `比赛用时：${minutes} 分 ${seconds} 秒`,
        { duration: 5000 }
      )
    }
    
    matchStartTime = null
  })
  
  // 注册手动重置命令
  api.commands.registerCommand('matchTimer.reset', () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    matchStartTime = null
    updateTimer()
    api.notifications.showInfo('计时器已重置')
  })
}

function deactivate() {
  console.log('比赛计时器插件已停用')
}

module.exports = { activate, deactivate }
```

对应的 `package.json`：

```json
{
  "name": "match-timer-plugin",
  "displayName": "比赛计时器",
  "description": "实时显示比赛用时",
  "version": "1.0.0",
  "author": "你的名字",
  "main": "index.js",
  "engines": {
    "asg-director": ">=1.4.0"
  },
  "activationEvents": ["onStartup"],
  "contributes": {
    "commands": [{
      "command": "matchTimer.reset",
      "title": "比赛计时器：重置"
    }]
  }
}
```

---

### 示例 2：快捷笔记插件

创建一个支持快速记录笔记的插件：

```javascript
// quick-notes-plugin/index.js
const fs = require('fs').promises
const path = require('path')

async function activate(context) {
  const { api, log, extensionPath, subscriptions } = context
  
  const notesFile = path.join(extensionPath, 'notes.json')
  
  // 加载笔记
  async function loadNotes() {
    try {
      const data = await fs.readFile(notesFile, 'utf8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }
  
  // 保存笔记
  async function saveNotes(notes) {
    await fs.writeFile(notesFile, JSON.stringify(notes, null, 2))
  }
  
  // 添加笔记命令
  api.commands.registerCommand('quickNotes.add', async () => {
    const notes = await loadNotes()
    const timestamp = new Date().toLocaleString('zh-CN')
    const content = `[${timestamp}] 新笔记`
    
    notes.push({ time: timestamp, content })
    await saveNotes(notes)
    
    api.notifications.showSuccess('笔记已添加')
  })
  
  // 查看笔记命令
  api.commands.registerCommand('quickNotes.view', async () => {
    const notes = await loadNotes()
    
    if (notes.length === 0) {
      api.notifications.showInfo('暂无笔记')
      return
    }
    
    const content = notes.map(n => `• ${n.content}`).join('\n')
    
    const result = await api.window.showMessageBox({
      type: 'info',
      title: '我的笔记',
      message: content,
      buttons: ['关闭', '清空笔记']
    })
    
    if (result.response === 1) {
      await saveNotes([])
      api.notifications.showInfo('笔记已清空')
    }
  })
  
  log('快捷笔记插件已激活')
}

module.exports = { activate, deactivate() {} }
```

---

## 开发调试技巧

### 1. 使用软链接快速开发

开发时使用软链接，代码修改后只需重启 ASG.Director：

```bash
# Windows（需要管理员权限）
mklink /D "%APPDATA%\asg-director\plugins\my-plugin" "C:\Projects\my-plugin"

# macOS/Linux
ln -s ~/Projects/my-plugin ~/Library/Application\ Support/asg-director/plugins/my-plugin
```

### 2. 查看插件日志

插件的 `log()` 输出会显示在 ASG.Director 的控制台：

```javascript
context.log('调试信息', { data: 123 })
context.log('错误：', error)
```

打开开发者工具查看：`视图 -> 切换开发者工具`

### 3. 热重载插件

```javascript
// 在插件代码中添加热重载支持
if (module.hot) {
  module.hot.accept()
  module.hot.dispose(() => {
    deactivate()
  })
}
```

### 4. 错误处理

```javascript
try {
  await api.commands.executeCommand('someCommand')
} catch (error) {
  context.log('命令执行失败:', error)
  api.notifications.showError(`错误：${error.message}`)
}
```

---

## 发布插件

### 1. 打包插件

```bash
# 创建 .asgplugin 文件（实际是 ZIP 格式）
cd my-plugin/
zip -r my-plugin-1.0.0.asgplugin .
```

### 2. 发布到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/my-plugin.git
git push -u origin main

# 创建 Release
gh release create v1.0.0 my-plugin-1.0.0.asgplugin
```

### 3. 用户安装

用户可以通过以下方式安装：

1. **手动安装**：下载 `.asgplugin` 文件，解压到 `%APPDATA%\asg-director\plugins\`
2. **插件商店**：（如果有的话）在 ASG.Director 中搜索安装

---

## 常见问题

### Q1: 插件没有被加载？

**检查清单**：
1. 确认插件在正确的位置：`%APPDATA%\asg-director\plugins\your-plugin\`
2. 检查 `package.json` 是否包含必需字段：`name`, `version`, `main`
3. 检查入口文件 `index.js` 是否导出 `activate` 函数
4. 查看 ASG.Director 控制台是否有错误信息

### Q2: 如何调试插件？

```javascript
// 使用 log 函数输出调试信息
context.log('DEBUG:', someVariable)

// 或使用 console
console.log('[MyPlugin]', data)
```

打开开发者工具查看输出。

### Q3: 插件可以访问文件系统吗？

可以！插件运行在 Node.js 环境，可以使用所有 Node.js API：

```javascript
const fs = require('fs').promises
const path = require('path')

// 读写文件
await fs.readFile(path.join(context.extensionPath, 'config.json'))
```

### Q4: 如何与其他插件通信？

通过命令系统或事件系统：

```javascript
// 插件 A 导出 API
function activate(context) {
  return {
    getData() {
      return { foo: 'bar' }
    }
  }
}

// 插件 B 调用插件 A
const pluginA = context.api.getExtension('plugin-a')
if (pluginA) {
  const data = pluginA.exports.getData()
}
```

### Q5: 插件可以使用 npm 包吗？

可以！但需要打包时包含 `node_modules`：

```bash
cd my-plugin/
npm install axios
# 打包时包含 node_modules
zip -r my-plugin-1.0.0.asgplugin . -x "*.git*"
```

或使用打包工具（如 webpack）将依赖打包进单个文件。

### Q6: 插件更新后如何生效？

1. 修改 `package.json` 中的 `version`
2. 重新打包/复制到用户目录
3. 重启 ASG.Director

---

## 最佳实践

1. **命名规范**：插件名使用小写字母和连字符，如 `my-awesome-plugin`
2. **错误处理**：所有异步操作都要用 try-catch 包裹
3. **资源清理**：将所有 Disposable 对象推入 `subscriptions` 数组
4. **性能优化**：避免在主线程执行耗时操作
5. **用户友好**：提供清晰的错误提示和操作反馈
6. **文档完善**：编写详细的 README 和使用说明

---

## 更多资源

- **示例插件**：查看 `C:\Users\luolan\ASG\builtin-plugins-backup\` 中的示例
- **API 参考**：查看 `ASG.Director/plugins/core/PluginAPI.js`
- **问题反馈**：[GitHub Issues](https://github.com/your-repo/issues)

---

祝你开发愉快！🎉
