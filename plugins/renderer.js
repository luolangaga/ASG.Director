/**
 * ASG.Director 插件系统 - 渲染进程 API
 * 
 * 在 preload.js 中暴露给渲染进程使用
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const { ipcRenderer } = require('electron')

/**
 * 插件系统渲染进程 API
 */
const pluginRendererAPI = {
  // ==================== 插件管理 ====================

  /**
   * 打开插件管理器窗口
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  openPluginManager: () => ipcRenderer.invoke('open-plugin-manager'),
  
  /**
   * 获取所有插件列表
   * @returns {Promise<Array>}
   */
  getAllPlugins: () => ipcRenderer.invoke('plugins:get-all'),
  
  // ==================== 组件 API ====================
  
  /**
   * 获取插件注册的卡片
   * @returns {Promise<Array>}
   */
  getPluginCards: () => ipcRenderer.invoke('plugin:get-cards'),
  
  /**
   * 获取插件注册的页面
   * @returns {Promise<Array>}
   */
  getPluginPages: () => ipcRenderer.invoke('plugin:get-pages'),
  
  /**
   * 获取插件注册的菜单项
   * @returns {Promise<Array>}
   */
  getPluginMenuItems: () => ipcRenderer.invoke('plugin:get-plugin-menu-items'),
  
  /**
   * 执行卡片动作
   * @param {string} cardId - 卡片ID
   * @param {string} actionId - 动作ID
   * @param {...any} args - 参数
   * @returns {Promise<any>}
   */
  cardAction: (cardId, actionId, ...args) => ipcRenderer.invoke('plugin:card-action', cardId, actionId, ...args),
  
  /**
   * 获取插件详情
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object|null>}
   */
  getPluginDetail: (pluginId) => ipcRenderer.invoke('plugins:get-detail', pluginId),
  
  /**
   * 启用插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<{success: boolean}>}
   */
  enablePlugin: (pluginId) => ipcRenderer.invoke('plugins:enable', pluginId),
  
  /**
   * 禁用插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<{success: boolean}>}
   */
  disablePlugin: (pluginId) => ipcRenderer.invoke('plugins:disable', pluginId),
  
  /**
   * 重新加载插件
   * @param {string} pluginId - 插件ID
   * @returns {Promise<{success: boolean}>}
   */
  reloadPlugin: (pluginId) => ipcRenderer.invoke('plugins:reload', pluginId),
  
  /**
   * 获取插件设置
   * @param {string} pluginId - 插件ID
   * @returns {Promise<Object>}
   */
  getPluginSettings: (pluginId) => ipcRenderer.invoke('plugins:get-settings', pluginId),
  
  /**
   * 更新插件设置
   * @param {string} pluginId - 插件ID
   * @param {Object} settings - 设置对象
   * @returns {Promise<{success: boolean}>}
   */
  updatePluginSettings: (pluginId, settings) => ipcRenderer.invoke('plugins:update-settings', pluginId, settings),
  
  // ==================== 命令 ====================
  
  /**
   * 获取所有命令
   * @returns {Promise<string[]>}
   */
  getCommands: () => ipcRenderer.invoke('plugins:get-commands'),
  
  /**
   * 执行命令
   * @param {string} commandId - 命令ID
   * @param {...any} args - 命令参数
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  executeCommand: (commandId, ...args) => ipcRenderer.invoke('plugins:execute-command', commandId, ...args),
  
  // ==================== 事件 ====================
  
  /**
   * 监听插件通知
   * @param {Function} callback - 回调函数
   */
  onNotification: (callback) => {
    ipcRenderer.on('plugin-notification', (event, data) => callback(data))
  },
  
  /**
   * 监听事件总线事件
   * @param {Function} callback - 回调函数
   */
  onEvent: (callback) => {
    ipcRenderer.on('eventbus:event', (event, eventName, ...args) => callback(eventName, ...args))
  },
  
  /**
   * 触发事件
   * @param {string} eventName - 事件名
   * @param {...any} args - 参数
   */
  emitEvent: (eventName, ...args) => {
    ipcRenderer.send('eventbus:emit', eventName, ...args)
  },
  
  /**
   * 订阅事件（获取粘性事件的值）
   * @param {string} eventName - 事件名
   * @returns {Promise<any>}
   */
  subscribeEvent: (eventName) => ipcRenderer.invoke('eventbus:subscribe', eventName),
  
  // ==================== 状态栏 ====================
  
  /**
   * 获取状态栏项
   * @returns {Promise<Array>}
   */
  getStatusBarItems: () => ipcRenderer.invoke('plugin:get-statusbar-items'),
  
  /**
   * 监听状态栏更新
   * @param {Function} callback - 回调函数
   */
  onStatusBarUpdate: (callback) => {
    ipcRenderer.on('plugin:statusbar-update', (event, item) => callback(item))
  },
  
  // ==================== 前台组件 ====================
  
  /**
   * 获取前台组件列表
   * @returns {Promise<Array>}
   */
  getFrontendWidgets: () => ipcRenderer.invoke('plugin:get-frontend-widgets'),
  
  /**
   * 更新前台组件数据
   * @param {string} widgetId - 组件ID
   * @param {Object} data - 数据
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  updateFrontendWidget: (widgetId, data) => ipcRenderer.invoke('plugin:update-frontend-widget', widgetId, data),
  
  /**
   * 监听前台组件列表变化
   * @param {Function} callback - 回调函数
   */
  onFrontendWidgetsChanged: (callback) => {
    ipcRenderer.on('plugin:frontend-widgets-changed', () => callback())
  },
  
  /**
   * 监听前台组件更新
   * @param {Function} callback - 回调函数(widgetId, widget)
   */
  onFrontendWidgetUpdated: (callback) => {
    ipcRenderer.on('plugin:frontend-widget-updated', (event, widgetId, widget) => callback(widgetId, widget))
  },
  
  // ==================== 组件变化事件 ====================
  
  /**
   * 监听组件变化（后台主页卡片/菜单等）
   * @param {Function} callback - 回调函数
   */
  onComponentsChanged: (callback) => {
    ipcRenderer.on('plugin:components-changed', () => callback())
  },
  
  // ==================== 工具 ====================
  
  /**
   * 移除所有监听器
   * @param {string} channel - 频道名
   */
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

module.exports = { pluginRendererAPI }
