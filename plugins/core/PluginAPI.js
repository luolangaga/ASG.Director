/**
 * ASG.Director 插件 API
 * 
 * 提供给插件使用的核心API接口
 * 类似于 VSCode 的 vscode 模块
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events')
const { BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

/**
 * 命令注册表
 */
class CommandRegistry {
  constructor() {
    /** @type {Map<string, Function>} */
    this.commands = new Map()
  }

  /**
   * 注册命令
   * @param {string} commandId - 命令ID
   * @param {Function} handler - 命令处理函数
   * @returns {Disposable}
   */
  registerCommand(commandId, handler) {
    if (this.commands.has(commandId)) {
      console.warn(`[CommandRegistry] 命令 ${commandId} 已存在，将被覆盖`)
    }

    this.commands.set(commandId, handler)
    console.log(`[CommandRegistry] 注册命令: ${commandId}`)

    return {
      dispose: () => {
        this.commands.delete(commandId)
        console.log(`[CommandRegistry] 注销命令: ${commandId}`)
      }
    }
  }

  /**
   * 执行命令
   * @param {string} commandId - 命令ID
   * @param {...any} args - 命令参数
   * @returns {Promise<any>}
   */
  async executeCommand(commandId, ...args) {
    const handler = this.commands.get(commandId)

    if (!handler) {
      throw new Error(`命令 ${commandId} 不存在`)
    }

    return await handler(...args)
  }

  /**
   * 获取所有已注册的命令
   * @returns {string[]}
   */
  getCommands() {
    return Array.from(this.commands.keys())
  }

  /**
   * 检查命令是否存在
   * @param {string} commandId - 命令ID
   * @returns {boolean}
   */
  hasCommand(commandId) {
    return this.commands.has(commandId)
  }
}

/**
 * 菜单项
 */
class MenuItem {
  constructor(options) {
    this.id = options.id
    this.label = options.label
    this.icon = options.icon
    this.command = options.command
    this.args = options.args || []
    this.group = options.group || 'default'
    this.order = options.order || 0
    this.when = options.when || null
  }
}

/**
 * 菜单注册表
 */
class MenuRegistry {
  constructor() {
    /** @type {Map<string, MenuItem[]>} */
    this.menus = new Map()
  }

  /**
   * 注册菜单项
   * @param {string} menuId - 菜单位置ID
   * @param {MenuItem|Object} item - 菜单项
   * @returns {Disposable}
   */
  registerMenuItem(menuId, item) {
    if (!this.menus.has(menuId)) {
      this.menus.set(menuId, [])
    }

    const menuItem = item instanceof MenuItem ? item : new MenuItem(item)
    this.menus.get(menuId).push(menuItem)

    // 按 order 排序
    this.menus.get(menuId).sort((a, b) => a.order - b.order)

    return {
      dispose: () => {
        const items = this.menus.get(menuId)
        if (items) {
          const index = items.indexOf(menuItem)
          if (index !== -1) {
            items.splice(index, 1)
          }
        }
      }
    }
  }

  /**
   * 获取菜单项
   * @param {string} menuId - 菜单位置ID
   * @returns {MenuItem[]}
   */
  getMenuItems(menuId) {
    return this.menus.get(menuId) || []
  }
}

/**
 * 视图容器
 */
class ViewContainer {
  constructor(options) {
    this.id = options.id
    this.title = options.title
    this.icon = options.icon
    this.order = options.order || 0
  }
}

/**
 * 视图
 */
class View {
  constructor(options) {
    this.id = options.id
    this.name = options.name
    this.containerId = options.containerId
    this.type = options.type || 'webview'
    this.html = options.html || ''
    this.when = options.when || null
  }
}

/**
 * 视图注册表
 */
class ViewRegistry {
  constructor() {
    /** @type {Map<string, ViewContainer>} */
    this.containers = new Map()

    /** @type {Map<string, View>} */
    this.views = new Map()
  }

  /**
   * 注册视图容器
   * @param {Object} options - 容器配置
   * @returns {Disposable}
   */
  registerViewContainer(options) {
    const container = new ViewContainer(options)
    this.containers.set(container.id, container)

    return {
      dispose: () => {
        this.containers.delete(container.id)
      }
    }
  }

