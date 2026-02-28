/**
 * OBS 自动化插件
 * 通过 OBS WebSocket 5.x 协议控制 OBS Studio
 * 支持事件触发、场景切换、自动化规则
 */

const path = require('path')
const { BrowserWindow, ipcMain } = require('electron')
const OBSWebSocket = require('./OBSWebSocket')
const { TriggerManager, TriggerType, ActionType } = require('./TriggerManager')

// 全局实例
let obs = null
let triggerManager = null
let pluginContext = null
let ruleEditorWindow = null

const IPC_CHANNELS = [
  'obs-automation:save-config',
  'obs-automation:get-config',
  'obs-automation:connect',
  'obs-automation:disconnect',
  'obs-automation:get-status',
  'obs-automation:get-rules',
  'obs-automation:save-rules',
  'obs-automation:test-rule',
  'obs-automation:switch-scene'
]

// 插件日志前缀
const LOG_PREFIX = '[OBS 自动化]'

/**
 * 插件激活函数
 * @param {Object} context - 插件上下文
 */
async function activate(context) {
  const { api, extensionPath, globalState, subscriptions, log } = context

  pluginContext = context

  log('🚀 正在激活插件...')
  log(`📁 插件路径: ${extensionPath || __dirname}`)

  // 创建 OBS WebSocket 实例
  obs = new OBSWebSocket()

  // 创建触发器管理器
  triggerManager = new TriggerManager({ obs, log })

  // 设置 OBS 事件监听
  setupOBSEventListeners(api, log)

  // 注册命令
  registerCommands(api, log, globalState, subscriptions)

  // 注册菜单项 - 使用顶部菜单栏（不使用卡片）
  registerMenu(api, log, subscriptions)

  // 设置 Director 事件监听
  setupDirectorEventListeners(api, log, subscriptions)

  // 加载已保存的规则
  loadSavedRules(globalState, log)

  // 注册 IPC 处理器
  registerIPCHandlers(api, globalState, log)

  // 尝试自动连接
  const config = globalState.get('config', {})
  if (config.autoConnect) {
    setTimeout(() => {
      connectToOBS(config, log).catch(() => { })
    }, 2000)
  }

  log('✅ OBS 自动化插件已激活')

  // 返回公共 API
  return {
    getOBS: () => obs,
    getTriggerManager: () => triggerManager,
    isConnected: () => obs && obs.identified,
    connect: (cfg) => connectToOBS(cfg || config, log),
    disconnect: () => obs && obs.disconnect(),
    switchScene: (name) => obs && obs.setCurrentScene(name),
    getScenes: () => obs ? obs.scenes : [],
    openRuleEditor: () => openRuleEditorWindow(globalState, log)
  }
}

/**
 * 连接到 OBS
 */
async function connectToOBS(config, log) {
  try {
    await obs.connect({
      host: config.host || 'localhost',
      port: config.port || 4455,
      password: config.password || '',
      reconnect: true
    })
    log('✅ 已连接到 OBS')
    return true
  } catch (e) {
    log(`❌ 连接 OBS 失败: ${e.message}`)
    throw e
  }
}

/**
 * 设置 OBS 事件监听
 */
function setupOBSEventListeners(api, log) {
  obs.on('connected', () => {
    log('📡 OBS WebSocket 已连接')
    api.notifications?.showSuccess?.('已连接到 OBS', { title: 'OBS 自动化', duration: 3000 })
    broadcastStatus()
  })

  obs.on('identified', () => {
    log('🔐 OBS 认证成功')
    broadcastStatus()
  })

  obs.on('disconnected', () => {
    log('📡 OBS WebSocket 已断开')
    api.notifications?.showWarning?.('OBS 连接已断开', { title: 'OBS 自动化', duration: 3000 })
    broadcastStatus()
  })

  obs.on('error', (error) => {
    log(`❌ OBS 错误: ${error.message}`)
  })

  obs.on('sceneChanged', (sceneName) => {
    log(`🎬 OBS 场景已切换: ${sceneName}`)
    broadcastStatus()
  })

  obs.on('scenesLoaded', (scenes) => {
    log(`📋 OBS 场景列表: ${scenes.join(', ')}`)
    broadcastStatus()
  })
}

/**
 * 广播 OBS 状态到所有窗口
 */
function broadcastStatus() {
  if (ruleEditorWindow && !ruleEditorWindow.isDestroyed()) {
    ruleEditorWindow.webContents.send('obs-status', {
      connected: obs && obs.identified,
      currentScene: obs ? obs.currentScene : null,
      scenes: obs ? obs.scenes : []
    })
  }
}

/**
 * 注册命令
 */
