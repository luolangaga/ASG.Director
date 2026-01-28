# ASG.Director 本地BP比分板和赛后数据修复说明

## 修复日期
2026-01-12

## 问题描述

### 问题1：打开比分板时会自动打开后台窗口
在本地BP页面下，点击"打开A队比分板"或"打开B队比分板"按钮时，会同时打开ASG导播后台窗口，这是不必要的行为。

### 问题2：只能打开B队比分板
由于team参数传递错误（传递的是'A'/'B'，但实际需要'teamA'/'teamB'），导致无论点击哪个按钮都只能打开B队比分板。

### 问题3：缺少一键打开双比分板功能
用户希望能够一键同时打开A队和B队的比分板，提高操作效率。

### 问题4：赛后数据窗口打开时也会打开后台
与比分板类似，打开赛后数据窗口时也会自动打开后台窗口。

## 修复方案

### 修改文件
`c:\Users\luolan\ASG\ASG.Director\pages\local-bp.html`

### 具体修改

#### 1. 修复比分板按钮的team参数（第1021-1023行）
**修改前：**
```html
<button class="btn btn-success" onclick="openScoreboardWindow('A')">打开A队比分板</button>
<button class="btn btn-success" onclick="openScoreboardWindow('B')">打开B队比分板</button>
```

**修改后：**
```html
<button class="btn btn-success" onclick="openScoreboardWindow('teamA')">打开A队比分板</button>
<button class="btn btn-success" onclick="openScoreboardWindow('teamB')">打开B队比分板</button>
<button class="btn btn-info" onclick="openBothScoreboards()">一键打开双比分板</button>
```

#### 2. 修改openScoreControl函数（第1908-1919行）
移除了自动打开比分板的逻辑，只保留打开后台窗口的功能。

**修改前：**
```javascript
async function openScoreControl() {
  try {
    await window.electronAPI.invoke('open-local-backend')
    // 打开A队比分板
    await window.electronAPI.openScoreboard('local-bp', 'A')
    // 打开B队比分板
    await window.electronAPI.openScoreboard('local-bp', 'B')
  } catch (error) {
    alert('打开比分控制失败: ' + error.message)
  }
}
```

**修改后：**
```javascript
// 打开比分控制（打开后台窗口）
async function openScoreControl() {
  try {
    await window.electronAPI.invoke('open-local-backend')
  } catch (error) {
    alert('打开比分控制失败: ' + error.message)
  }
}
```

#### 3. 修改openPostMatchControl函数（第1921-1929行）
移除了自动打开赛后数据窗口的逻辑。

**修改前：**
```javascript
async function openPostMatchControl() {
  try {
    await window.electronAPI.invoke('open-local-backend')
    await window.electronAPI.openPostMatch('local-bp')
  } catch (error) {
    alert('打开赛后数据失败: ' + error.message)
  }
}
```

**修改后：**
```javascript
// 打开赛后数据（打开后台窗口）
async function openPostMatchControl() {
  try {
    await window.electronAPI.invoke('open-local-backend')
  } catch (error) {
    alert('打开赛后数据失败: ' + error.message)
  }
}
```

#### 4. 修改openScoreboardWindow函数（第2291-2296行）
移除了自动打开后台窗口的逻辑，并添加了一键打开双比分板的功能。

**修改前：**
```javascript
async function openScoreboardWindow(team) {
  try {
    await window.electronAPI.invoke('open-local-backend')
    await window.electronAPI.openScoreboard('local-bp', team)
  } catch (e) { alert('打开比分板失败: ' + e.message) }
}
```

**修改后：**
```javascript
// 打开单个比分板窗口
async function openScoreboardWindow(team) {
  try {
    await window.electronAPI.openScoreboard('local-bp', team)
  } catch (e) { alert('打开比分板失败: ' + e.message) }
}

// 一键打开两个比分板
async function openBothScoreboards() {
  try {
    await window.electronAPI.openScoreboard('local-bp', 'teamA')
    await window.electronAPI.openScoreboard('local-bp', 'teamB')
  } catch (e) { alert('打开比分板失败: ' + e.message) }
}
```

#### 5. 修改openPostMatchWindow函数（第2522-2527行）
移除了自动打开后台窗口的逻辑。

**修改前：**
```javascript
async function openPostMatchWindow() {
  try {
    await window.electronAPI.invoke('open-local-backend')
    await window.electronAPI.openPostMatch('local-bp')
  } catch (e) { alert('打开赛后数据窗口失败: ' + e.message) }
}
```

**修改后：**
```javascript
// 打开赛后数据窗口
async function openPostMatchWindow() {
  try {
    await window.electronAPI.openPostMatch('local-bp')
  } catch (e) { alert('打开赛后数据窗口失败: ' + e.message) }
}
```

## 功能说明

### 比分管理页面
- **打开A队比分板**：单独打开A队的比分板窗口
- **打开B队比分板**：单独打开B队的比分板窗口
- **一键打开双比分板**：同时打开A队和B队的比分板窗口（新增功能）

### 赛后数据页面
- **打开赛后数据窗口**：打开赛后数据展示窗口，不再自动打开后台

### 后台窗口控制
- 如果需要打开后台窗口，可以使用菜单中的"比分控制"或"赛后数据"按钮
- 这些按钮会打开后台窗口，但不会自动打开比分板或赛后数据窗口

## 测试建议

1. **测试比分板A**：点击"打开A队比分板"，确认只打开A队比分板窗口，不打开后台
2. **测试比分板B**：点击"打开B队比分板"，确认只打开B队比分板窗口，不打开后台
3. **测试一键打开**：点击"一键打开双比分板"，确认同时打开A队和B队比分板窗口
4. **测试赛后数据**：点击"打开赛后数据窗口"，确认只打开赛后数据窗口，不打开后台
5. **测试后台控制**：使用菜单中的"比分控制"和"赛后数据"按钮，确认能正常打开后台窗口

## 注意事项

- 修改仅涉及前端页面逻辑，不影响后端API
- team参数已统一为'teamA'和'teamB'格式
- 保持了原有的错误处理机制
- 所有修改都向后兼容
