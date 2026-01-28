/**
 * ASG.Director 插件系统入口
 * 
 * 统一导出所有插件系统模块
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const { PluginManager, PluginState, PluginStorage, pluginManager } = require('./PluginManager')
const { PluginAPI, CommandRegistry, MenuRegistry, ViewRegistry, StatusBarItem, MenuItem, MessageType, pluginAPI } = require('./PluginAPI')
const { EventBus, EventPriority, AppEvents, RoomEvents, BPEvents, MatchEvents, LayoutEvents, PluginEvents, eventBus } = require('./EventBus')

/**
 * 初始化插件系统
 * @param {Object} options - 初始化选项
 * @param {Object} options.app - Electron app 实例
 * @param {BrowserWindow} options.mainWindow - 主窗口
 * @returns {Promise<void>}
 */
async function initializePluginSystem(options = {}) {
  console.log('[PluginSystem] 开始初始化插件系统...')
  
  // 初始化 API
  pluginAPI.initialize(options)
  
  // 初始化插件管理器
  await pluginManager.initialize(pluginAPI)
  
  // 连接事件
  pluginManager.on('plugin-loaded', (pluginId, manifest) => {
    eventBus.publish(PluginEvents.LOADED, { pluginId, manifest })
  })
  
  pluginManager.on('plugin-activated', (pluginId) => {
    eventBus.publish(PluginEvents.ACTIVATED, { pluginId })
  })
  
  pluginManager.on('plugin-deactivated', (pluginId) => {
    eventBus.publish(PluginEvents.DEACTIVATED, { pluginId })
  })
  
  pluginManager.on('plugin-error', (pluginId, error) => {
    eventBus.publish(PluginEvents.ERROR, { pluginId, error: error.message })
  })
  
  // 加载所有插件
  await pluginManager.loadAllPlugins()
  
  // 激活所有插件
  await pluginManager.activateAllPlugins()
  
  console.log('[PluginSystem] 插件系统初始化完成')
  eventBus.publish(AppEvents.READY)
}

/**
 * 关闭插件系统
 * @returns {Promise<void>}
 */
async function shutdownPluginSystem() {
  console.log('[PluginSystem] 正在关闭插件系统...')
  
  eventBus.publish(AppEvents.BEFORE_QUIT)
  
  // 停用所有插件
  await pluginManager.deactivateAllPlugins()
  
  console.log('[PluginSystem] 插件系统已关闭')
}

module.exports = {
  // 核心模块
  PluginManager,
  PluginAPI,
  EventBus,
  
  // 单例实例
  pluginManager,
  pluginAPI,
  eventBus,
  
  // 枚举和常量
  PluginState,
  PluginStorage,
  EventPriority,
  MessageType,
  
  // 事件类型
  AppEvents,
  RoomEvents,
  BPEvents,
  MatchEvents,
  LayoutEvents,
  PluginEvents,
  
  // 注册表类
  CommandRegistry,
  MenuRegistry,
  ViewRegistry,
  StatusBarItem,
  MenuItem,
  
  // 初始化函数
  initializePluginSystem,
  shutdownPluginSystem
}
