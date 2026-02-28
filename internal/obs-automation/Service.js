const fs = require('fs')
const path = require('path')
const { BrowserWindow, ipcMain } = require('electron')
const OBSWebSocket = require('./OBSWebSocket')
const { TriggerManager, TriggerType, ActionType } = require('./TriggerManager')

const DEFAULT_MUSIC_CONTROL = {
  sourceName: '',
  restartOnSwitch: true,
  tracks: []
}

const DEFAULT_CONFIG = {
  host: 'localhost',
  port: 4455,
  password: '',
  autoConnect: false,
  musicControl: { ...DEFAULT_MUSIC_CONTROL, tracks: [] }
}

const STORAGE_FILE = 'obs-automation.json'

const IPC_CHANNELS = [
  'obs-automation:save-config',
  'obs-automation:get-config',
  'obs-automation:connect',
  'obs-automation:disconnect',
  'obs-automation:get-status',
  'obs-automation:get-rules',
  'obs-automation:save-rules',
  'obs-automation:test-rule',
  'obs-automation:switch-scene',
  'obs-automation:get-sidebar-manual-rules',
  'obs-automation:trigger-sidebar-manual-rule',
  'obs-automation:get-music-config',
  'obs-automation:save-music-config',
  'obs-automation:switch-song',
  'obs-automation:open-editor',
  'obs-automation:open-tutorial'
]

const ALLOWED_TRIGGER_TYPES = new Set([
  TriggerType.BP_HUNTER_SELECTED,
  TriggerType.BP_SURVIVOR_SELECTED,
  TriggerType.BP_SURVIVOR_1_SELECTED,
  TriggerType.BP_SURVIVOR_2_SELECTED,
  TriggerType.BP_SURVIVOR_3_SELECTED,
  TriggerType.BP_SURVIVOR_4_SELECTED,
  TriggerType.BP_ALL_SURVIVORS_SELECTED,
  TriggerType.BP_CHARACTER_BANNED,
  TriggerType.BP_ROUND_CHANGED,
  TriggerType.LOCALBP_STATE_UPDATED,
  TriggerType.LOCALBP_MAP_CHANGED,
  TriggerType.LOCALBP_TEAM_CHANGED,
  TriggerType.LOCALBP_SCORE_UPDATED,
  TriggerType.LOCALBP_RESET,
  TriggerType.OBS_SIDEBAR_MANUAL_TRIGGER,
  TriggerType.OBS_MUSIC_CONTROL,
  TriggerType.TIMER_INTERVAL
])

class ObsAutomationService {
  constructor() {
    this.app = null
    this.obs = null
    this.triggerManager = null
    this.ruleEditorWindow = null
    this.tutorialWindow = null
    this.storagePath = ''
    this.state = { config: this._normalizeConfig(DEFAULT_CONFIG), rules: [] }
    this.lastSnapshot = null
    this.lastScoreSnapshot = null
    this.lastScoreSignature = ''
  }

  initialize({ app }) {
    this.app = app
    this.storagePath = path.join(app.getPath('userData'), STORAGE_FILE)
    this.state = this._loadState()

    this.obs = new OBSWebSocket()
    this.triggerManager = new TriggerManager({
      obs: this.obs,
      log: (...args) => console.log('[OBS 内置]', ...args),
      runtimeActionExecutor: (actionType, params, eventData, context) =>
        this._executeRuntimeAction(actionType, params, eventData, context)
    })

    this._setupOBSEvents()
    this._registerIPCHandlers()
    this._loadRulesIntoManager(this.state.rules)

    if (this.state.config.autoConnect) {
      setTimeout(() => {
        this.connect(this.state.config).catch(() => {})
      }, 1200)
    }
  }

  shutdown() {
    this._unregisterIPCHandlers()
    if (this.ruleEditorWindow && !this.ruleEditorWindow.isDestroyed()) {
      this.ruleEditorWindow.close()
    }
    this.ruleEditorWindow = null
    if (this.tutorialWindow && !this.tutorialWindow.isDestroyed()) {
      this.tutorialWindow.close()
    }
    this.tutorialWindow = null
    if (this.obs) {
      this.obs.disconnect()
    }
    if (this.triggerManager) {
      this.triggerManager.destroy()
    }
    this.obs = null
    this.triggerManager = null
    this.lastSnapshot = null
    this.lastScoreSnapshot = null
    this.lastScoreSignature = ''
  }

  async connect(config) {
    if (!this.obs) throw new Error('OBS 服务未初始化')
    const merged = this._normalizeConfig({
      ...(this.state.config || {}),
      ...(config || {})
    })
    this.state.config = merged
    this._saveState()
    await this.obs.connect({
      host: merged.host,
      port: merged.port,
      password: merged.password,
      reconnect: true
    })
    return true
  }

