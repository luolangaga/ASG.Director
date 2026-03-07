# ASG.Director 远程控制 API（第三方应用）

> 适用场景：你希望**不依赖 OBS 侧边栏插件**，直接让任意应用（网页、脚本、工具、控制台）与 ASG.Director 互通并控制前台展示。

---

## 1. 总览

ASG.Director 的远程控制能力基于 **WebSocket + JSON 信封协议**：

- 传输：`ws://<director-ip>:<port>`（默认端口 `19625`）
- 协议标识：`asg-director-sync`
- 协议版本：`1`
- 核心消息类型：
  - `hello`：握手
  - `snapshot`：首次连接后的状态快照
  - `update`：实时更新（控制命令）

你可以把第三方应用当作一个“同步节点”：
- 连接 Director 的监听端（Director 开服务端）；或
- 由 Director 主动连接你的服务（Director 开客户端）。

---

## 2. 在 Director 里开启同步

在 ASG.Director 主界面中启用“跨设备同步/远程同步”后：

- 打开服务端监听（`listenPort`，默认 19625）
- 或启用客户端并配置目标地址（`remoteHost` + `remotePort`）

建议外部应用优先使用“Director 开服务端，第三方应用作为客户端连接”模式，部署最简单。

---

## 3. 连接地址与网络要求

- 地址：`ws://<Director机器IP>:19625`
- 端口范围：1024~65535（Director 会校验）
- 如果跨机器访问，请确保：
  - Director 主机防火墙已放行监听端口
  - 局域网可达

---

## 4. 消息信封格式（必须）

所有消息都必须是 JSON，且外层使用统一信封：

```json
{
  "protocol": "asg-director-sync",
  "version": 1,
  "id": "a-uuid",
  "kind": "update",
  "origin": "third-party-app-1",
  "ts": 1730000000000,
  "payload": {
    "data": {
      "type": "state",
      "state": {}
    }
  }
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `protocol` | string | 是 | 固定 `asg-director-sync` |
| `version` | number | 是 | 固定 `1` |
| `id` | string | 是 | 消息唯一 ID（建议 UUID） |
| `kind` | string | 是 | `hello` / `snapshot` / `update` |
| `origin` | string | 是 | 发送方实例标识（任意唯一字符串） |
| `ts` | number | 是 | 时间戳（毫秒） |
| `payload` | object | 是 | 业务载荷 |

> 注意：`kind=update` 时，业务数据放在 `payload.data`。

---

## 5. 你会收到哪些消息

连接成功后，Director 会主动发送：

1. `hello`
2. `snapshot`（如果当前已有状态）

`snapshot.payload.updates` 是数组，每个元素都是一条标准更新对象（例如 `state`、`score`、`postmatch`）。

---

## 6. 第三方可发送的控制消息（推荐）

Director 会把 `update` 的 `payload.data` 当成内部 `update-data` 广播。因此可用类型与前台订阅类型一致。建议优先使用下列稳定类型：

---

### 6.1 `state`（BP 主状态）

用于更新选角、Ban、队伍、地图、天赋等主数据。

```json
{
  "type": "state",
  "state": {
    "phaseName": "本地BP",
    "phaseAction": "",
    "currentMap": "军工厂",
    "currentRoundData": {
      "selectedSurvivors": ["先知", "病患", "佣兵", "祭司"],
      "selectedHunter": "红夫人",
      "hunterBannedSurvivors": ["心理学家"],
      "survivorBannedHunters": ["梦之女巫"]
    },
    "globalBannedSurvivors": [],
    "globalBannedHunters": [],
    "survivorTalents": [[], [], [], []],
    "hunterTalents": [],
    "hunterSkills": [],
    "playerNames": ["A", "B", "C", "D", "H"],
    "teamA": { "name": "求生者队", "logo": "", "meta": "" },
    "teamB": { "name": "监管者队", "logo": "", "meta": "" },
    "gameLabel": "",
    "mapName": "军工厂"
  }
}
```

---

### 6.2 `score`（比分数据）

用于驱动比分板与总览。

```json
{
  "type": "score",
  "scoreData": {
    "matchFormat": "bo5",
    "teamA": { "name": "Team A", "score": 1 },
    "teamB": { "name": "Team B", "score": 2 },
    "rounds": []
  }
}
```

---

### 6.3 `postmatch`（赛后数据）

用于赛后页面同步。

```json
{
  "type": "postmatch",
  "postMatchData": {
    "mvp": "选手A",
    "summary": "示例"
  }
}
```

---

### 6.4 `timer`（前台倒计时）

```json
{
  "type": "timer",
  "remaining": 45,
  "total": 60,
  "indeterminate": false
}
```

---

### 6.5 `local-bp-blink`（闪烁某槽位）

```json
{
  "type": "local-bp-blink",
  "index": 0
}
```

`index`：
- `0~3` 求生者槽位
- `4` 监管者槽位

---

### 6.6 `bp-reset`（重置前台 BP 展示）

```json
{
  "type": "bp-reset"
}
```

---

## 7. 完整发送示例（JavaScript）

```js
const WebSocket = require('ws')
const crypto = require('crypto')

