const { contextBridge, ipcRenderer } = require('electron')

let pluginRendererAPI = null
let pluginRendererLoadError = null
try {
  ; ({ pluginRendererAPI } = require('./plugins/renderer'))
} catch (e) {
  // 关键：不要因为插件渲染 API 的加载失败导致整个 preload 中断
  pluginRendererAPI = null
  pluginRendererLoadError = e
  try {
    console.error('[Preload] 加载 ./plugins/renderer 失败:', e?.message || e)
  } catch {
    // ignore
  }
}

// 兜底：即使 ./plugins/renderer 加载失败，也提供最低限度的 window.plugins
// 这样插件管理页（pages/plugins.html）不会因为 window.plugins 不存在而直接不可用。
if (!pluginRendererAPI) {
  pluginRendererAPI = {
    openPluginManager: () => ipcRenderer.invoke('open-plugin-manager'),
    getAllPlugins: () => ipcRenderer.invoke('plugins:get-all'),
    getPluginDetail: (pluginId) => ipcRenderer.invoke('plugins:get-detail', pluginId),
    enablePlugin: (pluginId) => ipcRenderer.invoke('plugins:enable', pluginId),
    disablePlugin: (pluginId) => ipcRenderer.invoke('plugins:disable', pluginId),
    reloadPlugin: (pluginId) => ipcRenderer.invoke('plugins:reload', pluginId),
    getPluginSettings: (pluginId) => ipcRenderer.invoke('plugins:get-settings', pluginId),
    updatePluginSettings: (pluginId, settings) => ipcRenderer.invoke('plugins:update-settings', pluginId, settings),
    getCommands: () => ipcRenderer.invoke('plugins:get-commands'),
    executeCommand: (commandId, ...args) => ipcRenderer.invoke('plugins:execute-command', commandId, ...args),
    // 组件 API
    getPluginCards: () => ipcRenderer.invoke('plugin:get-cards'),
    getPluginPages: () => ipcRenderer.invoke('plugin:get-pages'),
    getPluginMenuItems: () => ipcRenderer.invoke('plugin:get-plugin-menu-items'),
    cardAction: (cardId, actionId, ...args) => ipcRenderer.invoke('plugin:card-action', cardId, actionId, ...args),
    onNotification: (callback) => {
      ipcRenderer.on('plugin-notification', (event, data) => callback(data))
    },
    onEvent: (callback) => {
      ipcRenderer.on('eventbus:event', (event, eventName, ...args) => callback(eventName, ...args))
    },
    emitEvent: (eventName, ...args) => {
      ipcRenderer.send('eventbus:emit', eventName, ...args)
    },
    subscribeEvent: (eventName) => ipcRenderer.invoke('eventbus:subscribe', eventName),
    getStatusBarItems: () => ipcRenderer.invoke('plugin:get-statusbar-items'),
    onStatusBarUpdate: (callback) => {
      ipcRenderer.on('plugin:statusbar-update', (event, item) => callback(item))
    },
    // 组件变化事件监听
    onComponentsChanged: (callback) => {
      ipcRenderer.on('plugin:components-changed', () => callback())
    },
    // 前台组件 API
    getFrontendWidgets: () => ipcRenderer.invoke('plugin:get-frontend-widgets'),
    updateFrontendWidget: (widgetId, data) => ipcRenderer.invoke('plugin:update-frontend-widget', widgetId, data),
    onFrontendWidgetsChanged: (callback) => {
      ipcRenderer.on('plugin:frontend-widgets-changed', () => callback())
    },
    onFrontendWidgetUpdated: (callback) => {
      ipcRenderer.on('plugin:frontend-widget-updated', (event, widgetId, widget) => callback(widgetId, widget))
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel)
    }
  }
}

function safeExpose(name, api) {
  try {
    contextBridge.exposeInMainWorld(name, api)
    return true
  } catch (e) {
    // 当 contextIsolation=false 时，contextBridge 会抛错；此时直接挂到全局即可
    try {
      globalThis[name] = api
      return true
    } catch {
      return false
    }
  }
}

