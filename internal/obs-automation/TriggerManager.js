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
  BP_HUNTER_SELECTED: 'bp:hunter-selected',
  BP_SURVIVOR_SELECTED: 'bp:survivor-selected',
  BP_SURVIVOR_1_SELECTED: 'bp:survivor-1-selected',
  BP_SURVIVOR_2_SELECTED: 'bp:survivor-2-selected',
  BP_SURVIVOR_3_SELECTED: 'bp:survivor-3-selected',
  BP_SURVIVOR_4_SELECTED: 'bp:survivor-4-selected',
  BP_CHARACTER_BANNED: 'bp:character-banned',
  BP_ALL_SURVIVORS_SELECTED: 'bp:all-survivors-selected',
  BP_ROUND_CHANGED: 'bp:round-changed',

  // 本地 BP 增强事件
  LOCALBP_STATE_UPDATED: 'localbp:state-updated',
  LOCALBP_MAP_CHANGED: 'localbp:map-changed',
  LOCALBP_TEAM_CHANGED: 'localbp:team-changed',
  LOCALBP_SCORE_UPDATED: 'localbp:score-updated',
  LOCALBP_RESET: 'localbp:reset',

  // OBS 手动触发事件
  OBS_SIDEBAR_MANUAL_TRIGGER: 'obs:sidebar-manual-trigger',
  OBS_MUSIC_CONTROL: 'obs:music-control',

  // 计时事件
  TIMER_INTERVAL: 'timer:interval'
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
  CALL_CUSTOM_API: 'CALL_CUSTOM_API',          // 调用自定义 API
  EMIT_CUSTOM_EVENT: 'EMIT_CUSTOM_EVENT',      // 广播自定义事件到前台窗口
  SET_COMPONENT_PROPERTY: 'SET_COMPONENT_PROPERTY', // 修改自定义组件属性
  // 新增操作类型
  SET_SOURCE_SETTINGS: 'SET_SOURCE_SETTINGS',      // 通用源设置
  SET_SOURCE_TRANSFORM: 'SET_SOURCE_TRANSFORM',    // 源变换（位置、大小、旋转）
  SET_FILTER_SETTINGS: 'SET_FILTER_SETTINGS',      // 滤镜设置
  SET_FILTER_ENABLED: 'SET_FILTER_ENABLED',        // 滤镜启用/禁用
  SWITCH_MEDIA_INPUT: 'SWITCH_MEDIA_INPUT',        // 切换媒体源输入（URL/本地文件）
  MUSIC_PLAYLIST: 'MUSIC_PLAYLIST'                 // 音乐歌单（侧边栏按歌曲触发）
}

