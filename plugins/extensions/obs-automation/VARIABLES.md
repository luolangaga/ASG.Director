# OBS 自动化插件 - 变量参考

## 📖 完整变量列表

本文档列出了所有可在 OBS 自动化规则中使用的变量。

---

## BP 相关变量

### 基础变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `{{bpHunter}}` | String | 当前选择的监管者 | `"红蝶"` |
| `{{bpSurvivors}}` | Array | 求生者数组（4个） | `["园丁", "医生", "", ""]` |
| `{{bpBannedSurvivors}}` | Array | 禁用的求生者数组 | `["先知", "祭司"]` |
| `{{bpBannedHunters}}` | Array | 禁用的监管者数组 | `["黄衣之主", "梦之女巫"]` |
| `{{bpRound}}` | Number | 当前回合数 | `1` |
| `{{bpTeamA}}` | String | A 队队名 | `"战队A"` |
| `{{bpTeamB}}` | String | B 队队名 | `"战队B"` |

### 数组索引访问

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `{{bpSurvivors.0}}` | String | 第 1 位求生者 |
| `{{bpSurvivors.1}}` | String | 第 2 位求生者 |
| `{{bpSurvivors.2}}` | String | 第 3 位求生者 |
| `{{bpSurvivors.3}}` | String | 第 4 位求生者 |

### 格式化文本变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `{{bpSurvivorsText}}` | String | 求生者列表（逗号分隔） | `"园丁, 医生, 前锋, 盲女"` |
| `{{bpBannedSurvivorsText}}` | String | 禁用求生者列表 | `"先知, 祭司"` |
| `{{bpBannedHuntersText}}` | String | 禁用监管者列表 | `"黄衣之主, 梦之女巫"` |

---

## 比赛相关变量

### 基础变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `{{matchTeamA}}` | String | A 队队名 | `"战队A"` |
| `{{matchTeamB}}` | String | B 队队名 | `"战队B"` |
| `{{matchScoreA}}` | Number | A 队比分 | `2` |
| `{{matchScoreB}}` | Number | B 队比分 | `1` |
| `{{matchMap}}` | String | 当前地图 | `"军工厂"` |
| `{{matchRound}}` | Number | 当前回合 | `3` |

### 格式化变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `{{matchScore}}` | String | 格式化比分 | `"2:1"` |
| `{{matchTitle}}` | String | 比赛标题 | `"战队A vs 战队B"` |
| `{{matchScoreText}}` | String | 完整比分文本 | `"战队A 2 : 1 战队B"` |

---

## 房间相关变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `{{roomId}}` | String | 房间 ID | `"room-12345"` |
| `{{roomName}}` | String | 房间名称 | `"友谊赛房间"` |
| `{{roomStatus}}` | String | 房间状态 | `"playing"` |

---

## 通用变量

| 变量名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `{{timestamp}}` | Number | 当前时间戳（毫秒） | `1706000000000` |
| `{{eventData.xxx}}` | Any | 从事件数据中访问任意字段 | 取决于字段 |

---

## 使用示例

### 示例 1：显示完整的 BP 信息

```json
{
  "type": "set-text",
  "params": {
    "sourceName": "BP信息",
    "text": "监管者: {{bpHunter}} | 求生者: {{bpSurvivorsText}}"
  }
}
```

**输出**：`监管者: 红蝶 | 求生者: 园丁, 医生, 前锋, 盲女`

### 示例 2：显示比赛比分

```json
{
  "type": "set-text",
  "params": {
    "sourceName": "比分",
    "text": "{{matchScoreText}}"
  }
}
```

**输出**：`战队A 2 : 1 战队B`

### 示例 3：单独访问每个求生者

```json
{
  "actions": [
    { "type": "set-text", "params": { "sourceName": "求生者1", "text": "{{bpSurvivors.0}}" } },
    { "type": "set-text", "params": { "sourceName": "求生者2", "text": "{{bpSurvivors.1}}" } },
    { "type": "set-text", "params": { "sourceName": "求生者3", "text": "{{bpSurvivors.2}}" } },
    { "type": "set-text", "params": { "sourceName": "求生者4", "text": "{{bpSurvivors.3}}" } }
  ]
}
```

### 示例 4：动态图片路径

```json
{
  "type": "set-image",
  "params": {
    "sourceName": "角色头像",
    "file": "D:/OBS/Characters/{{bpHunter}}.png"
  }
}
```

如果 `{{bpHunter}}` 是 "红蝶"，则实际路径为 `D:/OBS/Characters/红蝶.png`

### 示例 5：使用事件数据字段

```json
{
  "type": "set-text",
  "params": {
    "sourceName": "自定义信息",
    "text": "玩家: {{eventData.playerName}}, 分数: {{eventData.score}}"
  }
}
```

---

## 变量命名规则

1. **变量名区分大小写**：`{{bpHunter}}` 和 `{{bphunter}}` 是不同的
2. **使用双花括号**：变量必须用 `{{` 和 `}}` 包围
3. **支持嵌套访问**：使用点号访问嵌套属性，如 `{{eventData.player.name}}`
4. **数组索引**：使用点号加数字，如 `{{bpSurvivors.0}}`

---

## 变量可用性

不同的触发事件类型会提供不同的变量：

| 触发事件类型 | 可用变量 |
|--------------|----------|
| `bp:*` | 所有 BP 相关变量 |
| `match:*` | 所有比赛相关变量 |
| `room:*` | 所有房间相关变量 |
| 所有事件 | 通用变量 |

---

## 注意事项

> [!TIP]
> 如果变量不存在或为空，模板会返回空字符串 `""`，不会导致错误。

> [!IMPORTANT]
> 数组类型的变量（如 `{{bpSurvivors}}`）在文本中会显示为 `[object Array]`，建议使用格式化版本（如 `{{bpSurvivorsText}}`）。

> [!WARNING]
> 某些变量可能在特定事件中不可用。例如，`{{bpHunter}}` 在监管者选择之前可能为空。
