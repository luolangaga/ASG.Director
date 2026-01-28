/**
 * ASG.Director 插件管理器
 * 
 * 类似 VSCode 的插件系统，提供优雅的扩展机制
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')
const { app } = require('electron')

// 项目级硬禁用插件（与用户功能需求保持一致）
// 说明：即使用户目录中存在同名插件，也不会被加载/激活。
const BLOCKED_PLUGIN_IDS = new Set([
  'blender-bridge'
])

/**
 * 插件状态枚举
 */
const PluginState = {
  NOT_LOADED: 'not_loaded',
  LOADING: 'loading',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ERROR: 'error',
  DISABLED: 'disabled'
}

/**
 * 插件管理器
 * 负责插件的发现、加载、激活、停用和卸载
 */
class PluginManager extends EventEmitter {
  constructor() {
    super()

    /** @type {Map<string, Plugin>} 已加载的插件 */
    this.plugins = new Map()

    /** @type {Map<string, PluginContext>} 插件上下文 */
    this.contexts = new Map()

    /** @type {string[]} 插件搜索路径 */
    this.pluginPaths = []

    /** @type {Object} 插件配置 */
    this.config = {}

    /** @type {PluginAPI} 插件API实例 */
    this.api = null

    /** @type {boolean} 是否已初始化 */
    this.initialized = false

    // 用户数据目录
    this.userDataPath = app.getPath('userData')
    this.pluginsDir = path.join(this.userDataPath, 'plugins')
    this.configPath = path.join(this.userDataPath, 'plugins-config.json')
  }

  /**
   * 初始化插件管理器
   * @param {PluginAPI} api - 插件API实例
   */
  async initialize(api) {
    if (this.initialized) {
      console.warn('[PluginManager] 已经初始化过了')
      return
    }

    this.api = api

    // 确保目录存在
    this._ensureDirectories()

    // 加载配置
    this._loadConfig()

    // 设置插件搜索路径（仅用户插件目录）
    this.pluginPaths = [
      this.pluginsDir  // 用户插件
    ]

    this.initialized = true
    console.log('[PluginManager] 初始化完成')
    console.log('[PluginManager] 用户插件目录:', this.pluginsDir)
  }