// 暴露安全的API给渲染进程
const electronAPI = {
  // 房间操作
  createRoom: (roomData) => ipcRenderer.invoke('create-room', roomData),
  openBpWindows: (roomData) => ipcRenderer.invoke('open-bp-windows', roomData),
  closeBpWindows: () => ipcRenderer.invoke('close-bp-windows'),

  // 布局操作
  saveLayout: (layout) => ipcRenderer.invoke('save-layout', layout),
  loadLayout: () => ipcRenderer.invoke('load-layout'),
  exportLayout: (layout) => ipcRenderer.invoke('export-layout', layout),
  importLayout: () => ipcRenderer.invoke('import-layout'),

  // 比分板布局（持久化到 layout.json，替代 localStorage）
  getScoreboardLayout: (team) => ipcRenderer.invoke('get-scoreboard-layout', team),
  saveScoreboardLayout: (team, scoreboardLayout) => ipcRenderer.invoke('save-scoreboard-layout', team, scoreboardLayout),

  // 赛后数据布局（持久化到 layout.json）
  getPostMatchLayout: () => ipcRenderer.invoke('get-postmatch-layout'),
  savePostMatchLayout: (postMatchLayout) => ipcRenderer.invoke('save-postmatch-layout', postMatchLayout),

  // 透明背景设置
  getTransparentBackground: () => ipcRenderer.invoke('get-transparent-background'),
  setTransparentBackground: (enabled) => ipcRenderer.invoke('set-transparent-background', enabled),

  // 背景图片
  selectBackground: () => ipcRenderer.invoke('select-background'),
  selectCharacterDisplayBackground: () => ipcRenderer.invoke('select-character-display-background'),
  selectScoreboardBackground: (team) => ipcRenderer.invoke('select-scoreboard-background', team),
  selectPostMatchBackground: () => ipcRenderer.invoke('select-postmatch-background'),
  getBackgroundPath: () => ipcRenderer.invoke('get-background-path'),
  selectTeamLogo: (team) => ipcRenderer.invoke('select-team-logo', team),
  selectImageForSlot: () => ipcRenderer.invoke('select-image-for-slot'),

  // 自定义字体
  selectCustomFont: () => ipcRenderer.invoke('select-custom-font'),
  getCustomFonts: () => ipcRenderer.invoke('get-custom-fonts'),
  deleteCustomFont: (fileName) => ipcRenderer.invoke('delete-custom-font', fileName),
  saveFontConfig: (config) => ipcRenderer.invoke('save-font-config', config),
  getFontConfig: () => ipcRenderer.invoke('get-font-config'),
  getFontUrl: (fileName) => ipcRenderer.invoke('get-font-url', fileName),
  openFontSettings: () => ipcRenderer.invoke('open-font-settings'),
  onFontConfigUpdated: (callback) => ipcRenderer.on('font-config-updated', (event, config) => callback(config)),
  onCustomFontsChanged: (callback) => ipcRenderer.on('custom-fonts-changed', (event, payload) => callback(payload)),
  getScoreboardOverviewLayout: () => ipcRenderer.invoke('get-scoreboard-overview-layout'),
  saveScoreboardOverviewLayout: (layout) => ipcRenderer.invoke('save-scoreboard-overview-layout', layout),
  selectOverviewTexture: () => ipcRenderer.invoke('select-overview-texture'),

  // BP布局包
  exportBpPack: () => ipcRenderer.invoke('export-bp-pack'),
  importBpPack: () => ipcRenderer.invoke('import-bp-pack'),
  resetLayout: () => ipcRenderer.invoke('reset-layout'),

  // 本地前台（仅前台窗口）
  openLocalFrontend: () => ipcRenderer.invoke('open-local-frontend'),

  // 内置地图资源列表
  listMapAssets: () => ipcRenderer.invoke('list-map-assets'),

  // 窗口控制
  sendToFrontend: (data) => ipcRenderer.invoke('send-to-frontend', data),
  toggleFrontendFrame: (show) => ipcRenderer.invoke('toggle-frontend-frame', show),
  setFrontendAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('set-frontend-always-on-top', alwaysOnTop),
  setFrontendFullscreen: (fullscreen) => ipcRenderer.invoke('set-frontend-fullscreen', fullscreen),
  getFrontendRenderResolution: () => ipcRenderer.invoke('get-frontend-render-resolution'),
  setFrontendRenderResolution: (resolution) => ipcRenderer.invoke('set-frontend-render-resolution', resolution),
  toggleFrontendEditMode: () => ipcRenderer.invoke('toggle-frontend-edit-mode'),
  showMapDisplay: (action, map, team) => ipcRenderer.invoke('show-map-display', { action, map, team }),
  openScoreboard: (roomId, team) => ipcRenderer.invoke('open-scoreboard', roomId, team),
  openScoreboardOverview: (roomId, boCount) => ipcRenderer.invoke('open-scoreboard-overview', roomId, boCount),
  openPostMatch: (roomId) => ipcRenderer.invoke('open-postmatch', roomId),
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', width, height),

  // OCR：识别对局图片
  parseGameRecordImage: (imageBase64) => ipcRenderer.invoke('ai-parse-game-record-image', imageBase64),

  // 布局包商店
  openStore: () => ipcRenderer.invoke('open-store'),
  openPluginStore: () => ipcRenderer.invoke('open-plugin-store'),
  openComponentEditor: () => ipcRenderer.invoke('open-component-editor'),
  openAnimationEditor: () => ipcRenderer.invoke('open-animation-editor'),

  // 插件系统
  openPluginManager: () => ipcRenderer.invoke('open-plugin-manager'),
  getOfficialModelMap: () => ipcRenderer.invoke('get-official-model-map'),
  getOfficialModelsDownloadStatus: () => ipcRenderer.invoke('get-official-model-download-status'),
  prepareOfficialModels: () => ipcRenderer.invoke('prepare-official-models'),
  onOfficialModelsDownloadProgress: (callback) => ipcRenderer.on('official-models-download-progress', (event, data) => callback(data)),
  getEnvironment: () => ipcRenderer.invoke('get-environment'),
  switchEnvironment: (env) => ipcRenderer.invoke('switch-environment', env),
  localPagesGetPages: () => ipcRenderer.invoke('local-pages:get-pages'),
  localPagesGetStatus: () => ipcRenderer.invoke('local-pages:get-status'),
  localBpAutoOpenGet: () => ipcRenderer.invoke('local-bp:auto-open:get'),
  localBpAutoOpenSet: (settings) => ipcRenderer.invoke('local-bp:auto-open:set', settings),
  getFrontendResizeLock: () => ipcRenderer.invoke('frontend-resize-lock:get'),
  setFrontendResizeLock: (locked) => ipcRenderer.invoke('frontend-resize-lock:set', locked),
  storeGetPacks: (params) => ipcRenderer.invoke('store-get-packs', params),
  storeGetPackDetail: (id) => ipcRenderer.invoke('store-get-pack-detail', id),
  storeDownloadPack: (id) => ipcRenderer.invoke('store-download-pack', id),
  storeGetInstalled: () => ipcRenderer.invoke('store-get-installed'),
  storeUploadPack: (metadata) => ipcRenderer.invoke('store-upload-pack', metadata),
  storeCheckUpdates: () => ipcRenderer.invoke('store-check-updates'),
  storeGetMyPacks: () => ipcRenderer.invoke('store-get-my-packs'),
  storeDeletePack: (id) => ipcRenderer.invoke('store-delete-pack', id),
  storeRatePack: (id, rating) => ipcRenderer.invoke('store-rate-pack', id, rating),
  storeSelectPreview: () => ipcRenderer.invoke('store-select-preview'),

  // 插件商店
  pluginStoreGetPacks: (params) => ipcRenderer.invoke('plugin-store-get-packs', params),
  pluginStoreGetPackDetail: (id) => ipcRenderer.invoke('plugin-store-get-pack-detail', id),
  pluginStoreDownloadPack: (id) => ipcRenderer.invoke('plugin-store-download-pack', id),
  pluginStoreGetInstalled: () => ipcRenderer.invoke('plugin-store-get-installed'),
  pluginStoreGetMyPacks: () => ipcRenderer.invoke('plugin-store-get-my-packs'),
  pluginStoreDeletePack: (id) => ipcRenderer.invoke('plugin-store-delete-pack', id),
  pluginStoreSetVisibility: (id, isPublic) => ipcRenderer.invoke('plugin-store-set-visibility', id, isPublic),
  pluginStoreExportPlugin: (pluginId) => ipcRenderer.invoke('plugin-store-export-plugin', pluginId),
  pluginStoreUninstall: (pluginId) => ipcRenderer.invoke('plugin-store-uninstall', pluginId),
  pluginStoreSelectFile: () => ipcRenderer.invoke('plugin-store-select-file'),
  pluginStoreUploadPack: (metadata) => ipcRenderer.invoke('plugin-store-upload-pack', metadata),

  // 应用控制
  restartApp: () => ipcRenderer.invoke('app-restart'),

  // 应用更新
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  manualCheckUpdate: () => ipcRenderer.invoke('manual-check-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // ASG账号登录与竞猜功能
  login: (email, password) => ipcRenderer.invoke('asg-login', email, password),
  logout: () => ipcRenderer.invoke('asg-logout'),
  getAuthStatus: () => ipcRenderer.invoke('asg-get-auth-status'),
  getMyEvents: () => ipcRenderer.invoke('asg-get-my-events'),
  getEventMatches: (eventId) => ipcRenderer.invoke('asg-get-event-matches', eventId),
  getMatchPredictions: (matchId) => ipcRenderer.invoke('asg-get-match-predictions', matchId),
  createBilibiliPrediction: (dto) => ipcRenderer.invoke('asg-create-bilibili-prediction', dto),
  openPredictionWindow: (matchId) => ipcRenderer.invoke('open-prediction-window', matchId),

  // B站弹幕
  startBilibiliDanmaku: (roomId, matchId) => ipcRenderer.invoke('start-bilibili-danmaku', roomId, matchId),
  stopBilibiliDanmaku: () => ipcRenderer.invoke('stop-bilibili-danmaku'),
  onBilibiliDanmaku: (callback) => ipcRenderer.on('bilibili-danmaku', (event, data) => callback(data)),
  onBilibiliPrediction: (callback) => ipcRenderer.on('bilibili-prediction', (event, data) => callback(data)),
  onLoadMatch: (callback) => ipcRenderer.on('load-match', (event, matchId) => callback(matchId)),

  // 本地BP系统
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),

  // 本地BP状态更新监听
  onLocalBpStateUpdate: (callback) => {
    ipcRenderer.on('update-data', (event, data) => {
      if (data && data.type === 'state') {
        callback(data.state)
      }
    })
  },

  // 3D模型设置
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFileWithFilter: (options) => ipcRenderer.invoke('select-file', options),
  saveModelConfig: (config) => ipcRenderer.invoke('save-model-config', config),
  getModelConfig: () => ipcRenderer.invoke('get-model-config'),
  scanModels: (dir) => ipcRenderer.invoke('scan-models', dir),
  onModelConfigUpdated: (callback) => ipcRenderer.on('model-config-updated', (event, config) => callback(config)),

  // 角色管理
  openCharacterManager: () => ipcRenderer.invoke('open-character-manager'),
  characterGetAll: () => ipcRenderer.invoke('character:get-all'),
  characterGetIndex: () => ipcRenderer.invoke('character:get-index'),
  characterAdd: (data) => ipcRenderer.invoke('character:add', data),
  characterUpdate: (data) => ipcRenderer.invoke('character:update', data),
  characterDelete: (data) => ipcRenderer.invoke('character:delete', data),
  characterSelectImage: (imageType) => ipcRenderer.invoke('character:select-image', imageType),
  characterGetImageBase64: (imagePath) => ipcRenderer.invoke('character:get-image-base64', imagePath),
  characterRefresh: () => ipcRenderer.invoke('character:refresh'),

  // 插件命令（给插件自带窗口/页面使用）
  executeCommand: (commandId, ...args) => ipcRenderer.invoke('plugin:execute-command', commandId, ...args),

  // 事件监听
  onRoomData: (callback) => ipcRenderer.on('room-data', (event, data) => callback(data)),
  onUpdateData: (callback) => ipcRenderer.on('update-data', (event, data) => callback(data)),
  onToggleEditMode: (callback) => ipcRenderer.on('toggle-edit-mode', (event) => callback()),
  onReloadLayoutFromPack: (callback) => ipcRenderer.on('reload-layout-from-pack', (event) => callback()),

  // 移除监听
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}