  /**
   * 注册视图
   * @param {Object} options - 视图配置
   * @returns {Disposable}
   */
  registerView(options) {
    const view = new View(options)
    this.views.set(view.id, view)

    return {
      dispose: () => {
        this.views.delete(view.id)
      }
    }
  }

  /**
   * 获取容器下的所有视图
   * @param {string} containerId - 容器ID
   * @returns {View[]}
   */
  getViewsForContainer(containerId) {
    return Array.from(this.views.values())
      .filter(v => v.containerId === containerId)
  }
}

/**
 * 插件卡片组件
 */
class PluginCard {
  constructor(options) {
    this.id = options.id
    this.pluginId = options.pluginId
    this.title = options.title
    this.description = options.description || ''
    this.icon = options.icon || '🧩'
    this.iconColor = options.iconColor || 'blue'
    this.order = options.order || 100
    this.html = options.html || ''
    this.onRender = options.onRender || null
    this.onAction = options.onAction || null
    this.actions = options.actions || []
  }
}

/**
 * 插件页面
 */
class PluginPage {
  constructor(options) {
    this.id = options.id
    this.pluginId = options.pluginId
    this.title = options.title
    this.icon = options.icon || '📄'
    this.order = options.order || 100
    this.html = options.html || ''
    this.file = options.file || null
    this.onLoad = options.onLoad || null
  }
}

/**
 * 前台组件 - 在直播画面中显示的可拖拽/可编辑组件
 */
class FrontendWidget {
  constructor(options) {
    this.id = options.id
    this.pluginId = options.pluginId
    this.type = options.type || 'custom' // 组件类型：custom, text, image, html
    this.label = options.label || '自定义组件' // 编辑模式下显示的标签
    this.icon = options.icon || '🧩'
    this.order = options.order || 100

    // 默认位置和大小
    this.defaultPosition = options.defaultPosition || { x: 100, y: 100 }
    this.defaultSize = options.defaultSize || { width: 200, height: 100 }

    // HTML模板 - 支持动态内容
    this.html = options.html || ''

    // 样式
    this.style = options.style || {}

    // 是否可调整大小
    this.resizable = options.resizable !== false

    // 是否可拖拽
    this.draggable = options.draggable !== false

    // 回调函数
    this.onRender = options.onRender || null // 渲染时回调
    this.onUpdate = options.onUpdate || null // 数据更新时回调
    this.onStateChange = options.onStateChange || null // 房间状态变化时回调

    // 当前数据
    this.data = options.data || {}
  }
}

/**
 * 组件注册表 - 管理插件注册的卡片和页面
 */
class ComponentRegistry {
  constructor() {
    /** @type {Map<string, PluginCard>} */
    this.cards = new Map()

    /** @type {Map<string, PluginPage>} */
    this.pages = new Map()

    /** @type {Map<string, Object>} */
    this.menuItems = new Map()

    /** @type {Map<string, FrontendWidget>} */
    this.frontendWidgets = new Map()
  }