const ws = new WebSocket('ws://127.0.0.1:19625')
const origin = 'third-party-demo'

function envelope(kind, payload) {
  return {
    protocol: 'asg-director-sync',
    version: 1,
    id: crypto.randomUUID(),
    kind,
    origin,
    ts: Date.now(),
    payload
  }
}

ws.on('open', () => {
  // 发送 score 更新
  ws.send(JSON.stringify(envelope('update', {
    data: {
      type: 'score',
      scoreData: {
        matchFormat: 'bo3',
        teamA: { name: 'A队', score: 1 },
        teamB: { name: 'B队', score: 0 },
        rounds: []
      }
    }
  })))
})

ws.on('message', (buf) => {
  try {
    const msg = JSON.parse(String(buf))
    console.log('[recv]', msg.kind, msg.payload)
  } catch {}
})
```

---

## 8. 完整发送示例（Python）

```python
import json
import time
import uuid
from websocket import create_connection

ws = create_connection("ws://127.0.0.1:19625")
origin = "third-party-python"

msg = {
    "protocol": "asg-director-sync",
    "version": 1,
    "id": str(uuid.uuid4()),
    "kind": "update",
    "origin": origin,
    "ts": int(time.time() * 1000),
    "payload": {
        "data": {
            "type": "timer",
            "remaining": 30,
            "total": 60,
            "indeterminate": False
        }
    }
}

ws.send(json.dumps(msg, ensure_ascii=False))
print("sent")
print("recv:", ws.recv())
ws.close()
```

---

## 9. 幂等与去重建议

Director 会按消息 `id` 做去重缓存。第三方应用建议：

- 每条消息使用新的 UUID
- 失败重试时可复用同一 `id`（避免重复执行）
- 定时状态同步优先发送“全量状态”（例如整包 `state`）而非复杂增量

---

## 10. 兼容性与注意事项

1. **协议校验严格**：`protocol` / `version` 不匹配会被忽略。
2. **origin 回环保护**：同一实例来源消息会被忽略，避免自回环。
3. **建议只用公开稳定类型**：`state`、`score`、`postmatch`、`timer`、`local-bp-blink`、`bp-reset`。
4. **无鉴权设计（当前版本）**：请仅在受信任内网使用，或自行加反向代理/隧道鉴权。

---

## 11. 推荐接入流程

1. Director 端启用同步服务端并确认端口。
2. 第三方应用先只收消息，打印 `hello/snapshot`，确认链路通。
3. 先发送 `timer` / `local-bp-blink` 这种低风险消息做联调。
4. 最后接入 `state` / `score` 全量同步。

---

## 12. 故障排查清单

- 连接不上：检查 IP、端口、防火墙。
- 连上无效果：检查 `protocol`、`version`、`kind=update`、`payload.data.type`。
- 断开重连频繁：确保网络稳定，降低发送频率，必要时做指数退避。

