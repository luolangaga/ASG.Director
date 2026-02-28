/**
 * 自动化触发器管理器
 * 处理各种事件到 OBS 操作的映射
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events')

/**
 * 触发器类型枚举
 */
const TriggerType = {
  // BP 事件
  BP_STARTED: 'bp:started',
  BP_ENDED: 'bp:ended',
  BP_HUNTER_SELECTED: 'bp:hunter-selected',
  BP_SURVIVOR_SELECTED: 'bp:survivor-selected',
  BP_CHARACTER_BANNED: 'bp:character-banned',
  BP_ALL_SURVIVORS_SELECTED: 'bp:all-survivors-selected',
  BP_ROUND_CHANGED: 'bp:round-changed',

  // 比赛事件
  MATCH_STARTED: 'match:started',
  MATCH_ENDED: 'match:ended',
  MATCH_SCORE_UPDATED: 'match:score-updated',
  MATCH_MAP_CHANGED: 'match:map-changed',

  // 房间事件
  ROOM_CONNECTED: 'room:connected',
  ROOM_DISCONNECTED: 'room:disconnected',
  ROOM_UPDATED: 'room:updated',

  // 自定义事件
  CUSTOM: 'custom',
  TIMER: 'timer',
  HOTKEY: 'hotkey'
}

/**
 * 操作类型枚举
 */
const ActionType = {
  SWITCH_SCENE: 'SWITCH_SCENE',
  SET_SOURCE_VISIBLE: 'SET_SOURCE_VISIBLE',
  SET_TEXT: 'SET_TEXT',
  SET_IMAGE: 'SET_IMAGE',
  SET_BROWSER_URL: 'SET_BROWSER_URL',
  REFRESH_BROWSER: 'REFRESH_BROWSER',
  START_STREAMING: 'START_STREAMING',
  STOP_STREAMING: 'STOP_STREAMING',
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  DELAY: 'DELAY',
  EXECUTE_COMMAND: 'EXECUTE_COMMAND',
  CUSTOM_SCRIPT: 'CUSTOM_SCRIPT',
  // 新增操作类型
  SET_SOURCE_SETTINGS: 'SET_SOURCE_SETTINGS',      // 通用源设置
  SET_SOURCE_TRANSFORM: 'SET_SOURCE_TRANSFORM',    // 源变换（位置、大小、旋转）
  SET_FILTER_SETTINGS: 'SET_FILTER_SETTINGS',      // 滤镜设置
  SET_FILTER_ENABLED: 'SET_FILTER_ENABLED'         // 滤镜启用/禁用
}

/**
 * 触发器条件
 */
class TriggerCondition {
  constructor(options = {}) {
    this.field = options.field || ''        // 检查的字段
    this.operator = options.operator || '==' // 比较运算符: ==, !=, >, <, >=, <=, contains, regex
    this.value = options.value || ''        // 比较的值
  }

  /**
   * 检查条件是否满足
   * @param {Object} data - 事件数据
   * @returns {boolean}
   */
  check(data) {
    if (!this.field) return true

    const fieldValue = this._getFieldValue(data, this.field)

    switch (this.operator) {
      case '==':
        return fieldValue == this.value
      case '===':
        return fieldValue === this.value
      case '!=':
        return fieldValue != this.value
      case '>':
        return fieldValue > this.value
      case '<':
        return fieldValue < this.value
      case '>=':
        return fieldValue >= this.value
      case '<=':
        return fieldValue <= this.value
      case 'contains':
        return String(fieldValue).includes(this.value)
      case 'regex':
        return new RegExp(this.value).test(String(fieldValue))
      default:
        return true
    }
  }

  /**
   * 获取嵌套字段的值
   * @param {Object} data - 数据对象
   * @param {string} field - 字段路径（如 'player.name'）
   * @returns {any}
   */
  _getFieldValue(data, field) {
    const parts = field.split('.')
    let value = data

    for (const part of parts) {
      if (value == null) return undefined
      value = value[part]
    }

    return value
  }
}