  /**
   * 注册卡片组件
   * @param {Object} options - 卡片配置
   * @returns {Disposable}
   */
  registerCard(options) {
    const card = new PluginCard(options)
    this.cards.set(card.id, card)
    console.log(`[ComponentRegistry] 注册卡片: ${card.id}`)

    // 通知所有窗口刷新插件组件（主页菜单/卡片/页面）
    try {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.webContents.send('plugin:components-changed')
      })
    } catch {
      // ignore
    }

    return {
      dispose: () => {
        this.cards.delete(card.id)
        console.log(`[ComponentRegistry] 注销卡片: ${card.id}`)

        try {
          const { BrowserWindow } = require('electron')
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) win.webContents.send('plugin:components-changed')
          })
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * 注册页面
   * @param {Object} options - 页面配置
   * @returns {Disposable}
   */
  registerPage(options) {
    const page = new PluginPage(options)
    this.pages.set(page.id, page)
    console.log(`[ComponentRegistry] 注册页面: ${page.id}`)

    // 通知所有窗口刷新插件组件（主页菜单/卡片/页面）
    try {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.webContents.send('plugin:components-changed')
      })
    } catch {
      // ignore
    }

    return {
      dispose: () => {
        this.pages.delete(page.id)
        console.log(`[ComponentRegistry] 注销页面: ${page.id}`)

        try {
          const { BrowserWindow } = require('electron')
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) win.webContents.send('plugin:components-changed')
          })
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * 注册菜单项
   * @param {Object} options - 菜单项配置
   * @returns {Disposable}
   */
  registerMenuItem(options) {
    const item = {
      id: options.id,
      pluginId: options.pluginId,
      label: options.label,
      icon: options.icon || '📄',
      order: options.order || 100,
      pageId: options.pageId || null,
      command: options.command || null,
      group: options.group || 'plugins'
    }
    this.menuItems.set(item.id, item)
    console.log(`[ComponentRegistry] 注册菜单项: ${item.id}`)

    // 通知所有窗口刷新插件组件（主页菜单/卡片/页面）
    try {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) win.webContents.send('plugin:components-changed')
      })
    } catch {
      // ignore
    }

    return {
      dispose: () => {
        this.menuItems.delete(item.id)
        console.log(`[ComponentRegistry] 注销菜单项: ${item.id}`)

        try {
          const { BrowserWindow } = require('electron')
          BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) win.webContents.send('plugin:components-changed')
          })
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * 获取所有卡片
   * @returns {PluginCard[]}
   */
  getAllCards() {
    return Array.from(this.cards.values()).sort((a, b) => a.order - b.order)
  }

  /**
   * 获取所有页面
   * @returns {PluginPage[]}
   */
  getAllPages() {
    return Array.from(this.pages.values()).sort((a, b) => a.order - b.order)
  }

  /**
   * 获取所有菜单项
   * @returns {Object[]}
   */
  getAllMenuItems() {
    return Array.from(this.menuItems.values()).sort((a, b) => a.order - b.order)
  }

  /**
   * 获取指定卡片
   * @param {string} cardId
   * @returns {PluginCard|undefined}
   */
  getCard(cardId) {
    return this.cards.get(cardId)
  }

  /**
   * 获取指定页面
   * @param {string} pageId
   * @returns {PluginPage|undefined}
   */
  getPage(pageId) {
    return this.pages.get(pageId)
  }

  /**
   * 清理指定插件注册的所有组件
   * @param {string} pluginId
   */
  unregisterPluginComponents(pluginId) {
    // 清理卡片
    for (const [id, card] of this.cards) {
      if (card.pluginId === pluginId) {
        this.cards.delete(id)
        console.log(`[ComponentRegistry] 清理卡片: ${id}`)
      }
    }

    // 清理页面
    for (const [id, page] of this.pages) {
      if (page.pluginId === pluginId) {
        this.pages.delete(id)
        console.log(`[ComponentRegistry] 清理页面: ${id}`)
      }
    }

    // 清理菜单项
    for (const [id, item] of this.menuItems) {
      if (item.pluginId === pluginId) {
        this.menuItems.delete(id)
        console.log(`[ComponentRegistry] 清理菜单项: ${id}`)
      }
    }

    // 清理前台组件
    for (const [id, widget] of this.frontendWidgets) {
      if (widget.pluginId === pluginId) {
        this.frontendWidgets.delete(id)
        console.log(`[ComponentRegistry] 清理前台组件: ${id}`)
      }
    }
  }

  /**
   * 注册前台组件（在直播画面中显示的可拖拽组件）
   * @param {Object} options - 组件配置
   * @returns {Disposable}
   */
  registerFrontendWidget(options) {
    const widget = new FrontendWidget(options)
    this.frontendWidgets.set(widget.id, widget)
    console.log(`[ComponentRegistry] 注册前台组件: ${widget.id}`)

    // 通知前台更新
    const { BrowserWindow } = require('electron')
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('plugin:frontend-widgets-changed')
    })

    return {
      dispose: () => {
        this.frontendWidgets.delete(widget.id)
        console.log(`[ComponentRegistry] 注销前台组件: ${widget.id}`)
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('plugin:frontend-widgets-changed')
        })
      },
      update: (updates) => {
        Object.assign(widget, updates)
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('plugin:frontend-widget-updated', widget.id, widget)
        })
      }
    }
  }

  /**
   * 获取所有前台组件
   * @returns {FrontendWidget[]}
   */
  getAllFrontendWidgets() {
    return Array.from(this.frontendWidgets.values()).sort((a, b) => a.order - b.order)
  }

  /**
   * 获取指定前台组件
   * @param {string} widgetId
   * @returns {FrontendWidget|undefined}
   */
  getFrontendWidget(widgetId) {
    return this.frontendWidgets.get(widgetId)
  }
}

