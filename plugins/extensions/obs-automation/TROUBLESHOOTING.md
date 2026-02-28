# OBS 自动化插件诊断指南

## 🔍 问题诊断步骤

### 1. 检查插件是否正确加载

**查看 ASG.Director 控制台日志**，应该能看到：
```
[OBS 自动化] 🚀 正在激活插件...
[OBS 自动化] 📁 插件路径: ...
[OBS 自动化] 📡 设置 Director 事件监听...
[OBS 自动化] ✅ Director 事件监听设置完成
[OBS 自动化] 📂 准备加载规则，共 X 条
[OBS 自动化] ✅ OBS 自动化插件已激活
```

**如果看不到这些日志** → 插件未正确加载

---

### 2. 检查规则是否正确加载

在控制台日志中查找：
```
[OBS 自动化] 📂 开始加载 X 条已保存的规则:
[OBS 自动化]   [1] 规则名称 - ✅ 启用 - 触发: bp:hunter-selected
[OBS 自动化] ✅ 规则加载完成，TriggerManager 中共有 X 条规则
```

**检查点**：
- ✅ 规则数量是否正确？
- ✅ 规则是否启用？（显示 ✅ 启用）
- ✅ 触发事件类型是否正确？

**如果没有规则或规则被禁用** → 在规则编辑器中启用规则

---

### 3. 检查 OBS 连接状态

在控制台日志中查找：
```
[OBS 自动化] 📡 OBS WebSocket 已连接
[OBS 自动化] 🔐 OBS 认证成功
[OBS 自动化] 📋 OBS 场景列表: 场景1, 场景2, ...
```

**如果连接失败**：
1. 确认 OBS WebSocket 已启用（工具 → WebSocket 服务器设置）
2. 检查端口是否正确（默认 4455）
3. 检查密码是否正确

---

### 4. 检查事件是否被触发

**执行 BP 操作时**，在控制台日志中应该看到：
```
[OBS 自动化] 📨 收到事件: bp:character-picked，数据: {...}
[OBS 自动化] 🔍 TriggerManager 状态: 存在, 规则数量: X
[OBS 自动化] 🔍 角色数据: type=hunter, isHunter=true, character=红蝶
[OBS 自动化] ⚡ 触发监管者选择事件
[TriggerManager] 收到事件: bp:hunter-selected
[TriggerManager] 规则匹配: 监管者选完切场景
[TriggerManager] ⚙️ 执行操作: SWITCH_SCENE
```

**如果没有看到这些日志**：

#### 情况 A：完全没有日志
→ **Director 没有发送 BP 事件**
- 检查您是否在使用支持事件的 BP 系统
- 确认 BP 房间已正确连接

#### 情况 B：收到事件但没有匹配规则
→ **规则配置有问题**
- 检查触发事件类型是否匹配
- 检查规则是否启用
- 检查条件表达式是否正确

#### 情况 C：规则匹配但操作没执行
→ **OBS 连接或操作配置有问题**
- 检查 OBS 是否已连接（应显示"已连接"）
- 检查操作参数是否正确（场景名、源名称等）

---

### 5. 测试基础功能

#### 5.1 测试 OBS 连接
1. 打开规则编辑器（菜单 → OBS 自动化）
2. 输入 OBS 连接信息并点击"连接"
3. 应该看到状态变为"🟢 已连接 - 当前场景名"

#### 5.2 测试手动切换场景
在规则编辑器中：
1. 创建一个简单规则
2. 触发事件：`bp:hunter-selected`（监管者选择完成）
3. 添加动作：切换场景 → 选择一个存在的场景
4. 启用规则并保存
5. 点击"🧪 测试规则"按钮

**应该看到 OBS 场景切换**

---

## 🎯 预期的完整日志示例

当一切正常工作时，您应该看到类似这样的日志：

```
[OBS 自动化] 🚀 正在激活插件...
[OBS 自动化] 📂 准备加载规则，共 2 条
[OBS 自动化]   [1] 监管者选完切场景 - ✅ 启用 - 触发: bp:hunter-selected
[OBS 自动化]   [2] 更新文本 - ✅ 启用 - 触发: bp:hunter-selected
[OBS 自动化] ✅ 规则加载完成，TriggerManager 中共有 2 条规则
[OBS 自动化] ✅ OBS 自动化插件已激活

[OBS 自动化] 📡 OBS WebSocket 已连接
[OBS 自动化] 🔐 OBS 认证成功
[OBS 自动化] 📋 OBS 场景列表: BP场景, 游戏场景, 等待场景

[OBS 自动化] 📨 收到事件: bp:character-picked，数据: {"character":"红蝶",...}
[OBS 自动化] 🔍 TriggerManager 状态: 存在, 规则数量: 2
[OBS 自动化] ⚡ 触发监管者选择事件

[TriggerManager] 收到事件: bp:hunter-selected
[TriggerManager] 规则匹配: 监管者选完切场景
[TriggerManager] ⚙️ 执行操作: SWITCH_SCENE
[TriggerManager] ✅ 场景切换成功: 游戏场景
```