function parseDurationToMs(input, defaultValue = 0) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.max(0, Math.round(input))
  }

  if (typeof input !== 'string') return defaultValue
  const raw = input.trim().toLowerCase()
  if (!raw) return defaultValue

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Math.max(0, Math.round(Number(raw)))
  }

  if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(raw)) {
    const parts = raw.split(':').map(v => Number(v))
    if (parts.some(v => !Number.isFinite(v))) return defaultValue
    if (parts.length === 2) {
      return ((parts[0] * 60) + parts[1]) * 1000
    }
    return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000
  }

  let total = 0
  const regex = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g
  let matched = false
  let match
  while ((match = regex.exec(raw)) !== null) {
    matched = true
    const value = Number(match[1])
    const unit = match[2]
    if (!Number.isFinite(value)) continue
    if (unit === 'ms') total += value
    if (unit === 's') total += value * 1000
    if (unit === 'm') total += value * 60 * 1000
    if (unit === 'h') total += value * 60 * 60 * 1000
    if (unit === 'd') total += value * 24 * 60 * 60 * 1000
  }

  if (!matched) return defaultValue
  return Math.max(0, Math.round(total))
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
    this.triggerType = options.triggerType || TriggerType.BP_HUNTER_SELECTED
    this.conditions = (options.conditions || []).map(c => new TriggerCondition(c))
    this.actions = (options.actions || []).map(a => new TriggerAction(a))
    this.cooldown = options.cooldown || 0     // 冷却时间（毫秒）
    this.delay = options.delay || 0
    this.condition = typeof options.condition === 'string' ? options.condition.trim() : ''
    this.maxTriggers = Number.isFinite(options.maxTriggers) ? Number(options.maxTriggers) : 0
    this.interval = options.interval || options.timerInterval || options.intervalMs || 0
    this.triggerCount = 0
    this.lastTriggered = 0                    // 上次触发时间
  }

  /**
   * 检查是否可以触发
   * @param {Object} eventData - 事件数据
   * @returns {boolean}
   */
  canTrigger(eventData, variables = {}) {
    if (!this.enabled) return false

    // 检查冷却
    const cooldownMs = parseDurationToMs(this.cooldown, 0)
    if (cooldownMs > 0) {
      const now = Date.now()
      if (now - this.lastTriggered < cooldownMs) {
        return false
      }
    }

    if (this.maxTriggers > 0 && this.triggerCount >= this.maxTriggers) {
      return false
    }

    if (this.condition) {
      try {
        const fn = new Function('data', 'eventData', 'vars', `return !!(${this.condition});`)
        if (!fn(eventData, eventData, variables)) {
          return false
        }
      } catch {
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
    this.triggerCount += 1
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
      cooldown: this.cooldown,
      delay: this.delay,
      condition: this.condition,
      maxTriggers: this.maxTriggers,
      interval: this.interval
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

    /** @type {Function|null} */
    this.runtimeActionExecutor = typeof options.runtimeActionExecutor === 'function'
      ? options.runtimeActionExecutor
      : null

    /** @type {Array<{timerId: NodeJS.Timeout, ruleId: string}>} */
    this.activeTimers = []
    this.runningIntervalRules = new Set()

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
   * 设置运行时动作执行器
   * @param {Function|null} executor - async (actionType, params, eventData, context) => any
   */
  setRuntimeActionExecutor(executor) {
    this.runtimeActionExecutor = typeof executor === 'function' ? executor : null
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
    this._syncIntervalRule(triggerRule)
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
      this._clearIntervalRule(ruleId)
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
      this._syncIntervalRule(rule)
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
      this._syncIntervalRule(rule)
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
      if (rule.triggerType === eventType && rule.canTrigger(eventData, this.variables)) {
        this.log(`[TriggerManager] 规则匹配: ${rule.name}`)
        rule.markTriggered()
        await this._executeActions(rule, eventData)
      }
    }
  }

  /**
   * 按规则 ID 手动触发
   * @param {string} ruleId - 规则 ID
   * @param {Object} eventData - 事件数据
   * @param {Object} options - 选项
   * @param {boolean} options.force - 是否忽略条件与冷却
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async triggerRuleById(ruleId, eventData = {}, options = {}) {
    if (!this.enabled) {
      return { success: false, error: '触发器已禁用' }
    }

    const normalizedRuleId = typeof ruleId === 'string' ? ruleId.trim() : ''
    if (!normalizedRuleId) {
      return { success: false, error: '规则 ID 不能为空' }
    }

    const rule = this.rules.get(normalizedRuleId)
    if (!rule) {
      return { success: false, error: '规则不存在' }
    }

    const payload = (eventData && typeof eventData === 'object') ? eventData : {}
    const force = options?.force === true

    this.log(`[TriggerManager] 手动触发规则: ${rule.name} (${rule.id}), force=${force}`)

    this._updateVariables(rule.triggerType, payload)

    if (!force && !rule.canTrigger(payload, this.variables)) {
      this.log(`[TriggerManager] 手动触发被拒绝（条件或冷却未满足）: ${rule.name}`)
      return { success: false, error: '规则条件未满足或仍在冷却中' }
    }

    try {
      rule.markTriggered()
      await this._executeActions(rule, payload)
      return { success: true }
    } catch (e) {
      return { success: false, error: e?.message || String(e) }
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
      const selectedCount = survivors.filter(Boolean).length
      const bannedSurvivors = eventData.hunterBannedSurvivors || []
      const bannedHunters = eventData.survivorBannedHunters || []

      Object.assign(this.variables, {
        // 基础变量
        bpHunter: eventData.hunter || eventData.selectedHunter || eventData.character || '',
        bpSurvivors: survivors,
        bpBannedSurvivors: bannedSurvivors,
        bpBannedHunters: bannedHunters,
        bpRound: eventData.round || eventData.currentRound || 0,
        bpSurvivorSelectedCount: Number.isFinite(eventData.selectedCount) ? eventData.selectedCount : selectedCount,
        bpLatestSurvivor: eventData.survivor || eventData.character || '',

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

    if (eventType.startsWith('localbp:')) {
      const prevRoomId = this.variables.roomId || ''
      const prevRoomName = this.variables.roomName || ''
      const prevRoomStatus = this.variables.roomStatus || ''
      const prevMapName = this.variables.mapName || ''
      const prevTeamA = this.variables.localTeamA || ''
      const prevTeamB = this.variables.localTeamB || ''

      Object.assign(this.variables, {
        roomId: eventData.roomId || eventData.id || prevRoomId,
        roomName: eventData.roomName || eventData.name || prevRoomName,
        roomStatus: eventData.status || prevRoomStatus,
        mapName: eventData.mapName || prevMapName,
        localTeamA: eventData.teamA?.name || eventData.teamAName || prevTeamA,
        localTeamB: eventData.teamB?.name || eventData.teamBName || prevTeamB
      })

      Object.assign(this.variables, this._buildMatchVariables(eventData))
    }

    if (eventType === TriggerType.TIMER_INTERVAL) {
      Object.assign(this.variables, {
        timerRuleId: eventData.timerRuleId || '',
        timerRuleName: eventData.timerRuleName || '',
        intervalMs: Number.isFinite(eventData.intervalMs) ? eventData.intervalMs : 0
      })
    }
  }

  _asInteger(input, fallback = 0) {
    const n = parseInt(input, 10)
    return Number.isFinite(n) ? n : fallback
  }

  _asString(input, fallback = '') {
    if (typeof input === 'string') return input
    if (input == null) return fallback
    return String(input)
  }

  _normalizeHalf(input) {
    return input === 'lower' ? 'lower' : 'upper'
  }

  _resolveScoreDisplayTarget(scoreData) {
    const bos = Array.isArray(scoreData?.bos) ? scoreData.bos : []
    if (!bos.length) {
      return {
        round: 1,
        half: 'upper',
        scoreA: 0,
        scoreB: 0,
        boCount: 0
      }
    }

    const cfgRaw = (scoreData?.displayConfig && typeof scoreData.displayConfig === 'object') ? scoreData.displayConfig : {}
    const legacyHalf = (this._asInteger(scoreData?.currentHalf, 1) === 2) ? 'lower' : 'upper'
    const auto = (typeof cfgRaw.auto === 'boolean')
      ? cfgRaw.auto
      : !((scoreData?.scoreboardDisplay?.teamA === 'upper') || (scoreData?.scoreboardDisplay?.teamA === 'lower'))
    const round = Math.max(1, Math.min(bos.length, this._asInteger(cfgRaw.round, this._asInteger(scoreData?.currentRound, 1))))
    const half = this._normalizeHalf(cfgRaw.half || legacyHalf)

    let targetIndex = round - 1
    let targetHalf = half

    if (auto) {
      targetIndex = 0
      targetHalf = 'upper'
      let found = false
      for (let i = bos.length - 1; i >= 0; i--) {
        const bo = bos[i] || {}
        const hasLower = this._asInteger(bo?.lower?.teamA, 0) > 0 || this._asInteger(bo?.lower?.teamB, 0) > 0
        const hasUpper = this._asInteger(bo?.upper?.teamA, 0) > 0 || this._asInteger(bo?.upper?.teamB, 0) > 0
        if (hasLower) {
          targetIndex = i
          targetHalf = 'lower'
          found = true
          break
        }
        if (hasUpper) {
          targetIndex = i
          targetHalf = 'upper'
          found = true
          break
        }
      }
      if (!found) {
        targetIndex = 0
        targetHalf = 'upper'
      }
    }

    const bo = bos[targetIndex] || {}
    const halfData = bo[targetHalf] || {}
    return {
      round: targetIndex + 1,
      half: targetHalf,
      scoreA: this._asInteger(halfData.teamA, 0),
      scoreB: this._asInteger(halfData.teamB, 0),
      boCount: bos.length
    }
  }

  _buildMatchVariables(eventData = {}) {
    const vars = this.variables || {}
    const scoreData = (eventData?.scoreData && typeof eventData.scoreData === 'object') ? eventData.scoreData : null
    const target = this._resolveScoreDisplayTarget(scoreData)

    const teamAName = this._asString(
      scoreData?.teamAName ?? eventData?.teamA?.name ?? eventData?.teamAName ?? vars.matchTeamA ?? vars.localTeamA ?? '',
      ''
    )
    const teamBName = this._asString(
      scoreData?.teamBName ?? eventData?.teamB?.name ?? eventData?.teamBName ?? vars.matchTeamB ?? vars.localTeamB ?? '',
      ''
    )
    const scoreA = this._asInteger(scoreData?.teamAWins, this._asInteger(eventData?.matchScoreA, this._asInteger(vars.matchScoreA, 0)))
    const scoreB = this._asInteger(scoreData?.teamBWins, this._asInteger(eventData?.matchScoreB, this._asInteger(vars.matchScoreB, 0)))
    const drawA = this._asInteger(scoreData?.teamADraws, this._asInteger(eventData?.matchDrawA, this._asInteger(vars.matchDrawA, 0)))
    const drawB = this._asInteger(scoreData?.teamBDraws, this._asInteger(eventData?.matchDrawB, this._asInteger(vars.matchDrawB, 0)))
    const mapName = this._asString(eventData?.mapName ?? vars.mapName ?? '', '')
    const round = this._asInteger(target.round, this._asInteger(vars.matchRound, 1))
    const half = this._normalizeHalf(target.half || vars.matchHalf)
    const halfText = half === 'lower' ? '下半局' : '上半局'
    const smallA = this._asInteger(target.scoreA, this._asInteger(vars.matchSmallScoreA, 0))
    const smallB = this._asInteger(target.scoreB, this._asInteger(vars.matchSmallScoreB, 0))
    const boCount = this._asInteger(target.boCount, this._asInteger(vars.matchBoCount, 0))

    const hasTeamNames = !!(teamAName || teamBName)
    return {
      matchTeamA: teamAName,
      matchTeamB: teamBName,
      matchScoreA: scoreA,
      matchScoreB: scoreB,
      matchDrawA: drawA,
      matchDrawB: drawB,
      matchMap: mapName,
      matchRound: round,
      matchHalf: half,
      matchHalfText: halfText,
      matchBoCount: boCount,
      matchSmallScoreA: smallA,
      matchSmallScoreB: smallB,
      matchScore: `${scoreA}:${scoreB}`,
      matchSmallScore: `${smallA}:${smallB}`,
      matchTitle: hasTeamNames ? `${teamAName} vs ${teamBName}` : '',
      matchScoreText: hasTeamNames ? `${teamAName} ${scoreA} : ${scoreB} ${teamBName}` : `${scoreA}:${scoreB}`
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

    const ruleDelayMs = parseDurationToMs(rule.delay, 0)
    if (ruleDelayMs > 0) {
      this.log(`[TriggerManager] ⏱️ 规则级延迟 ${ruleDelayMs}ms`)
      await this._delay(ruleDelayMs)
    }

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
      const actionDelayMs = parseDurationToMs(action.delay, 0)
      if (actionDelayMs > 0) {
        this.log(`[TriggerManager] 延迟 ${actionDelayMs}ms 后执行操作: ${action.type}`)
        await this._delay(actionDelayMs)
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
      'call-custom-api': ActionType.CALL_CUSTOM_API,
      'emit-custom-event': ActionType.EMIT_CUSTOM_EVENT,
      'set-component-property': ActionType.SET_COMPONENT_PROPERTY,
      // 新操作类型别名
      'set-source-settings': ActionType.SET_SOURCE_SETTINGS,
      'set-source-transform': ActionType.SET_SOURCE_TRANSFORM,
      'set-filter-settings': ActionType.SET_FILTER_SETTINGS,
      'set-filter-enabled': ActionType.SET_FILTER_ENABLED,
      'switch-media-input': ActionType.SWITCH_MEDIA_INPUT,
      'music-playlist': ActionType.MUSIC_PLAYLIST
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
        {
          const delayMs = parseDurationToMs(
            params.duration ?? params.durationMs ?? params.value,
            1000
          )
          this.log(`[TriggerManager] ⏱️ 等待 ${delayMs}ms...`)
          await this._delay(delayMs)
        }
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

      case ActionType.SWITCH_MEDIA_INPUT:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法切换媒体源输入`)
          return
        }
        if (!params.sourceName) {
          this.log(`[TriggerManager] ❌ 缺少 sourceName`)
          return
        }
        {
          const mediaUrl = (params.mediaUrl || params.url || params.input || '').trim()
          if (!mediaUrl) {
            this.log(`[TriggerManager] ❌ 缺少 mediaUrl/url/input`)
            return
          }
          const isLocalFile = typeof params.isLocalFile === 'boolean'
            ? params.isLocalFile
            : !/^https?:\/\//i.test(mediaUrl)
          this.log(`[TriggerManager] 🎵 切换媒体源输入: ${params.sourceName} -> ${mediaUrl}`)
          await this.obs.switchMediaInput(params.sourceName, mediaUrl, {
            isLocalFile,
            restart: params.restart !== false,
            overlay: params.overlay !== false
          })
          this.log(`[TriggerManager] ✅ 媒体源输入切换成功`)
        }
        break

      case ActionType.MUSIC_PLAYLIST:
        if (!this.obs || !this.obs.identified) {
          this.log(`[TriggerManager] ❌ OBS 未连接，无法切歌`)
          return
        }
        {
          const sourceName = String(
            eventData?.sourceName || params.sourceName || ''
          ).trim()
          if (!sourceName) {
            this.log(`[TriggerManager] ❌ 音乐歌单缺少 sourceName`)
            return
          }

          const tracks = this._parseMusicPlaylistTracks(params)
          if (!tracks.length) {
            this.log(`[TriggerManager] ❌ 音乐歌单为空`)
            return
          }

          const selectedTrack = eventData?.selectedTrack && typeof eventData.selectedTrack === 'object'
            ? eventData.selectedTrack
            : null
          const selectedByUrl = typeof eventData?.trackUrl === 'string'
            ? eventData.trackUrl.trim()
            : ''
          const selectedById = typeof eventData?.trackId === 'string'
            ? eventData.trackId.trim()
            : ''
          const selectedByIndex = Number.isFinite(Number(eventData?.trackIndex))
            ? Number(eventData.trackIndex)
            : null

          let selected = null
          if (selectedTrack && typeof selectedTrack.url === 'string' && selectedTrack.url.trim()) {
            selected = {
              id: String(selectedTrack.id || selectedById || 'track').trim(),
              name: String(selectedTrack.name || eventData?.trackName || '歌曲').trim(),
              url: selectedTrack.url.trim(),
              isLocalFile: typeof selectedTrack.isLocalFile === 'boolean'
                ? selectedTrack.isLocalFile
                : !/^https?:\/\//i.test(selectedTrack.url.trim())
            }
          }
          if (!selected && selectedByUrl) {
            selected = tracks.find(track => track.url === selectedByUrl) || null
          }
          if (!selected && selectedById) {
            selected = tracks.find(track => track.id === selectedById) || null
          }
          if (!selected && selectedByIndex != null && selectedByIndex >= 0 && selectedByIndex < tracks.length) {
            selected = tracks[selectedByIndex]
          }
          if (!selected) {
            selected = tracks[0]
          }
          if (!selected || !selected.url) {
            this.log(`[TriggerManager] ❌ 未找到可播放歌曲`)
            return
          }

          this.log(`[TriggerManager] 🎵 播放歌曲: ${selected.name || selected.url}`)
          await this.obs.switchMediaInput(sourceName, selected.url, {
            isLocalFile: selected.isLocalFile,
            restart: params.restart !== false,
            overlay: params.overlay !== false
          })
          this.log(`[TriggerManager] ✅ 切歌成功`)
        }
        break

      case ActionType.EXECUTE_COMMAND:
        this.emit('executeCommand', params.command, params.args)
        break

      case ActionType.CUSTOM_SCRIPT:
        await this._executeCustomScript(params.script, eventData)
        break

      case ActionType.CALL_CUSTOM_API:
      case ActionType.EMIT_CUSTOM_EVENT:
      case ActionType.SET_COMPONENT_PROPERTY:
        if (this.runtimeActionExecutor) {
          await this.runtimeActionExecutor(actionType, params, eventData, {
            variables: { ...this.variables }
          })
        } else {
          this.log(`[TriggerManager] ⚠️ 未配置 runtimeActionExecutor，跳过动作: ${actionType}`)
        }
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

  _parseMusicPlaylistTracks(params = {}) {
    const out = []
    const pushTrack = (raw, idx = 0) => {
      if (!raw || typeof raw !== 'object') return
      const id = String(raw.id || `track-${idx + 1}`).trim()
      const name = String(raw.name || `歌曲 ${idx + 1}`).trim()
      const url = String(raw.url || raw.mediaUrl || '').trim()
      if (!url) return
      const isLocalFile = typeof raw.isLocalFile === 'boolean'
        ? raw.isLocalFile
        : !/^https?:\/\//i.test(url)
      out.push({ id, name, url, isLocalFile })
    }

    if (Array.isArray(params.tracks)) {
      params.tracks.forEach((track, idx) => pushTrack(track, idx))
    }

    const tracksJsonRaw = typeof params.tracksJson === 'string' ? params.tracksJson.trim() : ''
    if (tracksJsonRaw) {
      try {
        const parsed = JSON.parse(tracksJsonRaw)
        if (Array.isArray(parsed)) {
          parsed.forEach((track, idx) => pushTrack(track, out.length + idx))
        }
      } catch {
        // ignore invalid json
      }
    }

    const tracksTextRaw = typeof params.tracksText === 'string' ? params.tracksText : ''
    if (tracksTextRaw.trim()) {
      const lines = tracksTextRaw.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      lines.forEach((line, idx) => {
        const parts = line.includes('|') ? line.split('|') : line.split(',')
        const name = String(parts[0] || '').trim()
        const url = String(parts.slice(1).join('|') || '').trim()
        if (!url) return
        pushTrack({ name: name || `歌曲 ${idx + 1}`, url }, out.length + idx)
      })
    }

    const deduped = []
    const seen = new Set()
    for (const item of out) {
      const key = `${item.id}::${item.url}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
    }
    return deduped
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
    const delayMs = Math.max(0, parseDurationToMs(ms, 0))
    return new Promise(resolve => setTimeout(resolve, delayMs))
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
      this._clearAllIntervalRules()
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
    this._clearAllIntervalRules()
    this.rules.clear()
    this.emit('rulesCleared')
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.enabled = false
    this._clearAllIntervalRules()
    this.clearRules()
    this.removeAllListeners()
  }

  _syncIntervalRule(rule) {
    this._clearIntervalRule(rule.id)

    if (!rule || !rule.enabled || rule.triggerType !== TriggerType.TIMER_INTERVAL) {
      return
    }

    const intervalMs = parseDurationToMs(rule.interval, 60000)
    if (intervalMs <= 0) return

    const timerId = setInterval(async () => {
      if (!this.enabled) return
      if (this.runningIntervalRules.has(rule.id)) return
      this.runningIntervalRules.add(rule.id)
      try {
        const eventData = {
          timerRuleId: rule.id,
          timerRuleName: rule.name,
          intervalMs,
          timestamp: Date.now()
        }
        this._updateVariables(TriggerType.TIMER_INTERVAL, eventData)
        if (rule.canTrigger(eventData, this.variables)) {
          rule.markTriggered()
          await this._executeActions(rule, eventData)
        }
      } catch (e) {
        this.log(`[TriggerManager] 定时规则执行失败: ${rule.name} - ${e.message}`)
      } finally {
        this.runningIntervalRules.delete(rule.id)
      }
    }, intervalMs)

    this.activeTimers.push({ timerId, ruleId: rule.id })
  }

  _clearIntervalRule(ruleId) {
    this.activeTimers = this.activeTimers.filter((item) => {
      if (item.ruleId !== ruleId) return true
      clearInterval(item.timerId)
      this.runningIntervalRules.delete(ruleId)
      return false
    })
  }

  _clearAllIntervalRules() {
    for (const item of this.activeTimers) {
      clearInterval(item.timerId)
    }
    this.activeTimers = []
    this.runningIntervalRules.clear()
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