/**
 * 状态栏项
 */
class StatusBarItem {
  constructor(api, id, alignment, priority) {
    this._api = api
    this.id = id
    this.alignment = alignment // 'left' | 'right'
    this.priority = priority
    this.text = ''
    this.tooltip = ''
    this.command = null
    this.color = null
    this.backgroundColor = null
    this._visible = false
  }

  show() {
    this._visible = true
    this._api._notifyStatusBarUpdate(this)
  }

  hide() {
    this._visible = false
    this._api._notifyStatusBarUpdate(this)
  }

  dispose() {
    this._api._removeStatusBarItem(this.id)
  }
}

/**
 * 通知消息类型
 */
const MessageType = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
}

/**
 * 插件 API 主类
 * 提供给插件使用的所有功能接口
 */
class PluginAPI extends EventEmitter {
  constructor() {
    super()

    /** 命令注册表 */
    this.commands = new CommandRegistry()

    /** 菜单注册表 */
    this.menus = new MenuRegistry()

    /** 视图注册表 */
    this.views = new ViewRegistry()

    /** 组件注册表 */
    this.components = new ComponentRegistry()

    /** @type {Map<string, StatusBarItem>} 状态栏项 */
    this._statusBarItems = new Map()

    /** @type {Map<string, BrowserWindow>} 窗口引用 */
    this._windows = new Map()

    /** @type {Object} 应用引用 */
    this._app = null

    /** @type {Object} 主窗口引用 */
    this._mainWindow = null

    /** @type {Object} 房间数据 */
    this._roomData = null

    /** 状态栏项计数器 */
    this._statusBarItemCounter = 0

    // 设置IPC处理器
    this._setupIPCHandlers()
  }

  /**
   * 初始化API
   * @param {Object} options - 初始化选项
   */
  initialize(options = {}) {
    this._app = options.app
    this._mainWindow = options.mainWindow

    // 🔥 修复：连接到 EventBus，转发所有事件给插件
    this._connectToEventBus()

    // 注册内置命令
    this._registerBuiltinCommands()
  }

  /**
   * 连接到 EventBus，转发事件给插件
   * @private
   */
  _connectToEventBus() {
    try {
      const { eventBus } = require('./EventBus')

      // 监听所有 BP 事件
      const bpEvents = ['bp:started', 'bp:ended', 'bp:character-banned', 'bp:character-picked', 'bp:round-changed']
      bpEvents.forEach(event => {
        eventBus.on(event, (...args) => {
          // 转发给插件
          this.emit(event, ...args)
        })
      })

      // 监听所有比赛事件
      const matchEvents = ['match:started', 'match:ended', 'match:score-updated', 'match:map-changed']
      matchEvents.forEach(event => {
        eventBus.on(event, (...args) => {
          this.emit(event, ...args)
        })
      })

      // 监听所有房间事件
      const roomEvents = ['room:created', 'room:updated', 'room:closed', 'room:connected', 'room:disconnected']
      roomEvents.forEach(event => {
        eventBus.on(event, (...args) => {
          this.emit(event, ...args)
        })
      })

      console.log('[PluginAPI] 已连接到 EventBus，事件将转发给插件')
    } catch (e) {
      console.error('[PluginAPI] 连接到 EventBus 失败:', e)
    }
  }

  /**
   * 设置窗口引用
   * @param {string} name - 窗口名称
   * @param {BrowserWindow} window - 窗口实例
   */
  setWindow(name, window) {
    if (window) {
      this._windows.set(name, window)
    } else {
      this._windows.delete(name)
    }
  }

  /**
   * 获取窗口引用
   * @param {string} name - 窗口名称
   * @returns {BrowserWindow|undefined}
   */
  getWindow(name) {
    return this._windows.get(name)
  }

  /**
   * 设置房间数据
   * @param {Object} data - 房间数据
   */
  setRoomData(data) {
    this._roomData = data
    this.emit('room-data-changed', data)
  }