  /**
   * 确保必要的目录存在
   * @private
   */
  _ensureDirectories() {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true })
    }
  }

  /**
   * 加载插件配置
   * @private
   */
  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf8')
        this.config = JSON.parse(content)
      } else {
        this.config = {
          disabled: [],      // 被禁用的插件ID列表
          settings: {}       // 各插件的设置
        }
      }
    } catch (e) {
      console.error('[PluginManager] 加载配置失败:', e.message)
      this.config = { disabled: [], settings: {} }
    }
  }

  /**
   * 保存插件配置
   * @private
   */
  _saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (e) {
      console.error('[PluginManager] 保存配置失败:', e.message)
    }
  }

  /**
   * 发现所有可用插件
   * @returns {Promise<PluginManifest[]>}
   */
  async discoverPlugins() {
    const manifests = []

    for (const searchPath of this.pluginPaths) {
      if (!fs.existsSync(searchPath)) continue

      const entries = fs.readdirSync(searchPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const pluginDir = path.join(searchPath, entry.name)
        const manifestPath = path.join(pluginDir, 'package.json')

        if (!fs.existsSync(manifestPath)) continue

        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

          // 验证必要字段
          if (!manifest.name || !manifest.version || !manifest.main) {
            console.warn(`[PluginManager] 插件 ${entry.name} 缺少必要字段`)
            continue
          }

          // 添加插件路径信息
          manifest._pluginPath = pluginDir

          manifests.push(manifest)
        } catch (e) {
          console.error(`[PluginManager] 解析插件 ${entry.name} 的 package.json 失败:`, e.message)
        }
      }
    }

    return manifests
  }

  /**
   * 加载所有插件
   * @returns {Promise<void>}
   */
  async loadAllPlugins() {
    const manifests = await this.discoverPlugins()

    console.log(`[PluginManager] 发现 ${manifests.length} 个插件`)

    for (const manifest of manifests) {
      // 项目级硬禁用
      if (this._isPluginBlocked(manifest.name)) {
        console.log(`[PluginManager] 插件 ${manifest.name} 已被项目禁用，跳过加载`)
        continue
      }

      // 检查是否被禁用
      if (this.config.disabled.includes(manifest.name)) {
        console.log(`[PluginManager] 插件 ${manifest.name} 已被禁用，跳过加载`)
        continue
      }

      await this.loadPlugin(manifest)
    }

    this.emit('plugins-loaded', Array.from(this.plugins.keys()))
  }

  /**
   * 判断插件是否被项目硬禁用
   * @private
   * @param {string} pluginId
   */
  _isPluginBlocked(pluginId) {
    return BLOCKED_PLUGIN_IDS.has(String(pluginId || '').trim())
  }

  /**
   * 加载单个插件
   * @param {PluginManifest} manifest - 插件清单
   * @returns {Promise<boolean>}
   */
  async loadPlugin(manifest) {
    const pluginId = manifest.name

    if (this.plugins.has(pluginId)) {
      console.warn(`[PluginManager] 插件 ${pluginId} 已加载`)
      return false
    }

    console.log(`[PluginManager] 正在加载插件: ${pluginId}@${manifest.version}`)

    try {
      // 创建插件信息对象
      const plugin = {
        id: pluginId,
        manifest,
        state: PluginState.LOADING,
        instance: null,
        exports: null,
        activationTime: null,
        error: null
      }

      this.plugins.set(pluginId, plugin)

      // 加载插件模块
      const mainPath = path.join(manifest._pluginPath, manifest.main)

      // 清除缓存以支持热重载
      delete require.cache[require.resolve(mainPath)]

      const pluginModule = require(mainPath)
      plugin.instance = pluginModule

      // 创建插件上下文
      const context = this._createPluginContext(pluginId, manifest)
      this.contexts.set(pluginId, context)

      plugin.state = PluginState.INACTIVE

      console.log(`[PluginManager] 插件 ${pluginId} 加载成功`)
      this.emit('plugin-loaded', pluginId, manifest)

      return true
    } catch (e) {
      console.error(`[PluginManager] 加载插件 ${pluginId} 失败:`, e)

      const plugin = this.plugins.get(pluginId)
      if (plugin) {
        plugin.state = PluginState.ERROR
        plugin.error = e.message
      }

      this.emit('plugin-error', pluginId, e)
      return false
    }
  }

  /**
   * 创建插件上下文
   * @private
   * @param {string} pluginId - 插件ID
   * @param {PluginManifest} manifest - 插件清单
   * @returns {PluginContext}
   */
  _createPluginContext(pluginId, manifest) {
    const self = this

    return {
      /** 插件ID */
      pluginId,

      /** 插件清单 */
      manifest,

      /** 插件根目录 */
      extensionPath: manifest._pluginPath,

      /** 插件数据目录 */
      storagePath: path.join(self.pluginsDir, '.storage', pluginId),

      /** 订阅列表，用于自动清理 */
      subscriptions: [],

      /** 全局状态存储 */
      globalState: new PluginStorage(
        path.join(self.pluginsDir, '.storage', pluginId, 'global-state.json')
      ),

      /** 工作区状态存储 */
      workspaceState: new PluginStorage(
        path.join(self.pluginsDir, '.storage', pluginId, 'workspace-state.json')
      ),

      /** 日志函数 */
      log: (...args) => console.log(`[Plugin:${pluginId}]`, ...args),
      warn: (...args) => console.warn(`[Plugin:${pluginId}]`, ...args),
      error: (...args) => console.error(`[Plugin:${pluginId}]`, ...args),

      /** 获取插件API */
      get api() {
        return self.api
      }
    }
  }

  /**
   * 激活插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<boolean>}
   */
  async activatePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)

    if (!plugin) {
      console.error(`[PluginManager] 插件 ${pluginId} 未加载`)
      return false
    }

    if (plugin.state === PluginState.ACTIVE) {
      console.warn(`[PluginManager] 插件 ${pluginId} 已激活`)
      return true
    }

    console.log(`[PluginManager] 正在激活插件: ${pluginId}`)

    try {
      const context = this.contexts.get(pluginId)

      // 确保存储目录存在
      if (!fs.existsSync(context.storagePath)) {
        fs.mkdirSync(context.storagePath, { recursive: true })
      }

      // 调用插件的 activate 函数
      if (typeof plugin.instance.activate === 'function') {
        plugin.exports = await plugin.instance.activate(context)
      }

      plugin.state = PluginState.ACTIVE
      plugin.activationTime = Date.now()

      console.log(`[PluginManager] 插件 ${pluginId} 激活成功`)
      this.emit('plugin-activated', pluginId)

      return true
    } catch (e) {
      console.error(`[PluginManager] 激活插件 ${pluginId} 失败:`, e)
      plugin.state = PluginState.ERROR
      plugin.error = e.message
      this.emit('plugin-error', pluginId, e)
      return false
    }
  }

  /**
   * 停用插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<boolean>}
   */
  async deactivatePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)

    if (!plugin) {
      console.error(`[PluginManager] 插件 ${pluginId} 未加载`)
      return false
    }

    if (plugin.state !== PluginState.ACTIVE) {
      console.warn(`[PluginManager] 插件 ${pluginId} 未激活`)
      return true
    }

    console.log(`[PluginManager] 正在停用插件: ${pluginId}`)

    try {
      const context = this.contexts.get(pluginId)

      // 调用插件的 deactivate 函数
      if (typeof plugin.instance.deactivate === 'function') {
        await plugin.instance.deactivate()
      }

      // 清理订阅
      if (context && context.subscriptions) {
        for (const subscription of context.subscriptions) {
          if (typeof subscription.dispose === 'function') {
            subscription.dispose()
          }
        }
        context.subscriptions = []
      }

      plugin.state = PluginState.INACTIVE
      plugin.exports = null

      console.log(`[PluginManager] 插件 ${pluginId} 已停用`)
      this.emit('plugin-deactivated', pluginId)

      return true
    } catch (e) {
      console.error(`[PluginManager] 停用插件 ${pluginId} 失败:`, e)
      plugin.state = PluginState.ERROR
      plugin.error = e.message
      return false
    }
  }

  /**
   * 激活所有已加载的插件
   * @returns {Promise<void>}
   */
  async activateAllPlugins() {
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.state === PluginState.INACTIVE) {
        await this.activatePlugin(pluginId)
      }
    }

    this.emit('all-plugins-activated')
  }

  /**
   * 停用所有插件
   * @returns {Promise<void>}
   */
  async deactivateAllPlugins() {
    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.state === PluginState.ACTIVE) {
        await this.deactivatePlugin(pluginId)
      }
    }
  }

  /**
   * 启用插件
   * @param {string} pluginId - 插件ID
   */
  enablePlugin(pluginId) {
    const index = this.config.disabled.indexOf(pluginId)
    if (index !== -1) {
      this.config.disabled.splice(index, 1)
      this._saveConfig()
    }
  }

  /**
   * 禁用插件
   * @param {string} pluginId - 插件ID
   */
  disablePlugin(pluginId) {
    if (!this.config.disabled.includes(pluginId)) {
      this.config.disabled.push(pluginId)
      this._saveConfig()
    }
  }

  /**
   * 重新加载插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<boolean>}
   */
  async reloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId)

    if (!plugin) {
      console.error(`[PluginManager] 插件 ${pluginId} 未加载`)
      return false
    }

    const manifest = plugin.manifest

    // 先停用
    await this.deactivatePlugin(pluginId)

    // 从缓存中移除
    this.plugins.delete(pluginId)
    this.contexts.delete(pluginId)

    // 重新加载
    const loaded = await this.loadPlugin(manifest)
    if (loaded) {
      await this.activatePlugin(pluginId)
    }

    return loaded
  }

  /**
   * 获取插件信息
   * @param {string} pluginId - 插件ID
   * @returns {Plugin|undefined}
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId)
  }

  /**
   * 获取所有插件信息
   * @returns {Plugin[]}
   */
  getAllPlugins() {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取所有插件信息（包括禁用的）
   * 用于插件管理界面显示完整列表
   * @returns {Promise<Plugin[]>}
   */
  async getAllPluginsIncludingDisabled() {
    const result = []

    // 添加已加载的插件
    for (const plugin of this.plugins.values()) {
      result.push(plugin)
    }

    // 发现并添加被禁用的插件
    const manifests = await this.discoverPlugins()
    for (const manifest of manifests) {
      if (this.config.disabled.includes(manifest.name) && !this.plugins.has(manifest.name)) {
        result.push({
          id: manifest.name,
          manifest,
          state: PluginState.DISABLED,
          instance: null,
          exports: null,
          activationTime: null,
          error: null
        })
      }
    }

    return result
  }

  /**
   * 获取插件导出的API
   * @param {string} pluginId - 插件ID
   * @returns {any}
   */
  getPluginExports(pluginId) {
    const plugin = this.plugins.get(pluginId)
    return plugin?.exports
  }

  /**
   * 检查插件是否已激活
   * @param {string} pluginId - 插件ID
   * @returns {boolean}
   */
  isPluginActive(pluginId) {
    const plugin = this.plugins.get(pluginId)
    return plugin?.state === PluginState.ACTIVE
  }

  /**
   * 获取插件设置
   * @param {string} pluginId - 插件ID
   * @returns {Object}
   */
  getPluginSettings(pluginId) {
    return this.config.settings[pluginId] || {}
  }

  /**
   * 更新插件设置
   * @param {string} pluginId - 插件ID
   * @param {Object} settings - 设置对象
   */
  updatePluginSettings(pluginId, settings) {
    this.config.settings[pluginId] = {
      ...this.config.settings[pluginId],
      ...settings
    }
    this._saveConfig()
    this.emit('plugin-settings-changed', pluginId, settings)
  }
}

/**
 * 插件状态存储类
 * 提供简单的键值存储
 */
class PluginStorage {
  constructor(filePath) {
    this.filePath = filePath
    this.data = {}
    this._load()
  }

  _load() {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      }
    } catch (e) {
      this.data = {}
    }
  }

  _save() {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
    } catch (e) {
      console.error('[PluginStorage] 保存失败:', e.message)
    }
  }

  get(key, defaultValue) {
    return this.data.hasOwnProperty(key) ? this.data[key] : defaultValue
  }

  set(key, value) {
    this.data[key] = value
    this._save()
  }

  delete(key) {
    delete this.data[key]
    this._save()
  }

  keys() {
    return Object.keys(this.data)
  }

  clear() {
    this.data = {}
    this._save()
  }
}

// 导出单例
module.exports = {
  PluginManager,
  PluginState,
  PluginStorage,
  pluginManager: new PluginManager()
}