function registerCommands(api, log, globalState, subscriptions) {
  log('📝 注册命令...')

  // 打开规则编辑器
  subscriptions.push(
    api.commands.registerCommand('obsAutomation.openRuleEditor', () => {
      log('📋 打开规则编辑器')
      openRuleEditorWindow(globalState, log)
    })
  )

  // 连接 OBS
  subscriptions.push(
    api.commands.registerCommand('obsAutomation.connect', async () => {
      log('🔌 执行连接命令')
      const config = globalState.get('config', {})
      try {
        await connectToOBS(config, log)
      } catch (e) {
        api.notifications?.showError?.(`连接失败: ${e.message}`, { title: 'OBS 自动化' })
      }
    })
  )

  // 断开连接
  subscriptions.push(
    api.commands.registerCommand('obsAutomation.disconnect', () => {
      log('🔌 执行断开命令')
      if (obs) obs.disconnect()
      api.notifications?.showInfo?.('已断开 OBS 连接', { title: 'OBS 自动化' })
    })
  )

  // 切换场景
  subscriptions.push(
    api.commands.registerCommand('obsAutomation.switchScene', async (sceneName) => {
      if (!obs || !obs.identified) {
        api.notifications?.showWarning?.('请先连接 OBS', { title: 'OBS 自动化' })
        return
      }
      try {
        await obs.setCurrentScene(sceneName)
        log(`🎬 已切换到场景: ${sceneName}`)
      } catch (e) {
        api.notifications?.showError?.(`切换场景失败: ${e.message}`, { title: 'OBS 自动化' })
      }
    })
  )

  log('✅ 命令注册完成')
}

/**
 * 注册菜单项 - 在顶部菜单栏添加
 */
function registerMenu(api, log, subscriptions) {
  log('📋 注册菜单项...')

  if (!api.components?.registerMenuItem) {
    log('⚠️ 菜单 API 不可用')
    return
  }

  // 主菜单项 - OBS 自动化
  subscriptions.push(
    api.components.registerMenuItem({
      id: 'obsAutomation.menu',
      pluginId: 'obs-automation',
      label: 'OBS 自动化',
      icon: '🎬',
      order: 60,
      command: 'obsAutomation.openRuleEditor',
      group: 'tools'
    })
  )

  // 通知主页刷新菜单栏
  try {
    api.ipc?.broadcast?.('components-changed')
  } catch {
    // ignore
  }

  log('✅ 菜单项注册完成')
}

/**
 * 注册 IPC 处理器
 */