safeExpose('electronAPI', electronAPI)

// 插件系统（渲染进程）API
safeExpose('plugins', pluginRendererAPI)

// ============================
// 全局错误拦截（渲染进程 -> 主进程 -> 终端）
// ============================
try {
  if (!globalThis.__asgRendererErrorBridgeInstalled) {
    globalThis.__asgRendererErrorBridgeInstalled = true

    const safeToString = (v) => {
      try {
        if (v instanceof Error) return v.stack || v.message || String(v)
        if (typeof v === 'string') return v
        return JSON.stringify(v)
      } catch {
        try { return String(v) } catch { return '[unserializable]' }
      }
    }

    const sendRendererLog = (payload) => {
      try {
        ipcRenderer.send('renderer:log', {
          ts: Date.now(),
          url: typeof location !== 'undefined' ? location.href : null,
          ...payload
        })
      } catch {
        // ignore
      }
    }

    globalThis.addEventListener('error', (event) => {
      sendRendererLog({
        level: 'error',
        source: 'window.error',
        message: event?.message || 'Unhandled error',
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
        stack: event?.error?.stack || event?.error?.message
      })
    })

    globalThis.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason
      sendRendererLog({
        level: 'error',
        source: 'unhandledrejection',
        message: safeToString(reason),
        stack: reason?.stack
      })
    })

    // 额外：把 console.error 也转发到主进程（便于捕捉 loader/three 报错）
    const origConsoleError = console.error.bind(console)
    console.error = (...args) => {
      try {
        sendRendererLog({
          level: 'error',
          source: 'console.error',
          message: args.map(safeToString).join(' ')
        })
      } catch {
        // ignore
      }
      origConsoleError(...args)
    }
  }
} catch {
  // ignore
}

// 给主进程一个“preload 已加载”的信号，便于定位是否注入成功
try {
  ipcRenderer.send('preload:loaded', {
    url: typeof location !== 'undefined' ? location.href : null,
    hasElectronAPI: true,
    hasPlugins: Boolean(pluginRendererAPI),
    pluginsSource: pluginRendererLoadError ? 'fallback' : 'required',
    pluginsLoadError: pluginRendererLoadError ? (pluginRendererLoadError?.message || String(pluginRendererLoadError)) : null
  })
} catch {
  // ignore
}