/**
 * 触发器操作
 */
class TriggerAction {
  constructor(options = {}) {
    this.type = options.type || ActionType.SWITCH_SCENE
    this.delay = options.delay || 0           // 延迟执行（毫秒）
    this.params = options.params || {}        // 操作参数
    this.enabled = options.enabled !== false
  }
}

/**
 * 触发器规则
 */
class TriggerRule {
  constructor(options = {}) {
    this.id = options.id || `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.name = options.name || '未命名规则'
    this.description = options.description || ''
    this.enabled = options.enabled !== false
    this.triggerType = options.triggerType || TriggerType.CUSTOM
    this.conditions = (options.conditions || []).map(c => new TriggerCondition(c))
    this.actions = (options.actions || []).map(a => new TriggerAction(a))
    this.cooldown = options.cooldown || 0     // 冷却时间（毫秒）
    this.lastTriggered = 0                    // 上次触发时间
  }

  /**
   * 检查是否可以触发
   * @param {Object} eventData - 事件数据
   * @returns {boolean}
   */
  canTrigger(eventData) {
    if (!this.enabled) return false

    // 检查冷却
    if (this.cooldown > 0) {
      const now = Date.now()
      if (now - this.lastTriggered < this.cooldown) {
        return false
      }
    }

    // 检查所有条件
    for (const condition of this.conditions) {
      if (!condition.check(eventData)) {
        return false
      }
    }

    return true
  }

  /**
   * 标记触发时间
   */
  markTriggered() {
    this.lastTriggered = Date.now()
  }

  /**
   * 序列化为 JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      triggerType: this.triggerType,
      conditions: this.conditions,
      actions: this.actions,
      cooldown: this.cooldown
    }
  }
}

/**
 * 触发器管理器
 */
class TriggerManager extends EventEmitter {
  /**
   * @param {Object} options - 选项
   * @param {OBSWebSocket} options.obs - OBS WebSocket 实例
   * @param {Function} options.log - 日志函数
   */
  constructor(options = {}) {
    super()

    /** @type {Map<string, TriggerRule>} */
    this.rules = new Map()

    /** @type {OBSWebSocket|null} */
    this.obs = options.obs || null

    /** @type {Function} */
    this.log = options.log || console.log

    /** @type {boolean} */
    this.enabled = true

    /** @type {Array<{timerId: NodeJS.Timeout, ruleId: string}>} */
    this.activeTimers = []

    /** @type {Object} 变量存储（用于模板替换） */
    this.variables = {}
  }

  /**
   * 设置 OBS 实例
   * @param {OBSWebSocket} obs - OBS WebSocket 实例
   */
  setOBS(obs) {
    this.obs = obs
  }

  /**
   * 添加规则
   * @param {TriggerRule|Object} rule - 规则对象
   * @returns {TriggerRule}
   */
  addRule(rule) {
    const triggerRule = rule instanceof TriggerRule ? rule : new TriggerRule(rule)
    this.rules.set(triggerRule.id, triggerRule)
    this.log(`[TriggerManager] 添加规则: ${triggerRule.name} (${triggerRule.id})`)
    this.emit('ruleAdded', triggerRule)
    return triggerRule
  }

  /**
   * 移除规则
   * @param {string} ruleId - 规则ID
   * @returns {boolean}
   */
  removeRule(ruleId) {
    const rule = this.rules.get(ruleId)
    if (rule) {
      this.rules.delete(ruleId)
      this.log(`[TriggerManager] 移除规则: ${rule.name} (${ruleId})`)
      this.emit('ruleRemoved', rule)
      return true
    }
    return false
  }

  /**
   * 更新规则
   * @param {string} ruleId - 规则ID
   * @param {Object} updates - 更新内容
   * @returns {TriggerRule|null}
   */
  updateRule(ruleId, updates) {
    const rule = this.rules.get(ruleId)
    if (rule) {
      Object.assign(rule, updates)
      if (updates.conditions) {
        rule.conditions = updates.conditions.map(c => new TriggerCondition(c))
      }
      if (updates.actions) {
        rule.actions = updates.actions.map(a => new TriggerAction(a))
      }
      this.emit('ruleUpdated', rule)
      return rule
    }
    return null
  }

  /**
   * 获取规则
   * @param {string} ruleId - 规则ID
   * @returns {TriggerRule|undefined}
   */
  getRule(ruleId) {
    return this.rules.get(ruleId)
  }

  /**
   * 获取所有规则
   * @returns {TriggerRule[]}
   */
  getAllRules() {
    return Array.from(this.rules.values())
  }

  /**
   * 启用/禁用规则
   * @param {string} ruleId - 规则ID
   * @param {boolean} enabled - 是否启用
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = enabled
      this.emit('ruleUpdated', rule)
    }
  }

  /**
   * 处理事件
   * @param {string} eventType - 事件类型
   * @param {Object} eventData - 事件数据
   */
  async handleEvent(eventType, eventData = {}) {
    if (!this.enabled) return

    this.log(`[TriggerManager] 收到事件: ${eventType}`, eventData)

    // 更新变量
    this._updateVariables(eventType, eventData)

    // 查找匹配的规则
    for (const rule of this.rules.values()) {
      if (rule.triggerType === eventType && rule.canTrigger(eventData)) {
        this.log(`[TriggerManager] 规则匹配: ${rule.name}`)
        rule.markTriggered()
        await this._executeActions(rule, eventData)
      }
    }
  }

  /**
   * 更新变量
   * @param {string} eventType - 事件类型
   * @param {Object} eventData - 事件数据
   */
  _updateVariables(eventType, eventData) {
    this.variables.lastEvent = eventType
    this.variables.lastEventData = eventData
    this.variables.timestamp = Date.now()

    // 根据事件类型更新特定变量
    if (eventType.startsWith('bp:')) {
      const survivors = eventData.survivors || eventData.selectedSurvivors || []
      const bannedSurvivors = eventData.hunterBannedSurvivors || []
      const bannedHunters = eventData.survivorBannedHunters || []

      Object.assign(this.variables, {
        // 基础变量
        bpHunter: eventData.hunter || eventData.selectedHunter || eventData.character || '',
        bpSurvivors: survivors,
        bpBannedSurvivors: bannedSurvivors,
        bpBannedHunters: bannedHunters,
        bpRound: eventData.round || eventData.currentRound || 0,

        // 索引访问（用于模板 {{bpSurvivors.0}} 等）
        'bpSurvivors.0': survivors[0] || '',
        'bpSurvivors.1': survivors[1] || '',
        'bpSurvivors.2': survivors[2] || '',
        'bpSurvivors.3': survivors[3] || '',

        // 格式化字符串
        bpSurvivorsText: survivors.filter(s => s).join(', '),
        bpBannedSurvivorsText: bannedSurvivors.filter(s => s).join(', '),
        bpBannedHuntersText: bannedHunters.filter(s => s).join(', '),

        // 队伍信息（如果有）
        bpTeamA: eventData.teamAName || eventData.teamA || '',
        bpTeamB: eventData.teamBName || eventData.teamB || ''
      })
    }

    if (eventType.startsWith('match:')) {
      const scoreA = eventData.scoreA ?? 0
      const scoreB = eventData.scoreB ?? 0
      const teamA = eventData.teamAName || eventData.teamA || ''
      const teamB = eventData.teamBName || eventData.teamB || ''

      Object.assign(this.variables, {
        // 基础比赛变量
        matchTeamA: teamA,
        matchTeamB: teamB,
        matchScoreA: scoreA,
        matchScoreB: scoreB,
        matchMap: eventData.currentMap || eventData.map || '',
        matchRound: eventData.round || 0,

        // 格式化变量
        matchScore: `${scoreA}:${scoreB}`,
        matchTitle: teamA && teamB ? `${teamA} vs ${teamB}` : '',
        matchScoreText: `${teamA} ${scoreA} : ${scoreB} ${teamB}`,

        // 从房间数据中提取更多信息
        roomId: eventData.roomId || '',
        roomName: eventData.roomName || ''
      })
    }

    // 房间事件
    if (eventType.startsWith('room:')) {
      Object.assign(this.variables, {
        roomId: eventData.roomId || eventData.id || '',
        roomName: eventData.roomName || eventData.name || '',
        roomStatus: eventData.status || ''
      })
    }
  }

  /**
   * 执行规则的所有操作
   * @param {TriggerRule} rule - 规则
   * @param {Object} eventData - 事件数据
   */
  async _executeActions(rule, eventData) {
    this.log(`[TriggerManager] 📋 开始执行规则动作: ${rule.name}`)
    this.log(`[TriggerManager] 📋 动作数量: ${rule.actions ? rule.actions.length : 0}`)

    if (!rule.actions || rule.actions.length === 0) {
      this.log(`[TriggerManager] ⚠️ 规则没有配置任何动作`)
      return
    }

    for (const action of rule.actions) {
      this.log(`[TriggerManager] 🔍 检查动作: type=${action.type}, enabled=${action.enabled}`)

      // 默认启用：只有显式设置 enabled === false 才跳过
      if (action.enabled === false) {
        this.log(`[TriggerManager] ⏭️ 动作已禁用，跳过`)
        continue
      }

      // 处理延迟
      if (action.delay > 0) {
        this.log(`[TriggerManager] 延迟 ${action.delay}ms 后执行操作: ${action.type}`)
        await this._delay(action.delay)
      }

      try {
        this.log(`[TriggerManager] 🚀 准备执行动作: ${action.type}`)
        await this._executeAction(action, eventData)
        this.log(`[TriggerManager] ✅ 动作执行完成: ${action.type}`)
      } catch (e) {
        this.log(`[TriggerManager] ❌ 执行操作失败: ${e.message}`)
        this.log(`[TriggerManager] ❌ 错误堆栈: ${e.stack}`)
        this.emit('actionError', { rule, action, error: e })
      }
    }

    this.log(`[TriggerManager] ✅ 规则所有动作执行完毕: ${rule.name}`)
  }

  _normalizeActionType(type) {
    if (!type) return type
    // 兼容历史存储格式（旧版使用短横线 / 旧命名）
    const map = {
      'switch-scene': ActionType.SWITCH_SCENE,
      'delay': ActionType.DELAY,
      'start-stream': ActionType.START_STREAMING,
      'stop-stream': ActionType.STOP_STREAMING,
      'start-record': ActionType.START_RECORDING,
      'stop-record': ActionType.STOP_RECORDING,
      // 兼容少量别名
      'start-streaming': ActionType.START_STREAMING,
      'stop-streaming': ActionType.STOP_STREAMING,
      'start-recording': ActionType.START_RECORDING,
      'stop-recording': ActionType.STOP_RECORDING,
      'execute-command': ActionType.EXECUTE_COMMAND,
      'custom-script': ActionType.CUSTOM_SCRIPT,
      // 新操作类型别名
      'set-source-settings': ActionType.SET_SOURCE_SETTINGS,
      'set-source-transform': ActionType.SET_SOURCE_TRANSFORM,
      'set-filter-settings': ActionType.SET_FILTER_SETTINGS,
      'set-filter-enabled': ActionType.SET_FILTER_ENABLED
    }
    return map[type] || type
  }

  /**
   * 执行单个操作
   * @param {TriggerAction} action - 操作
   * @param {Object} eventData - 事件数据
   */
  async _executeAction(action, eventData) {
    const params = this._resolveParams(action.params, eventData)

    const actionType = this._normalizeActionType(action.type)

    this.log(`[TriggerManager] ⚙️ 执行操作: ${actionType}`)
    this.log(`[TriggerManager] 📋 操作参数:`, JSON.stringify(params))
    this.log(`[TriggerManager] 🔌 OBS 状态: connected=${!!this.obs}, identified=${this.obs?.identified}`)

    switch (actionType) {
      case ActionType.SWITCH_SCENE:
        if (!this.obs) {
          this.log(`[TriggerManager] ❌ OBS 实例不存在`)
          return
        }
        if (!this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未认证，无法切换场景`)
          return
        }
        this.log(`[TriggerManager] 🎬 切换场景到: ${params.sceneName}`)
        try {
          await this.obs.setCurrentScene(params.sceneName)
          this.log(`[TriggerManager] ✅ 场景切换成功: ${params.sceneName}`)
        } catch (e) {
          this.log(`[TriggerManager] ❌ 场景切换失败: ${e.message}`)
          throw e
        }
        break

      case ActionType.SET_SOURCE_VISIBLE:
        if (this.obs && this.obs.identified) {
          await this.obs.setSceneItemEnabled(
            params.sceneName,
            params.sceneItemId,
            params.visible
          )
        }
        break

      case ActionType.SET_TEXT:
        if (this.obs && this.obs.identified) {
          await this.obs.setTextContent(params.sourceName, params.text)
        }
        break

      case ActionType.SET_IMAGE:
        if (this.obs && this.obs.identified) {
          await this.obs.setImageSource(params.sourceName, params.file)
        }
        break

      case ActionType.SET_BROWSER_URL:
        if (this.obs && this.obs.identified) {
          await this.obs.setBrowserSourceUrl(params.sourceName, params.url)
        }
        break

      case ActionType.REFRESH_BROWSER:
        if (this.obs && this.obs.identified) {
          await this.obs.refreshBrowserSource(params.sourceName)
        }
        break

      case ActionType.START_STREAMING:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法开始推流`)
          return
        }
        this.log(`[TriggerManager] 📡 开始推流...`)
        await this.obs.startStream()
        this.log(`[TriggerManager] ✅ 推流已开始`)
        break

      case ActionType.STOP_STREAMING:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法停止推流`)
          return
        }
        this.log(`[TriggerManager] 📡 停止推流...`)
        await this.obs.stopStream()
        this.log(`[TriggerManager] ✅ 推流已停止`)
        break

      case ActionType.START_RECORDING:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法开始录制`)
          return
        }
        this.log(`[TriggerManager] 🔴 开始录制...`)
        await this.obs.startRecord()
        this.log(`[TriggerManager] ✅ 录制已开始`)
        break

      case ActionType.STOP_RECORDING:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法停止录制`)
          return
        }
        this.log(`[TriggerManager] ⏹️ 停止录制...`)
        await this.obs.stopRecord()
        this.log(`[TriggerManager] ✅ 录制已停止`)
        break

      case ActionType.DELAY:
        this.log(`[TriggerManager] ⏱️ 等待 ${params.duration}ms...`)
        await this._delay(params.duration || 1000)
        this.log(`[TriggerManager] ✅ 等待完成`)
        break

      case ActionType.SET_SOURCE_SETTINGS:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法设置源属性`)
          return
        }
        this.log(`[TriggerManager] 🎨 设置源属性: ${params.sourceName}`)
        await this.obs.setInputSettings(
          params.sourceName,
          params.settings,
          params.overlay !== false
        )
        this.log(`[TriggerManager] ✅ 源属性设置成功`)
        break

      case ActionType.SET_SOURCE_TRANSFORM:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法设置源变换`)
          return
        }
        this.log(`[TriggerManager] 🔄 设置源变换: ${params.sourceName || params.sceneItemId}`)

        // 如果提供了源名称而非 ID，先获取 ID
        let itemId = params.sceneItemId
        if (!itemId && params.sourceName && params.sceneName) {
          try {
            itemId = await this.obs.getSceneItemId(params.sceneName, params.sourceName)
            this.log(`[TriggerManager] 📍 获取场景项 ID: ${itemId}`)
          } catch (e) {
            this.log(`[TriggerManager] ❌ 获取场景项 ID 失败: ${e.message}`)
            throw e
          }
        }

        if (itemId && params.sceneName) {
          await this.obs.setSceneItemTransform(
            params.sceneName,
            itemId,
            params.transform
          )
          this.log(`[TriggerManager] ✅ 源变换设置成功`)
        } else {
          this.log(`[TriggerManager] ❌ 缺少必要参数: sceneName 和 (sceneItemId 或 sourceName)`)
        }
        break

      case ActionType.SET_FILTER_SETTINGS:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法设置滤镜`)
          return
        }
        this.log(`[TriggerManager] 🎭 设置滤镜: ${params.sourceName} -> ${params.filterName}`)
        await this.obs.setSourceFilterSettings(
          params.sourceName,
          params.filterName,
          params.settings
        )
        this.log(`[TriggerManager] ✅ 滤镜设置成功`)
        break

      case ActionType.SET_FILTER_ENABLED:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法控制滤镜`)
          return
        }
        this.log(`[TriggerManager] 🎭 ${params.enabled ? '启用' : '禁用'}滤镜: ${params.sourceName} -> ${params.filterName}`)
        await this.obs.setSourceFilterEnabled(
          params.sourceName,
          params.filterName,
          params.enabled
        )
        this.log(`[TriggerManager] ✅ 滤镜状态更新成功`)
        break

      case ActionType.EXECUTE_COMMAND:
        this.emit('executeCommand', params.command, params.args)
        break

      case ActionType.CUSTOM_SCRIPT:
        await this._executeCustomScript(params.script, eventData)
        break
    }

    this.emit('actionExecuted', { action, params })
  }

  /**
   * 解析参数中的模板变量
   * @param {Object} params - 参数对象
   * @param {Object} eventData - 事件数据
   * @returns {Object}
   */
  _resolveParams(params, eventData) {
    const resolved = {}

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = this._resolveTemplate(value, eventData)
      } else {
        resolved[key] = value
      }
    }

    return resolved
  }

  /**
   * 解析模板字符串
   * 支持 {{variable}} 和 {{eventData.field}} 语法
   * @param {string} template - 模板字符串
   * @param {Object} eventData - 事件数据
   * @returns {string}
   */
  _resolveTemplate(template, eventData) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim()

      // 先检查 eventData
      if (trimmedPath.startsWith('eventData.')) {
        const fieldPath = trimmedPath.substring(10)
        return this._getNestedValue(eventData, fieldPath) || ''
      }

      // 检查变量存储
      const value = this._getNestedValue(this.variables, trimmedPath)
      return value !== undefined ? value : ''
    })
  }

  /**
   * 获取嵌套值
   * @param {Object} obj - 对象
   * @param {string} path - 路径
   * @returns {any}
   */
  _getNestedValue(obj, path) {
    const parts = path.split('.')
    let value = obj

    for (const part of parts) {
      if (value == null) return undefined
      value = value[part]
    }

    return value
  }

  /**
   * 延迟函数
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 执行自定义脚本
   * @param {string} script - 脚本代码
   * @param {Object} eventData - 事件数据
   */
  async _executeCustomScript(script, eventData) {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor
      const fn = new AsyncFunction('obs', 'eventData', 'variables', 'log', script)
      await fn(this.obs, eventData, this.variables, this.log)
    } catch (e) {
      this.log(`[TriggerManager] 自定义脚本执行错误: ${e.message}`)
      throw e
    }
  }

  /**
   * 导出规则
   * @returns {Object[]}
   */
  exportRules() {
    return this.getAllRules().map(r => r.toJSON())
  }

  /**
   * 导入规则
   * @param {Object[]} rules - 规则数组
   * @param {boolean} replace - 是否替换现有规则
   */
  importRules(rules, replace = false) {
    if (replace) {
      this.rules.clear()
    }

    for (const ruleData of rules) {
      this.addRule(ruleData)
    }
  }

  /**
   * 清除所有规则
   */
  clearRules() {
    this.rules.clear()
    this.emit('rulesCleared')
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.enabled = false
    this.clearRules()
    this.removeAllListeners()
  }
}

module.exports = {
  TriggerManager,
  TriggerRule,
  TriggerAction,
  TriggerCondition,
  TriggerType,
  ActionType
}