  openEditorWindow() {
    if (this.ruleEditorWindow && !this.ruleEditorWindow.isDestroyed()) {
      this.ruleEditorWindow.focus()
      return { success: true }
    }

    this.ruleEditorWindow = new BrowserWindow({
      width: 1200,
      height: 820,
      title: 'OBS 自动化（内置）',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'rule-editor-preload.js')
      }
    })

    this.ruleEditorWindow.setMenu(null)
    this.ruleEditorWindow.loadFile(path.join(__dirname, '..', '..', 'pages', 'obs-automation.html'))
    this.ruleEditorWindow.on('closed', () => {
      this.ruleEditorWindow = null
    })
    return { success: true }
  }

  openTutorial() {
    if (this.tutorialWindow && !this.tutorialWindow.isDestroyed()) {
      this.tutorialWindow.focus()
      return { success: true }
    }

    this.tutorialWindow = new BrowserWindow({
      width: 960,
      height: 760,
      title: 'OBS 自动化使用教程',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    this.tutorialWindow.setMenu(null)
    this.tutorialWindow.loadFile(path.join(__dirname, '..', '..', 'pages', 'obs-automation-tutorial.html'))
    this.tutorialWindow.on('closed', () => {
      this.tutorialWindow = null
    })
    return { success: true }
  }

  getRules() {
    return this.triggerManager ? this.triggerManager.exportRules() : []
  }

  getSidebarManualRules(options = {}) {
    const includeDisabled = options?.includeDisabled === true
    return this.getRules()
      .filter(rule => rule?.triggerType === TriggerType.OBS_SIDEBAR_MANUAL_TRIGGER)
      .filter(rule => includeDisabled || rule.enabled !== false)
      .map(rule => ({
        id: rule.id,
        name: rule.name || '未命名规则',
        description: rule.description || '',
        enabled: rule.enabled !== false,
        triggerType: rule.triggerType,
        actionsCount: Array.isArray(rule.actions) ? rule.actions.length : 0
      }))
  }

  getMusicControlRules(options = {}) {
    const includeDisabled = options?.includeDisabled === true
    const output = []
    const rules = this.getRules()
      .filter(rule => rule?.triggerType === TriggerType.OBS_MUSIC_CONTROL)
      .filter(rule => includeDisabled || rule.enabled !== false)

    rules.forEach((rule) => {
      const actions = Array.isArray(rule.actions) ? rule.actions : []
      const playlistAction = actions.find((action) => {
        const typeRaw = String(action?.type || '').trim()
        return typeRaw === ActionType.MUSIC_PLAYLIST || typeRaw.toLowerCase() === 'music-playlist'
      }) || null

      if (playlistAction) {
        const params = playlistAction?.params && typeof playlistAction.params === 'object' ? playlistAction.params : {}
        const sourceName = typeof params.sourceName === 'string' ? params.sourceName.trim() : ''
        const tracks = this._extractMusicTracksFromPlaylistParams(params)
        tracks.forEach((track, idx) => {
          const trackId = track.id || `track-${idx + 1}`
          output.push({
            id: `${rule.id}::${trackId}`,
            ruleId: rule.id,
            ruleName: rule.name || '未命名歌曲规则',
            trackId,
            trackIndex: idx,
            trackName: track.name || `歌曲 ${idx + 1}`,
            name: track.name || `歌曲 ${idx + 1}`,
            description: rule.description || '',
            enabled: rule.enabled !== false,
            triggerType: rule.triggerType,
            actionsCount: actions.length,
            sourceName: track.sourceName || sourceName || '',
            mediaUrl: track.url || '',
            isLocalFile: track.isLocalFile
          })
        })
        return
      }

      // 兼容旧方案：规则里仅有一个 SWITCH_MEDIA_INPUT
      const mediaAction = actions.find((action) => {
        const typeRaw = String(action?.type || '').trim()
        return typeRaw === ActionType.SWITCH_MEDIA_INPUT || typeRaw.toLowerCase() === 'switch-media-input'
      }) || null
      if (!mediaAction) return
      const params = mediaAction?.params && typeof mediaAction.params === 'object' ? mediaAction.params : {}
      const mediaUrl = typeof params.mediaUrl === 'string' && params.mediaUrl.trim()
        ? params.mediaUrl.trim()
        : (typeof params.url === 'string' ? params.url.trim() : '')
      if (!mediaUrl) return
      const sourceName = typeof params.sourceName === 'string' ? params.sourceName.trim() : ''
      const isLocalFile = typeof params.isLocalFile === 'boolean'
        ? params.isLocalFile
        : !/^https?:\/\//i.test(mediaUrl)
      output.push({
        id: `${rule.id}::single`,
        ruleId: rule.id,
        ruleName: rule.name || '未命名歌曲规则',
        trackId: 'single',
        trackIndex: 0,
        trackName: rule.name || '未命名歌曲',
        name: rule.name || '未命名歌曲规则',
        description: rule.description || '',
        enabled: rule.enabled !== false,
        triggerType: rule.triggerType,
        actionsCount: actions.length,
        sourceName,
        mediaUrl,
        isLocalFile
      })
    })

    return output
  }

  async triggerSidebarRule(ruleId, eventData = {}) {
    if (!this.triggerManager) return { success: false, error: '服务未初始化' }
    const id = typeof ruleId === 'string' ? ruleId.trim() : ''
    if (!id) return { success: false, error: '规则 ID 不能为空' }

    const rule = this.triggerManager.getRule(id)
    if (!rule) return { success: false, error: '规则不存在' }
    const sidebarTriggerTypes = new Set([
      TriggerType.OBS_SIDEBAR_MANUAL_TRIGGER,
      TriggerType.OBS_MUSIC_CONTROL
    ])
    if (!sidebarTriggerTypes.has(rule.triggerType)) {
      return { success: false, error: '该规则不是侧边栏可触发类型' }
    }

    const payload = {
      source: 'obs-sidebar-manual',
      ruleId: id,
      timestamp: Date.now(),
      ...(eventData && typeof eventData === 'object' ? eventData : {})
    }
    return this.triggerManager.triggerRuleById(id, payload)
  }

  async triggerSidebarManualRule(ruleId, eventData = {}) {
    return this.triggerSidebarRule(ruleId, eventData)
  }

  getMusicControlConfig() {
    return this._normalizeMusicControl(this.state?.config?.musicControl)
  }

  saveMusicControlConfig(config) {
    const normalized = this._normalizeMusicControl(config)
    this.state.config = this._normalizeConfig({
      ...(this.state.config || {}),
      musicControl: normalized
    })
    this._saveState()
    return normalized
  }

  async switchSong(options = {}) {
    if (!this.obs || !this.obs.identified) {
      return { success: false, error: '未连接到 OBS' }
    }

    const cfg = this.getMusicControlConfig()
    const sourceName = (typeof options.sourceName === 'string' ? options.sourceName.trim() : '') || cfg.sourceName
    if (!sourceName) {
      return { success: false, error: '请先配置音乐源名称' }
    }

    const trackId = typeof options.trackId === 'string' ? options.trackId.trim() : ''
    const directUrl = typeof options.url === 'string' ? options.url.trim() : ''
    const track = trackId ? cfg.tracks.find(item => item.id === trackId) : null
    const mediaUrl = directUrl || track?.url || ''
    if (!mediaUrl) {
      return { success: false, error: '歌曲链接为空' }
    }

    const isLocalFile = typeof options.isLocalFile === 'boolean'
      ? options.isLocalFile
      : !/^https?:\/\//i.test(mediaUrl)
    const restart = typeof options.restartOnSwitch === 'boolean'
      ? options.restartOnSwitch
      : cfg.restartOnSwitch !== false

    try {
      await this.obs.switchMediaInput(sourceName, mediaUrl, {
        isLocalFile,
        restart,
        overlay: true
      })
      return {
        success: true,
        data: {
          sourceName,
          trackId: track?.id || '',
          trackName: track?.name || '',
          url: mediaUrl
        }
      }
    } catch (e) {
      return { success: false, error: e?.message || String(e) }
    }
  }

  onLocalBpState(rawState, meta = {}) {
    if (!this.triggerManager) return
    const snapshot = this._normalizeSnapshot(rawState)
    if (!snapshot) return

    const prev = this.lastSnapshot
    if (prev && this._sameSnapshot(prev, snapshot)) {
      return
    }
    this.lastSnapshot = snapshot

    const basePayload = {
      ...snapshot,
      scoreData: this.lastScoreSnapshot || undefined,
      reason: meta.reason || 'localbp:update',
      timestamp: Date.now()
    }

    this.triggerManager.handleEvent(TriggerType.LOCALBP_STATE_UPDATED, basePayload)

    if (!prev) return

    if (this._isResetTransition(prev, snapshot)) {
      this.triggerManager.handleEvent(TriggerType.LOCALBP_RESET, basePayload)
    }

    if (prev.hunter !== snapshot.hunter && snapshot.hunter) {
      this.triggerManager.handleEvent(TriggerType.BP_HUNTER_SELECTED, {
        ...basePayload,
        character: snapshot.hunter,
        hunter: snapshot.hunter,
        isHunter: true
      })
    }

    const selectedCountNow = snapshot.survivors.filter(Boolean).length
    const addedSurvivorPicks = []

    for (let i = 0; i < 4; i++) {
      const before = prev.survivors[i]
      const after = snapshot.survivors[i]
      if (before !== after && after) {
        if (!before) {
          addedSurvivorPicks.push({ slot: i + 1, survivor: after })
        }
        this.triggerManager.handleEvent(TriggerType.BP_SURVIVOR_SELECTED, {
          ...basePayload,
          character: after,
          survivor: after,
          index: i,
          slot: i + 1,
          selectedCount: selectedCountNow,
          isHunter: false
        })
      }
    }

    const prevSelected = prev.survivors.filter(Boolean).length
    const nextSelected = snapshot.survivors.filter(Boolean).length
    const survivorProgressTriggers = [
      null,
      TriggerType.BP_SURVIVOR_1_SELECTED,
      TriggerType.BP_SURVIVOR_2_SELECTED,
      TriggerType.BP_SURVIVOR_3_SELECTED,
      TriggerType.BP_SURVIVOR_4_SELECTED
    ]

    if (nextSelected > prevSelected) {
      for (let count = Math.max(1, prevSelected + 1); count <= Math.min(nextSelected, 4); count++) {
        const pickIdx = count - (prevSelected + 1)
        const picked = addedSurvivorPicks[pickIdx]
        this.triggerManager.handleEvent(survivorProgressTriggers[count], {
          ...basePayload,
          survivors: snapshot.survivors,
          selectedCount: count,
          survivor: picked?.survivor || '',
          survivorSlot: picked?.slot || 0
        })
      }
    }

    if (prevSelected < 4 && nextSelected === 4) {
      this.triggerManager.handleEvent(TriggerType.BP_ALL_SURVIVORS_SELECTED, {
        ...basePayload,
        survivors: snapshot.survivors,
        selectedCount: 4
      })
    }

    const banChanges = this._extractBanAdded(prev, snapshot)
    banChanges.forEach((evt) => {
      this.triggerManager.handleEvent(TriggerType.BP_CHARACTER_BANNED, {
        ...basePayload,
        ...evt
      })
    })

    if (prev.mapName !== snapshot.mapName) {
      this.triggerManager.handleEvent(TriggerType.LOCALBP_MAP_CHANGED, {
        ...basePayload,
        previousMap: prev.mapName,
        mapName: snapshot.mapName
      })
    }

    if (!this._sameTeam(prev.teamA, snapshot.teamA) || !this._sameTeam(prev.teamB, snapshot.teamB)) {
      this.triggerManager.handleEvent(TriggerType.LOCALBP_TEAM_CHANGED, {
        ...basePayload,
        previousTeamA: prev.teamA,
        previousTeamB: prev.teamB,
        teamA: snapshot.teamA,
        teamB: snapshot.teamB
      })
    }
  }

  onLocalBpScoreData(rawScoreData, meta = {}) {
    if (!this.triggerManager) return
    const scoreData = this._normalizeScoreData(rawScoreData)
    if (!scoreData) return

    const signature = JSON.stringify(scoreData)
    if (this.lastScoreSignature === signature) {
      return
    }

    this.lastScoreSignature = signature
    this.lastScoreSnapshot = scoreData

    const payload = {
      scoreData,
      mapName: this.lastSnapshot?.mapName || '',
      teamA: this.lastSnapshot?.teamA || { name: '', logo: '', meta: '' },
      teamB: this.lastSnapshot?.teamB || { name: '', logo: '', meta: '' },
      reason: meta.reason || 'localbp:score-update',
      timestamp: Date.now()
    }

    this.triggerManager.handleEvent(TriggerType.LOCALBP_SCORE_UPDATED, payload)
  }

  _registerIPCHandlers() {
    this._unregisterIPCHandlers()

    ipcMain.handle('obs-automation:save-config', (event, config) => {
      this.state.config = this._normalizeConfig({
        ...(this.state.config || {}),
        ...(config || {})
      })
      this._saveState()
      return { success: true }
    })

    ipcMain.handle('obs-automation:get-config', () => {
      return this._normalizeConfig(this.state.config || {})
    })

    ipcMain.handle('obs-automation:connect', async (event, config) => {
      try {
        await this.connect(config)
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    })

    ipcMain.handle('obs-automation:disconnect', () => {
      if (this.obs) this.obs.disconnect()
      return { success: true }
    })

    ipcMain.handle('obs-automation:get-status', () => {
      return {
        connected: !!(this.obs && this.obs.identified),
        currentScene: this.obs ? this.obs.currentScene : null,
        scenes: this.obs ? this.obs.scenes : []
      }
    })

    ipcMain.handle('obs-automation:get-rules', () => {
      return this.getRules()
    })

    ipcMain.handle('obs-automation:save-rules', (event, rules) => {
      const normalized = this._sanitizeRules(Array.isArray(rules) ? rules : [])
      this.state.rules = normalized
      this._saveState()
      this._loadRulesIntoManager(normalized)
      return { success: true, count: normalized.length }
    })

    ipcMain.handle('obs-automation:test-rule', async (event, rule) => {
      if (!this.triggerManager) return { success: false, error: '服务未初始化' }
      const list = this._sanitizeRules([rule || {}])
      if (!list.length) return { success: false, error: '规则触发类型不可用' }
      const testRule = list[0]
      await this.triggerManager.handleEvent(testRule.triggerType, {
        test: true,
        timestamp: Date.now(),
        source: 'manual-test'
      })
      return { success: true }
    })

    ipcMain.handle('obs-automation:switch-scene', async (event, sceneName) => {
      if (!this.obs || !this.obs.identified) {
        return { success: false, error: '未连接到 OBS' }
      }
      try {
        await this.obs.setCurrentScene(sceneName)
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    })

    ipcMain.handle('obs-automation:get-sidebar-manual-rules', (event, options) => {
      return this.getSidebarManualRules(options || {})
    })

    ipcMain.handle('obs-automation:trigger-sidebar-manual-rule', async (event, payload) => {
      const data = payload && typeof payload === 'object' ? payload : {}
      return this.triggerSidebarManualRule(data.ruleId, data.eventData || {})
    })

    ipcMain.handle('obs-automation:get-music-config', () => {
      return { success: true, data: this.getMusicControlConfig() }
    })

    ipcMain.handle('obs-automation:save-music-config', (event, config) => {
      const data = this.saveMusicControlConfig(config || {})
      return { success: true, data }
    })

    ipcMain.handle('obs-automation:switch-song', async (event, options) => {
      return this.switchSong(options || {})
    })

    ipcMain.handle('obs-automation:open-editor', () => this.openEditorWindow())
    ipcMain.handle('obs-automation:open-tutorial', () => this.openTutorial())
  }

  _unregisterIPCHandlers() {
    for (const channel of IPC_CHANNELS) {
      try {
        ipcMain.removeHandler(channel)
      } catch {
        // ignore
      }
    }
  }

  _setupOBSEvents() {
    if (!this.obs) return

    this.obs.on('connected', () => this._broadcastStatus())
    this.obs.on('identified', () => this._broadcastStatus())
    this.obs.on('disconnected', () => this._broadcastStatus())
    this.obs.on('sceneChanged', () => this._broadcastStatus())
    this.obs.on('scenesLoaded', () => this._broadcastStatus())
  }

  _broadcastStatus() {
    if (!this.ruleEditorWindow || this.ruleEditorWindow.isDestroyed()) return
    this.ruleEditorWindow.webContents.send('obs-status', {
      connected: !!(this.obs && this.obs.identified),
      currentScene: this.obs ? this.obs.currentScene : null,
      scenes: this.obs ? this.obs.scenes : []
    })
  }

  async _executeRuntimeAction(actionType, params = {}, eventData = {}, context = {}) {
    const type = String(actionType || '').trim()
    if (!type) return { success: false, error: 'actionType 为空' }

    if (type === ActionType.CALL_CUSTOM_API) {
      return this._executeCallCustomApi(params, eventData, context)
    }
    if (type === ActionType.EMIT_CUSTOM_EVENT) {
      return this._executeEmitCustomEvent(params, eventData, context)
    }
    if (type === ActionType.SET_COMPONENT_PROPERTY) {
      return this._executeSetComponentProperty(params, eventData, context)
    }
    return { success: false, error: `不支持的运行时动作: ${type}` }
  }

  async _executeCallCustomApi(params = {}, eventData = {}, context = {}) {
    const url = typeof params.url === 'string' ? params.url.trim() : ''
    if (!url) {
      return { success: false, error: 'CALL_CUSTOM_API 缺少 url' }
    }
    if (typeof fetch !== 'function') {
      return { success: false, error: '当前运行环境不支持 fetch' }
    }

    const method = String(params.method || 'GET').trim().toUpperCase()
    const timeoutMsRaw = Number(params.timeoutMs)
    const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? Math.round(timeoutMsRaw) : 8000
    const headers = this._normalizeHeaders(params.headers ?? params.headersJson)
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeoutId = controller
      ? setTimeout(() => controller.abort(new Error('API 请求超时')), timeoutMs)
      : null

    let requestBody = params.body
    if (requestBody == null && typeof params.bodyJson === 'string' && params.bodyJson.trim()) {
      const maybe = this._safeParseJsonObject(params.bodyJson, null)
      requestBody = maybe == null ? params.bodyJson : maybe
    }
    if (requestBody == null && typeof params.bodyText === 'string') {
      requestBody = params.bodyText
    }

    const fetchOptions = {
      method,
      headers
    }
    if (controller) fetchOptions.signal = controller.signal

    if (method !== 'GET' && method !== 'HEAD' && requestBody != null) {
      if (typeof requestBody === 'object' && !(requestBody instanceof Buffer)) {
        if (!fetchOptions.headers['content-type']) {
          fetchOptions.headers['content-type'] = 'application/json'
        }
        fetchOptions.body = JSON.stringify(requestBody)
      } else {
        fetchOptions.body = String(requestBody)
      }
    }

    try {
      const response = await fetch(url, fetchOptions)
      const contentType = response.headers?.get?.('content-type') || ''
      const rawText = await response.text()
      let responseData = rawText
      if (/application\/json/i.test(contentType) && rawText) {
        try {
          responseData = JSON.parse(rawText)
        } catch {
          responseData = rawText
        }
      }

      const resultPayload = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url || url,
        method,
        data: responseData
      }

      const resultEventName = typeof params.resultEventName === 'string'
        ? params.resultEventName.trim()
        : ''
      if (resultEventName) {
        this._broadcastAutomationMessage({
          type: 'automation-custom-event',
          source: 'obs-automation',
          eventName: resultEventName,
          eventType: resultEventName,
          payload: {
            apiResult: resultPayload,
            eventData: eventData || {},
            vars: context?.variables || {}
          },
          targetPage: params.targetPage || params.page || 'all',
          targetWindowId: params.targetWindowId || params.windowId || ''
        })
      }
      return { success: response.ok, data: resultPayload, error: response.ok ? '' : `${response.status} ${response.statusText}` }
    } catch (e) {
      return { success: false, error: e?.message || String(e) }
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  _executeEmitCustomEvent(params = {}, eventData = {}, context = {}) {
    const eventName = typeof params.eventName === 'string'
      ? params.eventName.trim()
      : (typeof params.name === 'string' ? params.name.trim() : '')
    const payloadRaw = params.payload ?? params.payloadJson ?? params.data
    const payload = this._normalizePayloadObject(payloadRaw, {})

    const targetPage = params.targetPage || params.page || params.target || 'all'
    const targetWindowId = params.targetWindowId || params.windowId || ''

    this._broadcastAutomationMessage({
      type: 'automation-custom-event',
      source: 'obs-automation',
      eventName: eventName || 'automation:custom-event',
      eventType: eventName || 'automation:custom-event',
      payload: {
        ...payload,
        eventData: eventData || {},
        vars: context?.variables || {}
      },
      targetPage,
      targetWindowId
    })
    return { success: true }
  }

  _executeSetComponentProperty(params = {}, eventData = {}, context = {}) {
    const componentId = typeof params.componentId === 'string' ? params.componentId.trim() : ''
    if (!componentId) {
      return { success: false, error: 'SET_COMPONENT_PROPERTY 缺少 componentId' }
    }

    const patchFromParams = (params.patch && typeof params.patch === 'object')
      ? params.patch
      : this._normalizePayloadObject(params.patchJson, {})

    const patch = { ...patchFromParams }
    if (params.propertyPath && patch.propertyPath == null) {
      patch.propertyPath = String(params.propertyPath).trim()
      patch.value = params.value
    }
    if (params.text != null && patch.text == null) patch.text = params.text
    if (params.html != null && patch.html == null) patch.html = params.html
    if (params.visible != null && patch.visible == null) patch.visible = params.visible
    if (params.style && patch.style == null) {
      patch.style = this._normalizePayloadObject(params.style, {})
    }
    if (params.contentStyle && patch.contentStyle == null) {
      patch.contentStyle = this._normalizePayloadObject(params.contentStyle, {})
    }

    this._broadcastAutomationMessage({
      type: 'automation-component-patch',
      source: 'obs-automation',
      componentId,
      patch,
      targetPage: params.targetPage || params.page || 'all',
      targetWindowId: params.targetWindowId || params.windowId || '',
      eventData: eventData || {},
      vars: context?.variables || {}
    })
    return { success: true }
  }

  _broadcastAutomationMessage(payload = {}) {
    const targetPage = payload.targetPage || 'all'
    const targetWindowId = payload.targetWindowId || ''
    const windows = this._collectFrontendTargetWindows(targetPage, targetWindowId)
    if (!windows.length) return

    windows.forEach((win) => {
      try {
        win.webContents.send('update-data', payload)
      } catch {
        // ignore
      }
    })
  }

  _collectFrontendTargetWindows(targetPageRaw, targetWindowIdRaw) {
    const targetPage = this._normalizeTargetPage(targetPageRaw)
    const targetWindowId = typeof targetWindowIdRaw === 'string' ? targetWindowIdRaw.trim() : ''
    const all = BrowserWindow.getAllWindows().filter(win => win && !win.isDestroyed())

    return all.filter((win) => {
      const url = String(win.webContents?.getURL?.() || '')
      if (!url || !url.includes('/pages/')) return false

      let pageType = ''
      if (url.includes('/pages/frontend.html')) pageType = 'frontend'
      else if (url.includes('/pages/custom-frontend.html')) pageType = 'custom-frontend'
      else if (url.includes('/pages/character-display.html')) pageType = 'character-display'
      else return false

      if (targetPage !== 'all' && pageType !== targetPage) return false

      if (!targetWindowId) return true
      if (pageType !== 'frontend' && pageType !== 'custom-frontend') return false

      let currentWindowId = ''
      try {
        const parsed = new URL(url)
        currentWindowId = parsed.searchParams.get('windowId') || ''
      } catch {
        currentWindowId = ''
      }
      if (!currentWindowId && pageType === 'frontend') {
        currentWindowId = 'frontend-main'
      }
      return currentWindowId === targetWindowId
    })
  }

  _normalizeTargetPage(input) {
    const raw = typeof input === 'string' ? input.trim().toLowerCase() : ''
    if (!raw) return 'all'
    if (raw === 'frontend' || raw === 'custom-frontend' || raw === 'character-display' || raw === 'all') {
      return raw
    }
    if (raw === 'custom') return 'custom-frontend'
    if (raw === 'character') return 'character-display'
    return 'all'
  }

  _normalizePayloadObject(input, fallback = {}) {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      return input
    }
    if (typeof input === 'string' && input.trim()) {
      const parsed = this._safeParseJsonObject(input, null)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
      return { value: input }
    }
    return fallback
  }

  _normalizeHeaders(input) {
    const parsed = this._normalizePayloadObject(input, {})
    const out = {}
    for (const [k, v] of Object.entries(parsed || {})) {
      if (!k) continue
      out[String(k).toLowerCase()] = String(v)
    }
    return out
  }

  _safeParseJsonObject(raw, fallback = {}) {
    try {
      const parsed = JSON.parse(String(raw))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
      return fallback
    } catch {
      return fallback
    }
  }

  _normalizeTrack(track, index = 0) {
    const raw = track && typeof track === 'object' ? track : {}
    const url = typeof raw.url === 'string' ? raw.url.trim() : ''
    if (!url) return null
    const idRaw = typeof raw.id === 'string' ? raw.id.trim() : ''
    const nameRaw = typeof raw.name === 'string' ? raw.name.trim() : ''
    const id = idRaw || `track-${index + 1}-${Math.random().toString(36).slice(2, 8)}`
    const name = nameRaw || `歌曲 ${index + 1}`
    return { id, name, url }
  }

  _extractMusicTracksFromPlaylistParams(params = {}) {
    const output = []
    const push = (raw, index = 0) => {
      if (!raw || typeof raw !== 'object') return
      const url = typeof raw.url === 'string'
        ? raw.url.trim()
        : (typeof raw.mediaUrl === 'string' ? raw.mediaUrl.trim() : '')
      if (!url) return
      const id = typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `track-${index + 1}`
      const name = typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : `歌曲 ${index + 1}`
      const sourceName = typeof raw.sourceName === 'string' ? raw.sourceName.trim() : ''
      const isLocalFile = typeof raw.isLocalFile === 'boolean'
        ? raw.isLocalFile
        : !/^https?:\/\//i.test(url)
      output.push({ id, name, url, sourceName, isLocalFile })
    }

    if (Array.isArray(params.tracks)) {
      params.tracks.forEach((track, idx) => push(track, idx))
    }

    const tracksJsonRaw = typeof params.tracksJson === 'string' ? params.tracksJson.trim() : ''
    if (tracksJsonRaw) {
      try {
        const parsed = JSON.parse(tracksJsonRaw)
        if (Array.isArray(parsed)) {
          parsed.forEach((track, idx) => push(track, output.length + idx))
        }
      } catch {
        // ignore
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
        push({ name: name || `歌曲 ${idx + 1}`, url }, output.length + idx)
      })
    }

    const deduped = []
    const seen = new Set()
    for (const item of output) {
      const key = `${item.id}::${item.url}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(item)
    }
    return deduped
  }

  _normalizeMusicControl(input) {
    const raw = input && typeof input === 'object' ? input : {}
    const sourceName = typeof raw.sourceName === 'string' ? raw.sourceName.trim() : ''
    const restartOnSwitch = raw.restartOnSwitch !== false
    const tracksInput = Array.isArray(raw.tracks) ? raw.tracks : []
    const seen = new Set()
    const tracks = []
    for (let i = 0; i < tracksInput.length; i++) {
      const normalized = this._normalizeTrack(tracksInput[i], i)
      if (!normalized) continue
      if (seen.has(normalized.id)) continue
      seen.add(normalized.id)
      tracks.push(normalized)
    }
    return {
      sourceName,
      restartOnSwitch,
      tracks
    }
  }

  _normalizeConfig(input) {
    const raw = input && typeof input === 'object' ? input : {}
    const host = typeof raw.host === 'string' && raw.host.trim() ? raw.host.trim() : DEFAULT_CONFIG.host
    const portNum = Number(raw.port)
    const port = Number.isFinite(portNum) && portNum > 0 ? Math.round(portNum) : DEFAULT_CONFIG.port
    const password = typeof raw.password === 'string' ? raw.password : ''
    const autoConnect = raw.autoConnect === true
    const musicControl = this._normalizeMusicControl(raw.musicControl)
    return {
      host,
      port,
      password,
      autoConnect,
      musicControl
    }
  }

  _sanitizeRules(rules) {
    const filtered = []
    for (const rule of rules) {
      if (!rule || typeof rule !== 'object') continue
      const triggerType = String(rule.triggerType || '').trim()
      if (!ALLOWED_TRIGGER_TYPES.has(triggerType)) continue
      filtered.push(rule)
    }
    return filtered
  }

  _loadRulesIntoManager(rules) {
    if (!this.triggerManager) return
    this.triggerManager.clearRules()
    const sanitized = this._sanitizeRules(Array.isArray(rules) ? rules : [])
    sanitized.forEach((rule) => this.triggerManager.addRule(rule))
  }

  _loadState() {
    try {
      if (!fs.existsSync(this.storagePath)) {
        const legacyPath = path.join(this.app.getPath('userData'), 'plugins', '.storage', 'obs-automation', 'global-state.json')
        if (fs.existsSync(legacyPath)) {
          const legacyRaw = fs.readFileSync(legacyPath, 'utf8')
          const legacyParsed = legacyRaw ? JSON.parse(legacyRaw) : {}
          const migrated = {
            config: this._normalizeConfig(legacyParsed.config || {}),
            rules: this._sanitizeRules(Array.isArray(legacyParsed.rules) ? legacyParsed.rules : [])
          }
          this.state = migrated
          this._saveState()
          return migrated
        }
        return { config: this._normalizeConfig(DEFAULT_CONFIG), rules: [] }
      }
      const raw = fs.readFileSync(this.storagePath, 'utf8')
      const parsed = raw ? JSON.parse(raw) : {}
      return {
        config: this._normalizeConfig(parsed.config || {}),
        rules: this._sanitizeRules(Array.isArray(parsed.rules) ? parsed.rules : [])
      }
    } catch (e) {
      console.warn('[OBS 内置] 读取配置失败:', e.message)
      return { config: this._normalizeConfig(DEFAULT_CONFIG), rules: [] }
    }
  }

  _saveState() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify({
        config: this._normalizeConfig(this.state.config || {}),
        rules: this._sanitizeRules(this.state.rules)
      }, null, 2))
    } catch (e) {
      console.warn('[OBS 内置] 保存配置失败:', e.message)
    }
  }

  _normalizeSnapshot(state) {
    if (!state || typeof state !== 'object') return null
    const teamA = state.teamA && typeof state.teamA === 'object'
      ? { name: state.teamA.name || '', logo: state.teamA.logo || '', meta: state.teamA.meta || '' }
      : { name: '', logo: '', meta: '' }
    const teamB = state.teamB && typeof state.teamB === 'object'
      ? { name: state.teamB.name || '', logo: state.teamB.logo || '', meta: state.teamB.meta || '' }
      : { name: '', logo: '', meta: '' }
    return {
      hunter: state.hunter || '',
      survivors: [0, 1, 2, 3].map((idx) => (Array.isArray(state.survivors) ? (state.survivors[idx] || '') : '')),
      hunterBannedSurvivors: this._asUniqueStringArray(state.hunterBannedSurvivors),
      survivorBannedHunters: this._asUniqueStringArray(state.survivorBannedHunters),
      globalBannedSurvivors: this._asUniqueStringArray(state.globalBannedSurvivors),
      globalBannedHunters: this._asUniqueStringArray(state.globalBannedHunters),
      mapName: state.mapName || '',
      teamA,
      teamB
    }
  }

  _normalizeScoreData(input) {
    if (!input || typeof input !== 'object') return null
    const raw = input

    const toInt = (value, fallback = 0) => {
      const n = parseInt(value, 10)
      return Number.isFinite(n) ? n : fallback
    }

    const toHalf = (value) => value === 'lower' ? 'lower' : 'upper'
    const toBool = (value, fallback = false) => typeof value === 'boolean' ? value : fallback

    const bosRaw = Array.isArray(raw.bos) ? raw.bos : []
    const bos = bosRaw.map((bo) => ({
      upper: {
        teamA: toInt(bo?.upper?.teamA, 0),
        teamB: toInt(bo?.upper?.teamB, 0)
      },
      lower: {
        teamA: toInt(bo?.lower?.teamA, 0),
        teamB: toInt(bo?.lower?.teamB, 0)
      }
    }))

    const displayRaw = (raw.displayConfig && typeof raw.displayConfig === 'object') ? raw.displayConfig : {}
    return {
      bos,
      teamAWins: toInt(raw.teamAWins, 0),
      teamBWins: toInt(raw.teamBWins, 0),
      teamADraws: toInt(raw.teamADraws, 0),
      teamBDraws: toInt(raw.teamBDraws, 0),
      teamAName: typeof raw.teamAName === 'string' ? raw.teamAName : '',
      teamBName: typeof raw.teamBName === 'string' ? raw.teamBName : '',
      teamALogo: typeof raw.teamALogo === 'string' ? raw.teamALogo : '',
      teamBLogo: typeof raw.teamBLogo === 'string' ? raw.teamBLogo : '',
      currentRound: toInt(raw.currentRound, 1),
      currentHalf: toInt(raw.currentHalf, 1),
      displayConfig: {
        auto: toBool(displayRaw.auto, true),
        round: toInt(displayRaw.round, 1),
        half: toHalf(displayRaw.half)
      }
    }
  }

  _asUniqueStringArray(input) {
    if (!Array.isArray(input)) return []
    const out = []
    const seen = new Set()
    for (const item of input) {
      const v = typeof item === 'string' ? item.trim() : ''
      if (!v || seen.has(v)) continue
      seen.add(v)
      out.push(v)
    }
    return out
  }

  _extractAdded(before, after) {
    const oldSet = new Set(before || [])
    return (after || []).filter((item) => !oldSet.has(item))
  }

  _extractBanAdded(prev, next) {
    const events = []
    this._extractAdded(prev.hunterBannedSurvivors, next.hunterBannedSurvivors).forEach((character) => {
      events.push({ character, type: 'survivor', isHunter: false, scope: 'round' })
    })
    this._extractAdded(prev.survivorBannedHunters, next.survivorBannedHunters).forEach((character) => {
      events.push({ character, type: 'hunter', isHunter: true, scope: 'round' })
    })
    this._extractAdded(prev.globalBannedSurvivors, next.globalBannedSurvivors).forEach((character) => {
      events.push({ character, type: 'survivor', isHunter: false, scope: 'global' })
    })
    this._extractAdded(prev.globalBannedHunters, next.globalBannedHunters).forEach((character) => {
      events.push({ character, type: 'hunter', isHunter: true, scope: 'global' })
    })
    return events
  }

  _sameTeam(a, b) {
    return (a?.name || '') === (b?.name || '') &&
      (a?.logo || '') === (b?.logo || '') &&
      (a?.meta || '') === (b?.meta || '')
  }

  _sameArray(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  _sameSnapshot(a, b) {
    return a.hunter === b.hunter &&
      a.mapName === b.mapName &&
      this._sameTeam(a.teamA, b.teamA) &&
      this._sameTeam(a.teamB, b.teamB) &&
      this._sameArray(a.survivors, b.survivors) &&
      this._sameArray(a.hunterBannedSurvivors, b.hunterBannedSurvivors) &&
      this._sameArray(a.survivorBannedHunters, b.survivorBannedHunters) &&
      this._sameArray(a.globalBannedSurvivors, b.globalBannedSurvivors) &&
      this._sameArray(a.globalBannedHunters, b.globalBannedHunters)
  }

  _isResetTransition(prev, next) {
    const hadData = !!(prev.hunter || prev.survivors.some(Boolean) ||
      prev.hunterBannedSurvivors.length || prev.survivorBannedHunters.length)
    const emptyNow = !next.hunter && !next.survivors.some(Boolean) &&
      next.hunterBannedSurvivors.length === 0 && next.survivorBannedHunters.length === 0
    return hadData && emptyNow
  }
}

module.exports = {
  ObsAutomationService,
  TriggerType,
  ActionType
}