function registerIPCHandlers(api, globalState, log) {
  // 开发/热重载场景下可能重复激活：先移除旧 handler，避免 "Attempted to register a second handler" 报错
  for (const ch of IPC_CHANNELS) {
    try {
      ipcMain.removeHandler(ch)
    } catch {
      // ignore
    }
  }

  // 保存配置
  ipcMain.handle('obs-automation:save-config', (event, config) => {
    globalState.set('config', config)
    log('💾 配置已保存')
    return { success: true }
  })

  // 获取配置
  ipcMain.handle('obs-automation:get-config', () => {
    return globalState.get('config', {
      host: 'localhost',
      port: 4455,
      password: '',
      autoConnect: false
    })
  })

  // 连接 OBS
  ipcMain.handle('obs-automation:connect', async (event, config) => {
    if (config) {
      globalState.set('config', config)
    }
    const cfg = globalState.get('config', {})
    try {
      await connectToOBS(cfg, log)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })

  // 断开 OBS
  ipcMain.handle('obs-automation:disconnect', () => {
    if (obs) obs.disconnect()
    return { success: true }
  })

  // 获取状态
  ipcMain.handle('obs-automation:get-status', () => {
    return {
      connected: obs && obs.identified,
      currentScene: obs ? obs.currentScene : null,
      scenes: obs ? obs.scenes : []
    }
  })

  // 获取规则
  ipcMain.handle('obs-automation:get-rules', () => {
    return triggerManager ? triggerManager.exportRules() : []
  })

  // 保存规则
  ipcMain.handle('obs-automation:save-rules', (event, rules) => {
    globalState.set('rules', rules)
    if (triggerManager) {
      triggerManager.clearRules()
      rules.forEach(rule => triggerManager.addRule(rule))
    }
    log(`💾 已保存 ${rules.length} 条规则`)
    return { success: true }
  })

  // 测试规则
  ipcMain.handle('obs-automation:test-rule', async (event, rule) => {
    log(`🧪 测试规则: ${rule.name}`)
    if (triggerManager) {
      await triggerManager.handleEvent(rule.triggerType || rule.event, { test: true })
    }
    return { success: true }
  })

  // 切换场景
  ipcMain.handle('obs-automation:switch-scene', async (event, sceneName) => {
    if (!obs || !obs.identified) {
      return { success: false, error: '未连接到 OBS' }
    }
    try {
      await obs.setCurrentScene(sceneName)
      return { success: true }
    } catch (e) {
      return { success: false, error: e.message }
    }
  })
}

function unregisterIPCHandlers() {
  for (const ch of IPC_CHANNELS) {
    try {
      ipcMain.removeHandler(ch)
    } catch {
      // ignore
    }
  }
}

/**
 * 设置 Director 事件监听
 */
function setupDirectorEventListeners(api, log, subscriptions) {
  if (!api.events) {
    log('⚠️ 事件 API 不可用')
    return
  }

  log('📡 设置 Director 事件监听...')

  // BP 相关事件
  const eventMappings = {
    'bp:started': TriggerType.BP_STARTED,
    'bp:ended': TriggerType.BP_ENDED,
    'bp:character-banned': TriggerType.BP_CHARACTER_BANNED,
    'bp:character-picked': null, // 需要特殊处理
    'bp:round-changed': TriggerType.BP_ROUND_CHANGED,
    'match:started': TriggerType.MATCH_STARTED,
    'match:ended': TriggerType.MATCH_ENDED,
    'match:score-updated': TriggerType.MATCH_SCORE_UPDATED,
    'match:map-changed': TriggerType.MATCH_MAP_CHANGED,
    'room:connected': TriggerType.ROOM_CONNECTED,
    'room:disconnected': TriggerType.ROOM_DISCONNECTED
  }

  Object.entries(eventMappings).forEach(([eventName, triggerType]) => {
    if (triggerType) {
      subscriptions.push(
        api.events.on(eventName, (data) => {
          log(`📨 收到事件: ${eventName}，数据:`, JSON.stringify(data).substring(0, 200))
          log(`🔍 TriggerManager 状态: ${triggerManager ? '存在' : '不存在'}, 规则数量: ${triggerManager ? triggerManager.getAllRules().length : 0}`)
          if (triggerManager) {
            log(`⚡ 开始处理事件: ${triggerType}`)
            triggerManager.handleEvent(triggerType, data)
          } else {
            log(`❌ TriggerManager 不存在，无法处理事件`)
          }
        })
      )
    }
  })

  // 特殊处理 character-picked 事件
  subscriptions.push(
    api.events.on('bp:character-picked', (data) => {
      log(`📨 角色被选择: ${data.character || '未知'}`)
      log(`🔍 角色数据: type=${data.type}, isHunter=${data.isHunter}, character=${data.character}`)

      if (!triggerManager) {
        log(`❌ TriggerManager 不存在`)
        return
      }

      if (data.type === 'hunter' || data.isHunter) {
        log(`⚡ 触发监管者选择事件`)
        triggerManager.handleEvent(TriggerType.BP_HUNTER_SELECTED, data)
      } else {
        log(`⚡ 触发求生者选择事件`)
        triggerManager.handleEvent(TriggerType.BP_SURVIVOR_SELECTED, data)

        if (data.survivors && data.survivors.filter(s => s).length === 4) {
          log(`⚡ 触发所有求生者选择完成事件`)
          triggerManager.handleEvent(TriggerType.BP_ALL_SURVIVORS_SELECTED, data)
        }
      }
    })
  )

  // 监听房间更新：既触发规则，也从房间数据解析 BP 状态（避免重复订阅导致监听器叠加）
  subscriptions.push(
    api.events.on('room:updated', (data) => {
      log('📨 收到事件: room:updated')
      if (triggerManager) {
        triggerManager.handleEvent(TriggerType.ROOM_UPDATED, data)
      }
      parseBPStateFromRoomData(data, log)
    })
  )

  log('✅ Director 事件监听设置完成')
}

/**
 * 从房间数据解析 BP 状态
 */
function parseBPStateFromRoomData(roomData, log) {
  if (!roomData || !roomData.data || !triggerManager) return

  const state = roomData.data.state || roomData.data
  if (!state) return

  const currentRound = state.currentRoundData
  if (!currentRound) return

  // 检测监管者选择完成
  const hunter = currentRound.selectedHunter
  if (hunter && triggerManager.variables.lastHunter !== hunter) {
    triggerManager.variables.lastHunter = hunter
    triggerManager.handleEvent(TriggerType.BP_HUNTER_SELECTED, {
      hunter,
      character: hunter,
      ...currentRound
    })
  }

  // 检测求生者选择
  const survivors = currentRound.selectedSurvivors || []
  const selectedCount = survivors.filter(s => s).length
  const lastSelectedCount = triggerManager.variables.lastSurvivorCount || 0

  if (selectedCount > lastSelectedCount) {
    triggerManager.variables.lastSurvivorCount = selectedCount

    const newSurvivor = survivors.find((s, i) =>
      s && (!triggerManager.variables.lastSurvivors || !triggerManager.variables.lastSurvivors[i])
    )

    if (newSurvivor) {
      triggerManager.handleEvent(TriggerType.BP_SURVIVOR_SELECTED, {
        survivor: newSurvivor,
        character: newSurvivor,
        index: survivors.indexOf(newSurvivor),
        survivors,
        ...currentRound
      })
    }

    triggerManager.variables.lastSurvivors = [...survivors]

    if (selectedCount === 4) {
      triggerManager.handleEvent(TriggerType.BP_ALL_SURVIVORS_SELECTED, {
        survivors,
        ...currentRound
      })
    }
  }
}

/**
 * 加载已保存的规则
 */
function loadSavedRules(globalState, log) {
  const rules = globalState.get('rules', [])
  log(`📂 准备加载规则，共 ${rules.length} 条`)

  if (rules.length > 0) {
    log(`📂 开始加载 ${rules.length} 条已保存的规则:`)
    rules.forEach((rule, index) => {
      log(`  [${index + 1}] ${rule.name} - ${rule.enabled ? '✅ 启用' : '❌ 禁用'} - 触发: ${rule.triggerType}`)
      triggerManager.addRule(rule)
    })
    log(`✅ 规则加载完成，TriggerManager 中共有 ${triggerManager.getAllRules().length} 条规则`)
  } else {
    log('📋 没有保存的规则，添加默认示例规则')
    // 添加示例规则
    addDefaultRules(log)
    log(`✅ 默认规则已添加，TriggerManager 中共有 ${triggerManager.getAllRules().length} 条规则`)
  }
}

/**
 * 添加默认示例规则
 */
function addDefaultRules(log) {
  const defaultRules = [
    {
      id: 'default_1',
      name: '监管者选完切场景',
      description: '当监管者选择完成后，延迟3秒切换到游戏场景',
      enabled: false,
      triggerType: TriggerType.BP_HUNTER_SELECTED,
      actions: [
        { type: ActionType.DELAY, params: { duration: 3000 } },
        { type: ActionType.SWITCH_SCENE, params: { sceneName: '游戏场景' } }
      ]
    },
    {
      id: 'default_2',
      name: '求生者全选完切场景',
      description: '当所有求生者选择完成后，延迟2秒切换到游戏场景',
      enabled: false,
      triggerType: TriggerType.BP_ALL_SURVIVORS_SELECTED,
      actions: [
        { type: ActionType.DELAY, params: { duration: 2000 } },
        { type: ActionType.SWITCH_SCENE, params: { sceneName: '游戏场景' } }
      ]
    },
    {
      id: 'default_3',
      name: '比赛开始切场景',
      description: '当比赛开始时切换到比赛场景',
      enabled: false,
      triggerType: TriggerType.MATCH_STARTED,
      actions: [
        { type: ActionType.SWITCH_SCENE, params: { sceneName: '比赛场景' } }
      ]
    }
  ]

  defaultRules.forEach(rule => triggerManager.addRule(rule))
  log('📋 已添加默认示例规则（默认禁用）')
}

/**
 * 打开规则编辑器窗口
 */
function openRuleEditorWindow(globalState, log) {
  // 如果窗口已存在，聚焦它
  if (ruleEditorWindow && !ruleEditorWindow.isDestroyed()) {
    ruleEditorWindow.focus()
    return
  }

  log('🪟 创建规则编辑器窗口')

  const pluginPath = pluginContext?.extensionPath || __dirname

  ruleEditorWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'OBS 自动化 - 规则编辑器',
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(pluginPath, 'rule-editor-preload.js')
    }
  })

  ruleEditorWindow.setMenu(null)

  // 加载规则编辑器页面
  const htmlPath = path.join(pluginPath, 'rule-editor.html')
  ruleEditorWindow.loadFile(htmlPath)

  // 开发模式下打开 DevTools
  // ruleEditorWindow.webContents.openDevTools()

  ruleEditorWindow.on('closed', () => {
    ruleEditorWindow = null
  })
}

/**
 * 插件停用函数
 */
function deactivate() {
  console.log(`${LOG_PREFIX} 插件正在停用...`)

  // 保存规则
  if (pluginContext && triggerManager) {
    const rules = triggerManager.exportRules()
    pluginContext.globalState.set('rules', rules)
  }

  // 关闭规则编辑器窗口
  if (ruleEditorWindow && !ruleEditorWindow.isDestroyed()) {
    ruleEditorWindow.close()
  }

  unregisterIPCHandlers()

  // 断开 OBS 连接
  if (obs) {
    obs.disconnect()
    obs = null
  }

  triggerManager = null
  pluginContext = null

  console.log(`${LOG_PREFIX} 插件已停用`)
}

module.exports = { activate, deactivate }