  /**
   * 获取房间数据
   * @returns {Object}
   */
  getRoomData() {
    return this._roomData
  }

  // ==================== 窗口 API ====================

  /**
   * 窗口相关API
   */
  window = {
    /**
     * 创建新窗口
     * @param {Object} options - 窗口配置
     * @returns {BrowserWindow}
     */
    createWindow: (options) => {
      const win = new BrowserWindow({
        width: options.width || 800,
        height: options.height || 600,
        title: options.title || 'ASG Director',
        frame: options.frame !== false,
        transparent: options.transparent || false,
        resizable: options.resizable !== false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: options.preload || path.join(__dirname, '..', '..', 'preload.js'),
          ...options.webPreferences
        },
        ...options
      })

      if (options.html) {
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`)
      } else if (options.url) {
        win.loadURL(options.url)
      } else if (options.file) {
        win.loadFile(options.file)
      }

      return win
    },

    /**
     * 显示消息框
     * @param {Object} options - 消息框配置
     * @returns {Promise<number>}
     */
    showMessageBox: async (options) => {
      const result = await dialog.showMessageBox(this._mainWindow, {
        type: options.type || 'info',
        title: options.title || 'ASG Director',
        message: options.message,
        detail: options.detail,
        buttons: options.buttons || ['确定'],
        defaultId: options.defaultId || 0,
        cancelId: options.cancelId
      })
      return result.response
    },

    /**
     * 显示打开文件对话框
     * @param {Object} options - 对话框配置
     * @returns {Promise<string[]|undefined>}
     */
    showOpenDialog: async (options) => {
      const result = await dialog.showOpenDialog(this._mainWindow, options)
      return result.canceled ? undefined : result.filePaths
    },

    /**
     * 显示保存文件对话框
     * @param {Object} options - 对话框配置
     * @returns {Promise<string|undefined>}
     */
    showSaveDialog: async (options) => {
      const result = await dialog.showSaveDialog(this._mainWindow, options)
      return result.canceled ? undefined : result.filePath
    },

    /**
     * 获取主窗口
     * @returns {BrowserWindow}
     */
    getMainWindow: () => this._mainWindow,

    /**
     * 获取所有窗口
     * @returns {BrowserWindow[]}
     */
    getAllWindows: () => BrowserWindow.getAllWindows()
  }

  // ==================== 消息通知 API ====================

  /**
   * 消息通知API
   */
  notifications = {
    /**
     * 显示信息通知
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    showInfo: (message, options = {}) => {
      this._sendNotification(MessageType.INFO, message, options)
    },

    /**
     * 显示警告通知
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    showWarning: (message, options = {}) => {
      this._sendNotification(MessageType.WARNING, message, options)
    },

    /**
     * 显示错误通知
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    showError: (message, options = {}) => {
      this._sendNotification(MessageType.ERROR, message, options)
    }
  }

  /**
   * 发送通知到渲染进程
   * @private
   */
  _sendNotification(type, message, options) {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('plugin-notification', {
          type,
          message,
          title: options.title,
          duration: options.duration || 3000
        })
      }
    }
  }

  // ==================== 状态栏 API ====================

  /**
   * 状态栏API
   */
  statusBar = {
    /**
     * 创建状态栏项
     * @param {string} alignment - 对齐方式 'left' | 'right'
     * @param {number} priority - 优先级
     * @returns {StatusBarItem}
     */
    createStatusBarItem: (alignment = 'left', priority = 0) => {
      const id = `statusbar-${++this._statusBarItemCounter}`
      const item = new StatusBarItem(this, id, alignment, priority)
      this._statusBarItems.set(id, item)
      return item
    }
  }

  /**
   * 通知状态栏更新
   * @private
   */
  _notifyStatusBarUpdate(item) {
    const payload = {
      id: item.id,
      text: item.text,
      tooltip: item.tooltip,
      command: item.command,
      color: item.color,
      backgroundColor: item.backgroundColor,
      alignment: item.alignment,
      priority: item.priority,
      visible: item._visible
    }

    this.emit('statusbar-update', payload)

    // 同步通知所有渲染进程（便于 UI 侧渲染状态栏）
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('plugin:statusbar-update', payload)
      }
    }
  }

  /**
   * 移除状态栏项
   * @private
   */
  _removeStatusBarItem(id) {
    this._statusBarItems.delete(id)
    this.emit('statusbar-remove', id)

    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('plugin:statusbar-remove', id)
      }
    }
  }

  // ==================== 工具 API ====================

  /**
   * 工具API
   */
  utils = {
    /**
     * 在系统默认浏览器中打开URL
     * @param {string} url - URL地址
     */
    openExternal: (url) => shell.openExternal(url),

    /**
     * 在文件管理器中显示文件
     * @param {string} filePath - 文件路径
     */
    showItemInFolder: (filePath) => shell.showItemInFolder(filePath),

    /**
     * 读取剪贴板文本
     * @returns {string}
     */
    readClipboardText: () => clipboard.readText(),

    /**
     * 写入剪贴板文本
     * @param {string} text - 文本内容
     */
    writeClipboardText: (text) => clipboard.writeText(text),

    /**
     * 读取剪贴板图片
     * @returns {NativeImage}
     */
    readClipboardImage: () => clipboard.readImage(),

    /**
     * 延迟执行
     * @param {number} ms - 毫秒数
     * @returns {Promise<void>}
     */
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * 生成UUID
     * @returns {string}
     */
    generateUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }
  }

  // ==================== 文件系统 API ====================

  /**
   * 文件系统API（安全封装）
   */
  fs = {
    /**
     * 读取文件
     * @param {string} filePath - 文件路径
     * @param {string} encoding - 编码
     * @returns {Promise<string|Buffer>}
     */
    readFile: (filePath, encoding = 'utf8') => {
      return new Promise((resolve, reject) => {
        fs.readFile(filePath, encoding, (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })
    },

    /**
     * 写入文件
     * @param {string} filePath - 文件路径
     * @param {string|Buffer} data - 数据
     * @returns {Promise<void>}
     */
    writeFile: (filePath, data) => {
      return new Promise((resolve, reject) => {
        fs.writeFile(filePath, data, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    },

    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {boolean}
     */
    exists: (filePath) => fs.existsSync(filePath),

    /**
     * 创建目录
     * @param {string} dirPath - 目录路径
     * @returns {Promise<void>}
     */
    mkdir: (dirPath) => {
      return new Promise((resolve, reject) => {
        fs.mkdir(dirPath, { recursive: true }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    },

    /**
     * 读取目录
     * @param {string} dirPath - 目录路径
     * @returns {Promise<string[]>}
     */
    readdir: (dirPath) => {
      return new Promise((resolve, reject) => {
        fs.readdir(dirPath, (err, files) => {
          if (err) reject(err)
          else resolve(files)
        })
      })
    }
  }

  // ==================== 事件 API ====================

  /**
   * 事件API
   */
  events = {
    /**
     * 监听事件
     * @param {string} event - 事件名
     * @param {Function} listener - 监听器
     * @returns {Disposable}
     */
    on: (event, listener) => {
      this.on(event, listener)
      return {
        dispose: () => this.off(event, listener)
      }
    },

    /**
     * 监听一次性事件
     * @param {string} event - 事件名
     * @param {Function} listener - 监听器
     */
    once: (event, listener) => {
      this.once(event, listener)
    },

    /**
     * 触发事件
     * @param {string} event - 事件名
     * @param {...any} args - 参数
     */
    emit: (event, ...args) => {
      this.emit(event, ...args)
    }
  }

  // ==================== IPC API ====================

  /**
   * IPC通信API
   */
  ipc = {
    /**
     * 注册IPC处理器
     * @param {string} channel - 频道名
     * @param {Function} handler - 处理函数
     * @returns {Disposable}
     */
    handle: (channel, handler) => {
      const wrappedChannel = `plugin:${channel}`
      ipcMain.handle(wrappedChannel, handler)
      return {
        dispose: () => ipcMain.removeHandler(wrappedChannel)
      }
    },

    /**
     * 向窗口发送消息
     * @param {BrowserWindow} window - 窗口实例
     * @param {string} channel - 频道名
     * @param {...any} args - 参数
     */
    send: (window, channel, ...args) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send(`plugin:${channel}`, ...args)
      }
    },

    /**
     * 向所有窗口广播消息
     * @param {string} channel - 频道名
     * @param {...any} args - 参数
     */
    broadcast: (channel, ...args) => {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(`plugin:${channel}`, ...args)
        }
      }
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 设置IPC处理器
   * @private
   */
  _setupIPCHandlers() {
    // 执行命令
    ipcMain.handle('plugin:execute-command', async (event, commandId, ...args) => {
      return await this.commands.executeCommand(commandId, ...args)
    })

    // 获取命令列表
    ipcMain.handle('plugin:get-commands', () => {
      return this.commands.getCommands()
    })

    // 获取菜单项
    ipcMain.handle('plugin:get-menu-items', (event, menuId) => {
      return this.menus.getMenuItems(menuId)
    })

    // 获取状态栏项
    ipcMain.handle('plugin:get-statusbar-items', () => {
      const items = []
      for (const [id, item] of this._statusBarItems) {
        if (item._visible) {
          items.push({
            id: item.id,
            text: item.text,
            tooltip: item.tooltip,
            command: item.command,
            color: item.color,
            backgroundColor: item.backgroundColor,
            alignment: item.alignment,
            priority: item.priority
          })
        }
      }
      return items
    })

    // 获取插件注册的卡片
    ipcMain.handle('plugin:get-cards', () => {
      return this.components.getAllCards().map(card => ({
        id: card.id,
        pluginId: card.pluginId,
        title: card.title,
        description: card.description,
        icon: card.icon,
        iconColor: card.iconColor,
        order: card.order,
        html: card.html,
        actions: card.actions
      }))
    })

    // 获取插件注册的页面
    ipcMain.handle('plugin:get-pages', () => {
      return this.components.getAllPages().map(page => ({
        id: page.id,
        pluginId: page.pluginId,
        title: page.title,
        icon: page.icon,
        order: page.order,
        html: page.html
      }))
    })

    // 获取插件注册的菜单项
    ipcMain.handle('plugin:get-plugin-menu-items', () => {
      return this.components.getAllMenuItems()
    })

    // 执行卡片动作
    ipcMain.handle('plugin:card-action', async (event, cardId, actionId, ...args) => {
      const card = this.components.getCard(cardId)
      if (card && card.onAction) {
        return await card.onAction(actionId, ...args)
      }
      return null
    })

    // 获取前台组件
    ipcMain.handle('plugin:get-frontend-widgets', () => {
      return this.components.getAllFrontendWidgets().map(widget => ({
        id: widget.id,
        pluginId: widget.pluginId,
        type: widget.type,
        label: widget.label,
        icon: widget.icon,
        order: widget.order,
        defaultPosition: widget.defaultPosition,
        defaultSize: widget.defaultSize,
        html: widget.html,
        style: widget.style,
        resizable: widget.resizable,
        draggable: widget.draggable,
        data: widget.data
      }))
    })

    // 更新前台组件数据
    ipcMain.handle('plugin:update-frontend-widget', (event, widgetId, data) => {
      const widget = this.components.getFrontendWidget(widgetId)
      if (widget) {
        widget.data = { ...widget.data, ...data }
        // 通知前台更新
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('plugin:frontend-widget-updated', widgetId, {
            ...widget,
            data: widget.data
          })
        })
        return { success: true }
      }
      return { success: false, error: '组件不存在' }
    })
  }

  /**
   * 注册内置命令
   * @private
   */
  _registerBuiltinCommands() {
    // 重载窗口
    this.commands.registerCommand('director.reloadWindow', () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) {
        win.webContents.reload()
      }
    })

    // 打开开发者工具
    this.commands.registerCommand('director.openDevTools', () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) {
        win.webContents.openDevTools()
      }
    })

    // 切换全屏
    this.commands.registerCommand('director.toggleFullScreen', () => {
      const win = BrowserWindow.getFocusedWindow()
      if (win) {
        win.setFullScreen(!win.isFullScreen())
      }
    })
  }
}

// 导出单例
const pluginAPI = new PluginAPI()

module.exports = {
  PluginAPI,
  CommandRegistry,
  MenuRegistry,
  ViewRegistry,
  ComponentRegistry,
  StatusBarItem,
  MenuItem,
  PluginCard,
  PluginPage,
  MessageType,
  pluginAPI
}
